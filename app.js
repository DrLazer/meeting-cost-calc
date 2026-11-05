import { ROLES, LOCATIONS } from "./data.js";
import * as calc from "./calc.js";
import { encode, readMeetingHash } from "./share.js";

const $ = (s) => document.querySelector(s);
const TEAMS_KEY = "meeting-cost:teams";
const DIGITS = 8; // 6 pound digits + 2 pence digits

// ---------- state ----------
let state = { location: "UK average", mode: "true", rows: [] };
let running = false;
let costPence = 0;     // accumulated cost in pence
let elapsedMs = 0;     // meeting time (scaled by speed)
let startedAt = null;  // wall-clock time GO was first pressed
let lastTick = 0;
let activeTeam = null; // name of the saved team currently loaded, if any

const { gbp, fmtTime } = calc;
const rowSalary = (row) => calc.rowSalary(state, row);
const costPerHour = () => calc.costPerHour(state);
const headcount = () => calc.headcount(state);

// ---------- odometer ----------
const odo = $("#odometer");
const wheels = [];
function buildOdometer() {
  odo.innerHTML = '<span class="cur">£</span>';
  for (let i = DIGITS - 1; i >= 0; i--) {
    if (i === 1) odo.insertAdjacentHTML("beforeend", '<span class="dot">.</span>');
    else if (i > 2 && i < DIGITS - 1 && (i - 1) % 3 === 0) odo.insertAdjacentHTML("beforeend", '<span class="sep">,</span>');
    const w = document.createElement("span");
    w.className = "wheel" + (i < 2 ? " pence" : "");
    const strip = document.createElement("span");
    strip.className = "strip";
    strip.innerHTML = [0,1,2,3,4,5,6,7,8,9,0].map((d) => `<span>${d}</span>`).join("");
    w.appendChild(strip);
    odo.appendChild(w);
    wheels[i] = { el: w, strip };
  }
}
// Real odometer behaviour: the lowest wheel turns continuously; each higher
// wheel only rolls while every wheel below it is passing 9 → 0.
function renderOdometer(p) {
  const max = 10 ** DIGITS - 1;
  p = Math.min(p, max);
  const top = Math.floor(p).toString().length;
  for (let i = 0; i < DIGITS; i++) {
    const unit = 10 ** i;
    const whole = Math.floor(p / unit) % 10;
    const lower = p % unit;
    const carry = i === 0 ? p % 1 : Math.max(0, lower - (unit - 1));
    const pos = whole + carry;
    wheels[i].strip.style.transform = `translateY(${-pos * (100 / 11)}%)`;
    wheels[i].el.classList.toggle("lead", i >= 3 && i >= top);
  }
}

// ---------- timer ----------
function tick(now) {
  if (!running) return;
  const speed = Number($("#speed").value);
  const dt = (now - lastTick) * speed;
  lastTick = now;
  elapsedMs += dt;
  costPence += (costPerHour() * 100 * dt) / 3_600_000;
  renderOdometer(costPence);
  $("#elapsed").textContent = fmtTime(elapsedMs);
  requestAnimationFrame(tick);
}
function start() {
  if (!headcount()) return;
  if (!elapsedMs) startedAt = Date.now();
  running = true;
  lastTick = performance.now();
  $("#go").textContent = "STOP";
  $("#go").classList.add("stop");
  $("#reset").disabled = true;
  $("#result").hidden = true;
  document.body.classList.add("running");
  requestAnimationFrame(tick);
}
function stop() {
  running = false;
  $("#go").textContent = "GO";
  $("#go").classList.remove("stop");
  $("#reset").disabled = false;
  document.body.classList.remove("running");
  showResult();
}
function reset() {
  costPence = 0;
  elapsedMs = 0;
  startedAt = null;
  renderOdometer(0);
  $("#elapsed").textContent = "00:00";
  $("#result").hidden = true;
  $("#reset").disabled = true;
}
function resultSentence() {
  const mins = Math.max(1, Math.round(elapsedMs / 60000));
  return `This ${mins}-minute meeting with ${headcount()} ${headcount() === 1 ? "person" : "people"} cost ${gbp(costPence / 100, 2)}.`;
}
function showResult() {
  if (!costPence) return;
  const perYear = (costPence / 100) * 46; // working weeks
  $("#resultText").innerHTML =
    `<strong>${gbp(costPence / 100, 2)}</strong> over ${fmtTime(elapsedMs)}.` +
    `<span>Held weekly, that's about ${gbp(perYear)} a year.</span>`;
  $("#report").href = "report.html#" + meetingUrl(true).split("#")[1];
  $("#result").hidden = false;
}

// ---------- attendees UI ----------
function renderRows() {
  const list = $("#attendees");
  list.innerHTML = "";
  state.rows.forEach((row, idx) => {
    const li = $("#rowTpl").content.firstElementChild.cloneNode(true);
    const role = li.querySelector(".role");
    const n = li.querySelector(".n");
    const sal = li.querySelector(".sal");
    role.value = row.role;
    n.value = row.count;
    sal.value = rowSalary(row);
    sal.classList.toggle("override", row.salary != null);

    role.addEventListener("change", () => { row.role = role.value.trim() || "Attendee"; row.salary = null; sal.value = rowSalary(row); sal.classList.remove("override"); changed(); });
    n.addEventListener("input", () => { const v = parseInt(n.value); if (Number.isFinite(v)) { row.count = clamp(v); changed(); } });
    n.addEventListener("change", () => { row.count = clamp(parseInt(n.value) || 1); n.value = row.count; changed(); });
    li.querySelector(".dec").addEventListener("click", () => { row.count = clamp(row.count - 1); n.value = row.count; changed(); });
    li.querySelector(".inc").addEventListener("click", () => { row.count = clamp(row.count + 1); n.value = row.count; changed(); });
    sal.addEventListener("input", () => { const v = parseInt(sal.value); if (Number.isFinite(v)) { row.salary = v; sal.classList.add("override"); changed(); } });
    sal.addEventListener("change", () => { const v = parseInt(sal.value); row.salary = Number.isFinite(v) ? v : null; sal.value = rowSalary(row); sal.classList.toggle("override", row.salary != null); changed(); });
    li.querySelector(".remove").addEventListener("click", () => { state.rows.splice(idx, 1); renderRows(); changed(); });
    list.appendChild(li);
  });
}
const clamp = (n) => Math.min(99, Math.max(1, n));

function changed() {
  const ph = costPerHour();
  $("#perHour").textContent = gbp(ph);
  $("#perMinute").textContent = gbp(ph / 60, 2);
  $("#people").textContent = headcount();
  $("#go").disabled = !headcount();
  writeHash();
  renderTeams();
}

// ---------- randomise ----------
function randomMeeting() {
  const roles = Object.keys(ROLES).filter((r) => !["CEO", "CTO", "Graduate / Intern"].includes(r));
  const shuffled = roles.sort(() => Math.random() - 0.5).slice(0, 3 + Math.floor(Math.random() * 4));
  const locs = Object.keys(LOCATIONS);
  return {
    location: locs[Math.floor(Math.random() * locs.length)],
    mode: "true",
    rows: shuffled.map((role, i) => ({ role, count: i === 0 ? 1 + Math.floor(Math.random() * 3) : 1, salary: null })),
  };
}

// ---------- teams (localStorage) ----------
function loadTeams() {
  try { return JSON.parse(localStorage.getItem(TEAMS_KEY)) || []; } catch { return []; }
}
function saveTeams(teams) {
  try { localStorage.setItem(TEAMS_KEY, JSON.stringify(teams)); } catch {}
}
function renderTeams() {
  const teams = loadTeams();
  const ul = $("#teams");
  ul.innerHTML = "";
  $("#noTeams").hidden = teams.length > 0;
  teams.forEach((t, i) => {
    const li = document.createElement("li");
    const people = t.state.rows.reduce((s, r) => s + r.count, 0);
    const isActive = t.name === activeTeam;
    const edited = isActive && JSON.stringify(t.state) !== JSON.stringify(state);
    li.classList.toggle("active", isActive);
    li.innerHTML = `<button class="load"><strong></strong><span>${people} ${people === 1 ? "person" : "people"} · ${t.state.location}${edited ? " · <em>unsaved changes</em>" : ""}</span></button>` +
      (edited ? `<button class="update">Update</button>` : "") +
      `<button class="del" aria-label="Delete team">×</button>`;
    li.querySelector("strong").textContent = t.name;
    li.querySelector(".load").addEventListener("click", () => { activeTeam = t.name; applyState(structuredClone(t.state)); window.scrollTo({ top: 0, behavior: "smooth" }); });
    li.querySelector(".update")?.addEventListener("click", () => saveTeam(t.name));
    li.querySelector(".del").addEventListener("click", () => { const all = loadTeams(); all.splice(i, 1); saveTeams(all); if (isActive) activeTeam = null; renderTeams(); });
    ul.appendChild(li);
  });
}

function saveTeam(name) {
  const teams = loadTeams();
  const snapshot = { name, state: structuredClone(state) };
  const i = teams.findIndex((t) => t.name === name);
  if (i >= 0) teams[i] = snapshot; else teams.unshift(snapshot);
  saveTeams(teams);
  activeTeam = name;
  renderTeams();
}

// ---------- URL sharing ----------
function meetingUrl(withResult) {
  const data = withResult && costPence
    ? { ...state, r: { c: Math.round(costPence), t: Math.round(elapsedMs), ...(startedAt ? { s: startedAt } : {}) } }
    : state;
  return location.href.split("#")[0] + "#m=" + encode(data);
}
function writeHash() {
  try { history.replaceState(null, "", "#m=" + encode(state)); } catch {}
}

// ---------- wiring ----------
function applyState(s) {
  state = { location: LOCATIONS[s.location] ? s.location : "UK average", mode: s.mode === "salary" ? "salary" : "true", rows: s.rows };
  $("#location").value = state.location;
  $("#mode").value = state.mode;
  if (!running) reset();
  renderRows();
  changed();
}

async function copy(text, btn) {
  try { await navigator.clipboard.writeText(text); const o = btn.textContent; btn.textContent = "Copied!"; setTimeout(() => (btn.textContent = o), 1500); } catch {}
}

function init() {
  buildOdometer();
  renderOdometer(0);
  $("#location").innerHTML = Object.keys(LOCATIONS).map((l) => `<option>${l}</option>`).join("");
  $("#roleList").innerHTML = Object.keys(ROLES).map((r) => `<option value="${r}">`).join("");

  $("#go").addEventListener("click", () => (running ? stop() : start()));
  $("#reset").addEventListener("click", reset);
  $("#location").addEventListener("change", (e) => { state.location = e.target.value; renderRows(); changed(); });
  $("#mode").addEventListener("change", (e) => { state.mode = e.target.value; changed(); });
  $("#addRow").addEventListener("click", () => { state.rows.push({ role: "Software Engineer", count: 1, salary: null }); renderRows(); changed(); });
  $("#randomise").addEventListener("click", () => { activeTeam = null; applyState(randomMeeting()); });
  $("#saveForm").addEventListener("submit", (e) => {
    e.preventDefault();
    const name = $("#teamName").value.trim();
    if (!name) return;
    saveTeam(name);
    $("#teamName").value = "";
  });
  $("#copyResult").addEventListener("click", (e) => copy(resultSentence() + " " + meetingUrl(true), e.target));
  $("#copyLink").addEventListener("click", (e) => copy(meetingUrl(true), e.target));

  const shared = readMeetingHash();
  applyState(shared || randomMeeting());
  if (shared?.r?.c > 0) {
    // Opened from a shared result: show the finished meeting.
    costPence = shared.r.c;
    elapsedMs = Math.max(0, shared.r.t || 0);
    startedAt = shared.r.s || null;
    renderOdometer(costPence);
    $("#elapsed").textContent = fmtTime(elapsedMs);
    $("#reset").disabled = false;
    showResult();
    writeHash(); // keep the result out of the live URL so edits don't carry a stale total
  }
  renderTeams();
}
init();

import {
  ROLES, LOCATIONS, DEFAULT_SALARY,
  EMPLOYER_NI_RATE, EMPLOYER_NI_THRESHOLD, EMPLOYER_PENSION_RATE, OVERHEAD_RATE,
  WORKING_HOURS_PER_YEAR,
} from "./data.js";

const $ = (s) => document.querySelector(s);
const TEAMS_KEY = "meeting-cost:teams";
const DIGITS = 8; // 6 pound digits + 2 pence digits

// ---------- state ----------
let state = { location: "UK average", mode: "true", rows: [] };
let running = false;
let costPence = 0;     // accumulated cost in pence
let elapsedMs = 0;     // meeting time (scaled by speed)
let lastTick = 0;

// ---------- money helpers ----------
const gbp = (n, dp = 0) =>
  n.toLocaleString("en-GB", { style: "currency", currency: "GBP", minimumFractionDigits: dp, maximumFractionDigits: dp });

function baseSalary(role) {
  const key = Object.keys(ROLES).find((r) => r.toLowerCase() === role.trim().toLowerCase());
  return key ? ROLES[key] : DEFAULT_SALARY;
}
function rowSalary(row) {
  if (row.salary != null) return row.salary;
  const raw = baseSalary(row.role) * (LOCATIONS[state.location] ?? 1);
  return Math.round(raw / 500) * 500;
}
function annualCost(salary) {
  if (state.mode === "salary") return salary;
  const ni = Math.max(0, salary - EMPLOYER_NI_THRESHOLD) * EMPLOYER_NI_RATE;
  return salary + ni + salary * EMPLOYER_PENSION_RATE + salary * OVERHEAD_RATE;
}
function costPerHour() {
  return state.rows.reduce((t, r) => t + (annualCost(rowSalary(r)) / WORKING_HOURS_PER_YEAR) * r.count, 0);
}
const headcount = () => state.rows.reduce((t, r) => t + r.count, 0);

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
function fmtTime(ms) {
  const s = Math.floor(ms / 1000);
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = s % 60;
  const pad = (n) => String(n).padStart(2, "0");
  return h ? `${h}:${pad(m)}:${pad(sec)}` : `${pad(m)}:${pad(sec)}`;
}
function start() {
  if (!headcount()) return;
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
  const perYear = (costPence / 100) * 52;
  $("#resultText").innerHTML =
    `<strong>${gbp(costPence / 100, 2)}</strong> over ${fmtTime(elapsedMs)}.` +
    `<span>Held weekly, that's about ${gbp(perYear)} a year.</span>`;
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
    n.addEventListener("change", () => { row.count = clamp(parseInt(n.value) || 1); n.value = row.count; changed(); });
    li.querySelector(".dec").addEventListener("click", () => { row.count = clamp(row.count - 1); n.value = row.count; changed(); });
    li.querySelector(".inc").addEventListener("click", () => { row.count = clamp(row.count + 1); n.value = row.count; changed(); });
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
    li.innerHTML = `<button class="load"><strong></strong><span>${people} people · ${t.state.location}</span></button><button class="del" aria-label="Delete team">×</button>`;
    li.querySelector("strong").textContent = t.name;
    li.querySelector(".load").addEventListener("click", () => { applyState(structuredClone(t.state)); window.scrollTo({ top: 0, behavior: "smooth" }); });
    li.querySelector(".del").addEventListener("click", () => { const all = loadTeams(); all.splice(i, 1); saveTeams(all); renderTeams(); });
    ul.appendChild(li);
  });
}

// ---------- URL sharing ----------
function writeHash() {
  const data = btoa(encodeURIComponent(JSON.stringify(state)));
  history.replaceState(null, "", "#m=" + data);
}
function readHash() {
  const m = location.hash.match(/^#m=(.+)$/);
  if (!m) return null;
  try {
    const s = JSON.parse(decodeURIComponent(atob(m[1])));
    if (Array.isArray(s.rows)) return s;
  } catch {}
  return null;
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
  $("#randomise").addEventListener("click", () => applyState(randomMeeting()));
  $("#saveForm").addEventListener("submit", (e) => {
    e.preventDefault();
    const name = $("#teamName").value.trim();
    if (!name) return;
    const teams = loadTeams().filter((t) => t.name !== name);
    teams.unshift({ name, state: structuredClone(state) });
    saveTeams(teams);
    $("#teamName").value = "";
    renderTeams();
  });
  $("#copyResult").addEventListener("click", (e) => copy(resultSentence() + " " + location.href.split("#")[0], e.target));
  $("#copyLink").addEventListener("click", (e) => copy(location.href, e.target));

  applyState(readHash() || randomMeeting());
  renderTeams();
}
init();

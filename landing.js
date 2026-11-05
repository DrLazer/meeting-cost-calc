import { COUNTRIES, LOCATIONS } from "./data.js";
import * as calc from "./calc.js";
import { encode } from "./share.js";

const $ = (s) => document.querySelector(s);
const reduceMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;
const PLACE_KEY = "meeting-cost:location"; // shared with the calculator

// ---------- per-country story ----------
const STORY = {
  UK: {
    sample: "Manchester",
    party: "Christmas Party",
    partyStat: "spent discussing the Christmas party",
    plants: "Office plant rota",
    scrawl: "declined: plant rota",
    snack: "sausage rolls",
  },
  US: {
    sample: "Chicago",
    party: "Holiday Party",
    partyStat: "spent discussing the holiday party",
    plants: "Office plant schedule",
    scrawl: "declined: plant schedule",
    snack: "Costco hot dogs",
  },
};

// Which country to tell the story for: the city you picked in the calculator,
// otherwise a guess from your time zone.
function startingCountry() {
  try {
    const saved = localStorage.getItem(PLACE_KEY);
    if (LOCATIONS[saved]) return LOCATIONS[saved].country;
  } catch {}
  return LOCATIONS[calc.locationFromTimeZone()].country;
}

// ---------- odometer (same mechanics as the calculator) ----------
function odometer(el, digits = 8) {
  const wheels = [];
  el.innerHTML = '<span class="cur">£</span>';
  for (let i = digits - 1; i >= 0; i--) {
    if (i === 1) el.insertAdjacentHTML("beforeend", '<span class="dot">.</span>');
    else if (i > 2 && i < digits - 1 && (i - 1) % 3 === 0) el.insertAdjacentHTML("beforeend", '<span class="sep">,</span>');
    const w = document.createElement("span");
    w.className = "wheel" + (i < 2 ? " pence" : "");
    const strip = document.createElement("span");
    strip.className = "strip";
    strip.innerHTML = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 0].map((d) => `<span>${d}</span>`).join("");
    w.appendChild(strip);
    el.appendChild(w);
    wheels[i] = { el: w, strip };
  }
  const render = (p) => {
    p = Math.min(p, 10 ** digits - 1);
    const top = Math.floor(p).toString().length;
    for (let i = 0; i < digits; i++) {
      const unit = 10 ** i;
      const whole = Math.floor(p / unit) % 10;
      const carry = i === 0 ? p % 1 : Math.max(0, (p % unit) - (unit - 1));
      wheels[i].strip.style.transform = `translateY(${-(whole + carry) * (100 / 11)}%)`;
      wheels[i].el.classList.toggle("lead", i >= 3 && i >= top);
    }
  };
  render.symbol = (s) => (el.querySelector(".cur").textContent = s);
  return render;
}
const renderHero = odometer($("#heroOdo"), 8);
const renderDemo = odometer($("#demoOdo"), 7);

// ---------- the calendar week ----------
// [day, start, minutes, title, people, kind]; {party} and {plants} are filled in per country.
const WEEK = [
  [0, "09:00", 30, "Weekly kick-off", 12],
  [0, "09:30", 30, "Pre-meeting for the planning meeting", 5],
  [0, "10:00", 60, "Planning meeting", 9],
  [0, "11:00", 30, "{party} Options", 14, "party"],
  [0, "11:30", 60, "Sync about the sync", 6],
  [0, "13:00", 45, "Lunch & learn: calendar hygiene", 30],
  [0, "14:00", 60, "Stakeholder alignment", 8],
  [0, "15:00", 30, "Quick 5-minute chat", 4],
  [0, "16:00", 60, "Status update (could be an email)", 11],

  [1, "09:00", 15, "Stand-up", 8],
  [1, "09:15", 15, "Stand-up overflow", 8],
  [1, "10:00", 90, "{party} Options: venue shortlist", 9, "party"],
  [1, "12:00", 60, "Working lunch (no lunch)", 7],
  [1, "13:30", 60, "Retro of the retro", 7],
  [1, "14:30", 30, "Agree the agenda", 5],
  [1, "15:00", 90, "Q1 planning kick-off kick-off", 12],
  [1, "16:30", 30, "Can everyone see my screen?", 6],

  [2, "09:00", 15, "Stand-up", 8],
  [2, "09:30", 60, "Feedback on the feedback form", 6],
  [2, "10:30", 30, "{plants}", 9],
  [2, "11:00", 60, "Synergy workshop", 16],
  [2, "12:00", 60, "Focus time", 1, "focus"],
  [2, "13:00", 60, "All-hands rehearsal", 10],
  [2, "14:00", 60, "All-hands", 120],
  [2, "15:00", 60, "All-hands debrief", 10],
  [2, "16:00", 60, "Debrief of the debrief", 6],

  [3, "09:00", 15, "Stand-up", 8],
  [3, "09:30", 60, "{party} Options (rescheduled)", 14, "party"],
  [3, "10:30", 60, "Brainstorm: naming the brainstorm", 8],
  [3, "11:30", 30, "Catch-up", 2],
  [3, "12:00", 60, "Catch-up about the catch-up", 3],
  [3, "14:00", 120, "Workshop: reducing meetings", 15],
  [3, "16:00", 30, "Weekly meeting audit", 5],
  [3, "16:30", 60, "Drinks (optional, mandatory)", 20],

  [4, "09:00", 15, "Stand-up", 8],
  [4, "09:30", 30, "{party} Options working group", 6, "party"],
  [4, "10:00", 60, "Sprint review", 12],
  [4, "11:00", 60, "Sprint planning", 9],
  [4, "13:00", 30, "Week in review", 7],
  [4, "13:30", 30, "Review of the week in review", 4],
  [4, "14:00", 60, "{party} Options: final vote", 15, "party"],
  [4, "15:00", 60, "{party} Options: re-vote", 15, "party"],
  [4, "16:00", 30, "Friday wins (optional*)", 25],
];
const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri"];
const START = 9, END = 17.5;
const toHours = (hhmm) => { const [h, m] = hhmm.split(":").map(Number); return h + m / 60; };

// ---------- render everything for one country ----------
let anim = { heroStart: 0, heroRate: 0, demoRate: 0 };

function render(cc) {
  const c = COUNTRIES[cc];
  const story = STORY[cc];
  const money = (n, dp = 0) => calc.formatMoney(n, c.currency, dp);
  const fill = (t) => t.replace("{party}", story.party).replace("{plants}", story.plants);

  // Average true-cost hourly rate per person, from the app's own salary data
  // (leaving out the C-suite and graduates so it reflects a typical meeting).
  const national = { location: c.average, mode: "true" };
  const typical = Object.keys(c.roles).filter((r) => !/CEO|CTO|Director|Head of|Graduate/.test(r));
  const avgHourly = typical.reduce((t, role) => t + calc.hourlyRate(national, { role, count: 1, salary: null }), 0) / typical.length;

  // switch + any copy that differs by country
  document.querySelectorAll("#region button").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.cc === cc)));
  document.querySelectorAll("[data-uk]").forEach((el) => (el.textContent = cc === "US" ? el.dataset.us : el.dataset.uk));

  // ---- hero: the Q3 sync that never ended ----
  renderHero.symbol(c.symbol);
  renderDemo.symbol(c.symbol);
  anim.heroStart = 18740218; // pence/cents already spent when the page opens
  anim.heroRate = (8 * avgHourly * 100) / 3600;

  // ---- calculator demo ----
  const sample = {
    location: story.sample,
    mode: "true",
    rows: [
      { role: "Software Engineer", count: 2, salary: null },
      { role: "Project Manager", count: 1, salary: null },
      { role: "Delivery Manager", count: 1, salary: null },
      { role: "Business Analyst", count: 1, salary: null },
      { role: "Service Designer", count: 1, salary: null },
      { role: "User Researcher", count: 1, salary: null },
    ],
  };
  const sampleHourly = calc.costPerHour(sample);
  anim.demoRate = (sampleHourly * 100) / 3600;
  $("#miniRows").innerHTML = sample.rows.slice(0, 5).map((r) =>
    `<li><span>${r.count} × ${r.role}</span><span>${money(calc.rowSalary(sample, r))}</span></li>`).join("") +
    `<li class="more"><span>+ ${sample.rows.length - 5} more</span><span></span></li>`;
  $("#miniPlace").textContent = story.sample;

  // ---- report demo ----
  const MINUTES = 47;
  const sampleTotal = sampleHourly * (MINUTES / 60);
  const shares = sample.rows.map((r) => ({ role: r.role, count: r.count, cost: calc.hourlyRate(sample, r) * r.count * (MINUTES / 60) }))
    .sort((a, b) => b.cost - a.cost);
  $("#miniBars").innerHTML = shares.slice(0, 5).map((s) => `
    <div class="mb-row"><span class="mb-label">${s.role}${s.count > 1 ? ` × ${s.count}` : ""}</span>
    <span class="mb-track"><span style="--w:${(s.cost / shares[0].cost) * 100}%"></span></span>
    <span class="mb-val">${money(s.cost, 2)}</span></div>`).join("");
  $("#miniSaves").innerHTML = [
    ["10 minutes shorter", sampleTotal * (10 / MINUTES)],
    ["An email instead", sampleTotal],
  ].map(([k, v]) => `<div><span>${k}</span><strong>${money(v, 2)} saved</strong></div>`).join("");

  // ---- receipt demo ----
  const rest = shares.slice(4).reduce((t, s) => t + s.cost, 0);
  $("#miniReceipt").innerHTML = `
    <div class="mr-brand">MEETING COST</div>
    <div class="mr-sub">Itemised bill for one meeting</div>
    <div class="mr-rule"></div>
    ${shares.slice(0, 4).map((s) => `<div class="mr-line"><span>${s.count} × ${s.role}</span><span>${money(s.cost, 2)}</span></div>`).join("")}
    <div class="mr-line"><span>${shares.length - 4} more</span><span>${money(rest, 2)}</span></div>
    <div class="mr-rule double"></div>
    <div class="mr-total"><span>TOTAL</span><strong>${money(sampleTotal, 2)}</strong></div>
    <div class="mr-rule"></div>
    <div class="mr-thanks">Thank you for meeting.</div>
    <div class="mr-barcode"></div>`;

  // ---- sample report link: last Monday's 9am meeting that ran long ----
  const monday = new Date();
  monday.setDate(monday.getDate() - ((monday.getDay() + 6) % 7) - 7);
  monday.setHours(9, 0, 0, 0);
  $("#sampleReport").href = "report.html#m=" + encode({
    ...sample,
    r: { c: Math.round(sampleTotal * 100), u: c.currency, t: MINUTES * 60000, s: monday.getTime() },
  });

  // ---- the calendar ----
  const costOf = (mins, people) => people * avgHourly * (mins / 60);
  const meetings = WEEK.filter((e) => e[5] !== "focus");
  const totalMins = meetings.reduce((t, e) => t + e[2], 0);
  const totalCost = meetings.reduce((t, e) => t + costOf(e[2], e[4]), 0);
  const party = WEEK.filter((e) => e[5] === "party");
  $("#weekStats").innerHTML = [
    [meetings.length, "meetings"],
    [`${(totalMins / 60).toFixed(totalMins % 60 ? 1 : 0)} hrs`, `in meetings, out of ${c.weekHours}`],
    [money(totalCost), "in everyone's time"],
    [money(party.reduce((t, e) => t + costOf(e[2], e[4]), 0)), story.partyStat],
  ].map(([v, k]) => `<div><strong>${v}</strong><span>${k}</span></div>`).join("");
  $("#calNote").textContent = `Each meeting is costed at ${money(avgHourly, 2)} an hour per person: the average true cost of a typical role in the calculator.`;

  const hourLabel = (h) => cc === "US" ? `${((h + 11) % 12) + 1} ${h < 12 ? "AM" : "PM"}` : `${String(h).padStart(2, "0")}:00`;
  const cal = $("#cal");
  cal.style.setProperty("--hours", END - START);
  let html = '<div class="cal-times">';
  for (let h = START; h < END; h++) html += `<span style="--at:${h - START}">${hourLabel(h)}</span>`;
  html += "</div>";
  DAYS.forEach((d, i) => {
    html += `<div class="cal-day"><div class="cal-dayname">${d}</div><div class="cal-col">`;
    WEEK.filter((e) => e[0] === i).forEach(([, start, mins, raw, people, kind]) => {
      const title = fill(raw);
      const at = toHours(start) - START;
      const size = mins <= 15 ? "xs" : mins < 60 ? "s" : "m";
      const cost = kind === "focus" ? "" : money(costOf(mins, people));
      html += `<div class="ev ev-${size}${kind ? " ev-" + kind : ""}" style="--at:${at};--len:${mins / 60}" title="${title} · ${people} ${people === 1 ? "person" : "people"}${cost ? " · " + cost : ""}">
        <span class="ev-title">${kind === "party" ? "🎄 " : ""}${title}</span>
        ${kind === "focus" ? "" : `<span class="ev-meta"><span>${people} ${people === 1 ? "person" : "people"}</span><b>${cost}</b></span>`}
      </div>`;
    });
    if (i === 2) html += `<span class="scrawl">${story.scrawl}</span>`;
    html += "</div></div>";
  });
  cal.innerHTML = html;

  if (reduceMotion) { renderHero(anim.heroStart); renderDemo(4398); }
}

// ---------- motion ----------
const t0 = performance.now();
const DEMO_SPEED = 30; // the demo meter runs fast so you can see it move
function frame(now) {
  const secs = (now - t0) / 1000;
  renderHero(anim.heroStart + anim.heroRate * secs);
  renderDemo((anim.demoRate * secs * DEMO_SPEED) % 10 ** 6);
  requestAnimationFrame(frame);
}

// ---------- start ----------
$("#roleCount").textContent = Object.keys(COUNTRIES.UK.roles).length;
$("#ukCities").textContent = Object.keys(COUNTRIES.UK.cities).length - 1; // not counting the national average
$("#usCities").textContent = Object.keys(COUNTRIES.US.cities).length - 1;

document.querySelectorAll("#region button").forEach((b) => b.addEventListener("click", () => {
  const cc = b.dataset.cc;
  render(cc);
  // Carry the choice into the calculator, unless you've already picked a city in that country.
  try {
    const saved = localStorage.getItem(PLACE_KEY);
    if (LOCATIONS[saved]?.country !== cc) localStorage.setItem(PLACE_KEY, COUNTRIES[cc].average);
  } catch {}
}));

render(startingCountry());
if (!reduceMotion) requestAnimationFrame(frame);

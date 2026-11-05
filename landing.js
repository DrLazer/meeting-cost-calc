import { ROLES, LOCATIONS } from "./data.js";
import * as calc from "./calc.js";
import { encode } from "./share.js";

const $ = (s) => document.querySelector(s);
const { gbp } = calc;
const reduceMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;

// Average true-cost hourly rate per person, from the app's own salary data
// (leaving out the C-suite and graduates so it reflects a typical meeting).
const UK = { location: "UK average", mode: "true" };
const typical = Object.keys(ROLES).filter((r) => !/CEO|CTO|Director|Head of|Graduate/.test(r));
const AVG_HOURLY = typical.reduce((t, role) => t + calc.hourlyRate(UK, { role, count: 1, salary: null }), 0) / typical.length;

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
  return (p) => {
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
}

// ---------- hero: the Q3 sync that never ended ----------
const HERO_PEOPLE = 8;
const heroStart = 18740218; // pence already spent when the page opens
const heroRate = (HERO_PEOPLE * AVG_HOURLY * 100) / 3600; // pence per second
const renderHero = odometer($("#heroOdo"), 8);

// ---------- calculator demo ----------
const sample = {
  location: "Manchester",
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
$("#miniRows").innerHTML = sample.rows.slice(0, 5).map((r) =>
  `<li><span>${r.count} × ${r.role}</span><span>${gbp(calc.rowSalary(sample, r))}</span></li>`).join("") +
  `<li class="more"><span>+ ${sample.rows.length - 5} more</span><span></span></li>`;
const renderDemo = odometer($("#demoOdo"), 7);
const DEMO_SPEED = 30; // the demo meter runs fast so you can see it move

let t0 = performance.now();
function frame(now) {
  const secs = (now - t0) / 1000;
  renderHero(heroStart + heroRate * secs);
  renderDemo(((sampleHourly * 100) / 3600) * secs * DEMO_SPEED % 10 ** 6);
  requestAnimationFrame(frame);
}
if (reduceMotion) { renderHero(heroStart); renderDemo(4398); }
else requestAnimationFrame(frame);

// ---------- report demo ----------
const MINUTES = 47;
const sampleTotal = sampleHourly * (MINUTES / 60);
const shares = sample.rows.map((r) => ({ role: r.role, count: r.count, cost: calc.hourlyRate(sample, r) * r.count * (MINUTES / 60) }))
  .sort((a, b) => b.cost - a.cost);
$("#miniBars").innerHTML = shares.slice(0, 5).map((s) => `
  <div class="mb-row"><span class="mb-label">${s.role}${s.count > 1 ? ` × ${s.count}` : ""}</span>
  <span class="mb-track"><span style="--w:${(s.cost / shares[0].cost) * 100}%"></span></span>
  <span class="mb-val">${gbp(s.cost, 2)}</span></div>`).join("");
$("#miniSaves").innerHTML = [
  ["10 minutes shorter", sampleTotal * (10 / MINUTES)],
  ["An email instead", sampleTotal],
].map(([k, v]) => `<div><span>${k}</span><strong>${gbp(v, 2)} saved</strong></div>`).join("");

// ---------- receipt demo ----------
function renderReceipt(rates) {
  const lines = shares.slice(0, 4);
  const rest = shares.slice(4).reduce((t, s) => t + s.cost, 0);
  $("#miniReceipt").innerHTML = `
    <div class="mr-brand">MEETING COST</div>
    <div class="mr-sub">Itemised bill for one meeting</div>
    <div class="mr-rule"></div>
    ${lines.map((s) => `<div class="mr-line"><span>${s.count} × ${s.role}</span><span>${gbp(s.cost, 2)}</span></div>`).join("")}
    <div class="mr-line"><span>${shares.length - 4} more</span><span>${gbp(rest, 2)}</span></div>
    <div class="mr-rule double"></div>
    <div class="mr-total"><span>TOTAL</span><strong>${gbp(sampleTotal, 2)}</strong></div>
    ${rates
      ? `<div class="mr-line muted"><span>USD</span><span>${(sampleTotal * rates.USD).toLocaleString("en-US", { style: "currency", currency: "USD" })}</span></div>
         <div class="mr-line muted"><span>BTC</span><span>₿${(sampleTotal * rates.BTC).toFixed(8)}</span></div>`
      : `<div class="mr-line muted"><span>USD · BTC</span><span>at live rates</span></div>`}
    <div class="mr-rule"></div>
    <div class="mr-thanks">Thank you for meeting.</div>
    <div class="mr-barcode"></div>`;
}
renderReceipt(null);
fetch("https://api.coinbase.com/v2/exchange-rates?currency=GBP")
  .then((r) => (r.ok ? r.json() : Promise.reject()))
  .then(({ data }) => {
    const rates = { USD: Number(data.rates.USD), BTC: Number(data.rates.BTC) };
    if (Number.isFinite(rates.USD) && Number.isFinite(rates.BTC)) renderReceipt(rates);
  })
  .catch(() => {});

// ---------- sample report link: last Monday's 9am stand-up that ran long ----------
const monday = new Date();
monday.setDate(monday.getDate() - ((monday.getDay() + 6) % 7) - 7);
monday.setHours(9, 0, 0, 0);
$("#sampleReport").href = "report.html#m=" + encode({
  ...sample,
  r: { c: Math.round(sampleTotal * 100), t: MINUTES * 60000, s: monday.getTime() },
});

$("#roleCount").textContent = Object.keys(ROLES).length;
$("#cityCount").textContent = Object.keys(LOCATIONS).length - 1; // not counting "UK average"

// ---------- the calendar ----------
// [day, start, minutes, title, people, kind]
const WEEK = [
  [0, "09:00", 30, "Weekly kick-off", 12],
  [0, "09:30", 30, "Pre-meeting for the planning meeting", 5],
  [0, "10:00", 60, "Planning meeting", 9],
  [0, "11:00", 30, "Christmas Party Options", 14, "xmas"],
  [0, "11:30", 60, "Sync about the sync", 6],
  [0, "13:00", 45, "Lunch & learn: calendar hygiene", 30],
  [0, "14:00", 60, "Stakeholder alignment", 8],
  [0, "15:00", 30, "Quick 5-minute chat", 4],
  [0, "16:00", 60, "Status update (could be an email)", 11],

  [1, "09:00", 15, "Stand-up", 8],
  [1, "09:15", 15, "Stand-up overflow", 8],
  [1, "10:00", 90, "Christmas Party Options: venue shortlist", 9, "xmas"],
  [1, "12:00", 60, "Working lunch (no lunch)", 7],
  [1, "13:30", 60, "Retro of the retro", 7],
  [1, "14:30", 30, "Agree the agenda", 5],
  [1, "15:00", 90, "Q1 planning kick-off kick-off", 12],
  [1, "16:30", 30, "Can everyone see my screen?", 6],

  [2, "09:00", 15, "Stand-up", 8],
  [2, "09:30", 60, "Feedback on the feedback form", 6],
  [2, "10:30", 30, "Office plant rota", 9],
  [2, "11:00", 60, "Synergy workshop", 16],
  [2, "12:00", 60, "Focus time", 1, "focus"],
  [2, "13:00", 60, "All-hands rehearsal", 10],
  [2, "14:00", 60, "All-hands", 120],
  [2, "15:00", 60, "All-hands debrief", 10],
  [2, "16:00", 60, "Debrief of the debrief", 6],

  [3, "09:00", 15, "Stand-up", 8],
  [3, "09:30", 60, "Christmas Party Options (rescheduled)", 14, "xmas"],
  [3, "10:30", 60, "Brainstorm: naming the brainstorm", 8],
  [3, "11:30", 30, "Catch-up", 2],
  [3, "12:00", 60, "Catch-up about the catch-up", 3],
  [3, "14:00", 120, "Workshop: reducing meetings", 15],
  [3, "16:00", 30, "Weekly meeting audit", 5],
  [3, "16:30", 60, "Drinks (optional, mandatory)", 20],

  [4, "09:00", 15, "Stand-up", 8],
  [4, "09:30", 30, "Christmas Party Options working group", 6, "xmas"],
  [4, "10:00", 60, "Sprint review", 12],
  [4, "11:00", 60, "Sprint planning", 9],
  [4, "13:00", 30, "Week in review", 7],
  [4, "13:30", 30, "Review of the week in review", 4],
  [4, "14:00", 60, "Christmas Party Options: final vote", 15, "xmas"],
  [4, "15:00", 60, "Christmas Party Options: re-vote", 15, "xmas"],
  [4, "16:00", 30, "Friday wins (optional*)", 25],
];
const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri"];
const START = 9, END = 17.5;
const toHours = (hhmm) => { const [h, m] = hhmm.split(":").map(Number); return h + m / 60; };
const costOf = (mins, people) => people * AVG_HOURLY * (mins / 60);

const meetings = WEEK.filter((e) => e[5] !== "focus");
const totalMins = meetings.reduce((t, e) => t + e[2], 0);
const totalCost = meetings.reduce((t, e) => t + costOf(e[2], e[4]), 0);
const xmas = WEEK.filter((e) => e[5] === "xmas");
$("#weekStats").innerHTML = [
  [meetings.length, "meetings"],
  [`${(totalMins / 60).toFixed(totalMins % 60 ? 1 : 0)} hrs`, `in meetings, out of 37.5`],
  [gbp(totalCost), "in everyone's time"],
  [gbp(xmas.reduce((t, e) => t + costOf(e[2], e[4]), 0)), "spent discussing the Christmas party"],
].map(([v, k]) => `<div><strong>${v}</strong><span>${k}</span></div>`).join("");
$("#calNote").textContent = `Each meeting is costed at ${gbp(AVG_HOURLY, 2)} an hour per person: the average true cost of a typical role in the calculator.`;

const cal = $("#cal");
cal.style.setProperty("--hours", END - START);
let html = '<div class="cal-times">';
for (let h = START; h < END; h++) html += `<span style="--at:${h - START}">${String(h).padStart(2, "0")}:00</span>`;
html += "</div>";
DAYS.forEach((d, i) => {
  html += `<div class="cal-day"><div class="cal-dayname">${d}</div><div class="cal-col">`;
  WEEK.filter((e) => e[0] === i).forEach(([, start, mins, title, people, kind]) => {
    const at = toHours(start) - START;
    const size = mins <= 15 ? "xs" : mins < 60 ? "s" : "m";
    const cost = kind === "focus" ? "" : gbp(costOf(mins, people));
    html += `<div class="ev ev-${size}${kind ? " ev-" + kind : ""}" style="--at:${at};--len:${mins / 60}" title="${title} · ${people} ${people === 1 ? "person" : "people"}${cost ? " · " + cost : ""}">
      <span class="ev-title">${kind === "xmas" ? "🎄 " : ""}${title}</span>
      ${kind === "focus" ? "" : `<span class="ev-meta"><span>${people} ${people === 1 ? "person" : "people"}</span><b>${cost}</b></span>`}
    </div>`;
  });
  if (i === 2) html += '<span class="scrawl">declined: plant rota</span>';
  html += "</div></div>";
});
cal.innerHTML = html;

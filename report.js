import { COUNTRIES, LOCATIONS } from "./data.js";
import * as calc from "./calc.js";
import { encode, readMeetingHash } from "./share.js";

const $ = (s) => document.querySelector(s);
const { fmtTime, formatMoney } = calc;
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);

// What the meeting's money could have bought, in each country's own prices.
// Items with `people` are costed from the meeting's own salary assumptions.
const THINGS = {
  UK: {
    none: "Not quite enough for a sausage roll. Short and sweet.",
    items: [
      { icon: "🥐", one: "sausage roll", price: 1.4 },
      { icon: "☕", one: "flat white", price: 3.6 },
      { icon: "🍺", one: "pint", price: 5.5 },
      { icon: "📚", one: "paperback", price: 10 },
      { icon: "🎟️", one: "cinema ticket", price: 12 },
      { icon: "🍕", one: "takeaway pizza", price: 18 },
      { icon: "☁️", one: "month of a small cloud server", many: "months of a small cloud server", price: 25 },
      { icon: "🧪", one: "user research participant thanked with a £40 voucher", many: "user research participants thanked with a £40 voucher", price: 40 },
      { icon: "🧑‍💻", one: "hour of a graduate developer's time", many: "hours of a graduate developer's time", people: { role: "Graduate / Intern", days: 0 } },
      { icon: "🧑‍🔧", one: "day of a senior engineer's time", many: "days of a senior engineer's time", people: { role: "Senior Software Engineer", days: 1 } },
      { icon: "✈️", one: "return flight to Amsterdam", many: "return flights to Amsterdam", price: 120 },
      { icon: "⌨️", one: "mechanical keyboard", price: 120 },
      { icon: "🎧", one: "pair of noise-cancelling headphones", many: "pairs of noise-cancelling headphones", price: 300 },
      { icon: "🎤", one: "conference ticket", price: 500 },
      { icon: "💻", one: "MacBook Air", price: 999 },
      { icon: "🏕️", one: "team away day", price: 2500 },
    ],
  },
  US: {
    none: "Not quite enough for a Costco hot dog. Short and sweet.",
    items: [
      { icon: "🌭", one: "Costco hot dog and soda", many: "Costco hot dogs and sodas", price: 1.5 },
      { icon: "☕", one: "latte", price: 5.75 },
      { icon: "🍺", one: "craft beer", price: 8 },
      { icon: "🎟️", one: "movie ticket", price: 16 },
      { icon: "📚", one: "paperback", price: 18 },
      { icon: "🍕", one: "large pizza", price: 22 },
      { icon: "☁️", one: "month of a small cloud server", many: "months of a small cloud server", price: 30 },
      { icon: "🧪", one: "user research participant thanked with a $50 gift card", many: "user research participants thanked with a $50 gift card", price: 50 },
      { icon: "🧑‍💻", one: "hour of an entry-level developer's time", many: "hours of an entry-level developer's time", people: { role: "Graduate / Intern", days: 0 } },
      { icon: "🧑‍🔧", one: "day of a senior engineer's time", many: "days of a senior engineer's time", people: { role: "Senior Software Engineer", days: 1 } },
      { icon: "⌨️", one: "mechanical keyboard", price: 150 },
      { icon: "✈️", one: "domestic round-trip flight", many: "domestic round-trip flights", price: 350 },
      { icon: "🎧", one: "pair of noise-cancelling headphones", many: "pairs of noise-cancelling headphones", price: 350 },
      { icon: "🎤", one: "conference ticket", price: 800 },
      { icon: "💻", one: "MacBook Air", price: 999 },
      { icon: "🏕️", one: "team offsite", price: 4000 },
    ],
  },
};

function receiptNumber(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); }
  return (h >>> 0).toString(16).toUpperCase().padStart(8, "0");
}
function barcode(seed) {
  let x = parseInt(seed, 16) || 1;
  const rnd = () => ((x = (x * 1103515245 + 12345) >>> 0) / 2 ** 32);
  let pos = 0, stops = [];
  while (pos < 100) {
    const bar = 0.6 + rnd() * 1.6, gap = 0.5 + rnd() * 1.4;
    stops.push(`var(--receipt-ink) ${pos}% ${pos + bar}%`, `transparent ${pos + bar}% ${pos + bar + gap}%`);
    pos += bar + gap;
  }
  return `linear-gradient(90deg, ${stops.join(",")})`;
}

// ---------- the meeting ----------
let m = null;        // everything worked out about the meeting
let view = null;     // currency the report body is shown in
let rates = null;    // live rates from the meeting's currency, e.g. { USD: 1.31, BTC: 0.0000118 }

function compute(st) {
  const r = st.r;
  const c = calc.country(st);
  const ms = Math.max(1000, r.t || 0);
  const total = r.c / 100;
  const hourly = calc.costPerHour(st);
  const rows = st.rows.map((row) => {
    const each = calc.hourlyRate(st, row);
    const share = hourly ? (each * row.count) / hourly : 0;
    return { ...row, each, salary: calc.rowSalary(st, row), share, cost: total * share };
  }).sort((a, b) => b.cost - a.cost);
  return {
    st, c, rows, total, ms, hourly,
    cur: r.u || c.currency, // the currency it was recorded in, for good
    countryCode: calc.countryCode(st),
    planned: !!r.p, // costed ahead of time from its length, not metered
    mins: ms / 60000,
    people: calc.headcount(st),
    place: LOCATIONS[st.location] ? st.location : c.average,
    start: r.s ? new Date(r.s) : null,
    end: r.s ? new Date(r.s + ms) : null,
  };
}
const native = (n, dp = 0) => formatMoney(n, m.cur, dp);
/** An amount in the currency the reader has chosen to view the report in. */
const shown = (n, dp = 0) => (view === m.cur || !rates?.[view] ? native(n, dp) : formatMoney(n * rates[view], view, dp));
const plural = (n, one, many = one + "s") => `${n.toLocaleString(m.c.locale)} ${n === 1 ? one : many}`;
const time = (d) => d.toLocaleTimeString(m.c.locale, { hour: "numeric", minute: "2-digit" });

function renderReceipt() {
  const { st, rows, total, ms, mins, people, hourly, place, start, end, planned } = m;
  const no = receiptNumber(window.location.hash || JSON.stringify(st));
  const price = (n) => native(n, n < 1000 ? 2 : 0);
  document.title = planned ? `${price(total)} meeting estimate · Meeting Report` : `${price(total)} meeting · Meeting Report`;
  if (planned) {
    $("#rSub").textContent = "Estimate for a planned meeting";
    $("#rThanks").innerHTML = "There's still time to<br>send an email instead.";
    $("#hShorter").textContent = "If it were shorter";
    $("#hInstead").textContent = "What that money could buy";
  }
  $("#meta").innerHTML = [
    start ? `<div><span>Date</span><span>${start.toLocaleDateString(m.c.locale, { weekday: "short", day: "numeric", month: "short", year: "numeric" })}</span></div>` : "",
    start ? `<div><span>Time</span><span>${time(start)} – ${time(end)}</span></div>` : "",
    `<div><span>Duration</span><span>${fmtTime(ms)}</span></div>`,
    `<div><span>Location</span><span>${esc(place)}</span></div>`,
  ].join("");
  $("#items").innerHTML = rows.map((row) => `
    <li>
      <div class="r-line"><span>${row.count} × ${esc(row.role)}</span><span>${native(row.cost, 2)}</span></div>
      <div class="r-detail">@ ${native(row.each, 2)}/hr each · ${native(row.salary)} salary</div>
    </li>`).join("");
  $("#sums").innerHTML = [
    ["People", people],
    ["Per minute", native(total / mins, 2)],
    ["Per hour", native(hourly, 2)],
    ["Per person", native(total / people, 2)],
    ["Cost basis", st.mode === "salary" ? "Salary only" : "True cost"],
  ].map(([k, v]) => `<div><dt>${k}</dt><dd>${v}</dd></div>`).join("");
  $("#total").textContent = native(total, 2);
  $("#receiptNo").textContent = `No. ${no}`;
  $("#barcode").style.backgroundImage = barcode(no);
}

function renderBody() {
  const { st, c, rows, total, ms, mins, people, hourly, place, start, planned } = m;
  const perMs = total / ms;
  const minsLabel = mins < 1 ? `${Math.round(ms / 1000)}-second` : `${Math.round(mins)}-minute`;

  // ---- headline ----
  $("#lede").innerHTML =
    `This ${minsLabel} meeting of ${plural(people, "person", "people")} in ${esc(place)} ${planned ? "will cost" : "cost"} <strong>${shown(total, 2)}</strong>` +
    (start ? `, starting at ${time(start)} on ${start.toLocaleDateString(c.locale, { weekday: "long", day: "numeric", month: "long" })}.` : ".");
  $("#kpis").innerHTML = [
    [shown(total / mins, 2), "every minute"],
    [shown(total / people, 2), "per person"],
    [shown(hourly), "per hour at this size"],
  ].map(([v, k]) => `<div class="kpi"><strong>${v}</strong><span>${k}</span></div>`).join("");

  // ---- chart ----
  const maxCost = rows[0]?.cost || 1;
  $("#chart").innerHTML = rows.map((row, i) => `
    <div class="c-row" role="listitem" tabindex="0" data-i="${i}">
      <span class="c-label">${esc(row.role)}${row.count > 1 ? ` <em>× ${row.count}</em>` : ""}</span>
      <span class="c-track"><span class="c-bar" style="--w:${(row.cost / maxCost) * 100}%"></span></span>
      <span class="c-value">${shown(row.cost, 2)}</span>
    </div>`).join("");
  const tip = $("#tooltip");
  const showTip = (el, x, y) => {
    const row = rows[el.dataset.i];
    tip.innerHTML = `<strong>${esc(row.role)}${row.count > 1 ? ` × ${row.count}` : ""}</strong>` +
      `<span>${shown(row.cost, 2)} · ${Math.round(row.share * 100)}% of the bill</span>` +
      `<span>${shown(row.each, 2)} an hour each</span>`;
    tip.hidden = false;
    const box = tip.parentElement.getBoundingClientRect();
    const tx = Math.min(Math.max(x - box.left + 12, 0), box.width - tip.offsetWidth);
    tip.style.transform = `translate(${tx}px, ${y - box.top + 14}px)`;
  };
  $("#chart").querySelectorAll(".c-row").forEach((el) => {
    el.addEventListener("pointermove", (e) => showTip(el, e.clientX, e.clientY));
    el.addEventListener("pointerleave", () => (tip.hidden = true));
    el.addEventListener("focus", () => { const b = el.getBoundingClientRect(); showTip(el, b.left + b.width / 3, b.bottom - 6); });
    el.addEventListener("blur", () => (tip.hidden = true));
  });

  // ---- shorter ----
  const top = rows.reduce((a, b) => (b.each > a.each ? b : a), rows[0]);
  const scenarios = [];
  if (mins > 12) scenarios.push(["10 minutes shorter", perMs * 600000]);
  if (mins > 20) scenarios.push(["15 minutes shorter", perMs * 900000]);
  if (mins >= 2) scenarios.push(["Half the length", total / 2]);
  if (people > 1 && hourly) scenarios.push([`Without one ${top.role}`, total * (top.each / hourly)]);
  if (people > 2) {
    const n = Math.floor(people / 2);
    const cheapest = rows.flatMap((r) => Array(r.count).fill(r.each)).sort((a, b) => a - b).slice(0, n).reduce((a, b) => a + b, 0);
    scenarios.push([`Only the ${plural(people - n, "person", "people")} who needed to be there`, total * (cheapest / hourly)]);
  }
  scenarios.push(["An email instead", total]);
  $("#savings").innerHTML = scenarios.map(([label, saved]) => `
    <li>
      <span class="s-label">${esc(label)}</span>
      <span class="s-meter" aria-hidden="true"><span style="--w:${Math.min(100, (saved / total) * 100)}%"></span></span>
      <span class="s-value"><strong>${shown(saved, 2)}</strong> saved</span>
    </li>`).join("");

  // ---- recurring ----
  const weeks = calc.weeksPerYear(st);
  $("#recurring").innerHTML = [
    ["Working day", weeks * 5],
    ["Week", weeks],
    ["Fortnight", weeks / 2],
    ["Month", 12],
  ].map(([k, n]) => `<div class="kpi"><strong>${shown(total * n)}</strong><span>a year if held every ${k.toLowerCase()}</span></div>`).join("");
  $("#recurNote").textContent = `Based on ${Math.round(weeks)} working weeks a year.`;

  // ---- instead (always counted in the meeting's own prices) ----
  const things = THINGS[m.countryCode] || THINGS.UK;
  const priced = things.items.map((t) => {
    const price = t.people
      ? calc.hourlyRate(st, { role: t.people.role, count: 1, salary: null }) * (t.people.days ? (c.weekHours / 5) * t.people.days : 1)
      : t.price;
    return { ...t, price, n: Math.floor(total / price) };
  }).filter((t) => t.n >= 1).sort((a, b) => b.price - a.price).slice(0, 6);
  $("#instead").innerHTML = priced.length
    ? priced.map((t) => `<li><span class="i-icon" aria-hidden="true">${t.icon}</span><span class="i-n">${t.n.toLocaleString(c.locale)}</span><span class="i-what">${esc(t.n === 1 ? t.one : (t.many || t.one + "s"))}</span></li>`).join("")
    : `<li class="i-none">${things.none}</li>`;
  $("#insteadNote").textContent = `Rough ${m.countryCode === "US" ? "US" : "UK"} prices. People-time is costed with the same assumptions as the meeting.`;

  $("#assumptions").textContent =
    `Salaries are rough estimates for each role in the ${c.name === "United States" ? "US" : "UK"}, adjusted by city. ` +
    (st.mode === "salary" ? "Costs use salary only. " : `True cost adds ${c.onCostNote}. `) +
    `Hourly rates assume ${c.hoursNote}.` +
    (view !== m.cur && rates ? ` Converted from ${m.cur} at live Coinbase rates; the meeting itself is recorded in ${m.cur}.` : "");
}

// ---------- show in another currency ----------
function renderSwitch() {
  const others = [m.cur === "USD" ? "GBP" : "USD", "BTC"];
  const label = { GBP: "£ GBP", USD: "$ USD", BTC: "₿ BTC" };
  $("#curSwitch").innerHTML = [m.cur, ...others].map((code) =>
    `<button type="button" data-cur="${code}" aria-pressed="${code === view}" ${code !== m.cur && !rates ? "disabled" : ""}>${label[code]}</button>`).join("");
  $("#curSwitch").querySelectorAll("button").forEach((b) => b.addEventListener("click", () => {
    view = b.dataset.cur;
    renderSwitch();
    renderBody();
  }));
}
async function loadRates() {
  const note = $("#curNote");
  try {
    const res = await fetch(`https://api.coinbase.com/v2/exchange-rates?currency=${m.cur}`);
    if (!res.ok) throw new Error(res.status);
    const { data } = await res.json();
    const next = {};
    for (const code of ["GBP", "USD", "BTC"]) if (code !== m.cur) next[code] = Number(data.rates[code]);
    if (!Object.values(next).every(Number.isFinite)) throw new Error("bad rates");
    rates = next;
    note.textContent = `Recorded in ${m.cur}. Other currencies use live Coinbase rates from ${new Date().toLocaleTimeString(m.c.locale, { hour: "numeric", minute: "2-digit" })}.`;
  } catch {
    note.textContent = `Recorded in ${m.cur}. Other currencies are unavailable right now.`;
  }
  renderSwitch();
}

function render(st) {
  m = compute(st);
  view = m.cur;
  renderReceipt();
  renderBody();
  renderSwitch();
  loadRates();
  $("#back").href = "calculator.html#m=" + encode(st);
}

// ---------- receipt sharing ----------
const isSafari = /AppleWebKit/.test(navigator.userAgent) && !/Chrome|CriOS|Android/.test(navigator.userAgent);
let imagePromise = null;

async function makeReceiptImage() {
  const node = $("#receipt");
  node.style.animation = "none"; // make sure the "printing" reveal isn't mid-way
  await document.fonts?.ready;
  const opts = { pixelRatio: 2, backgroundColor: undefined };
  if (isSafari) await window.htmlToImage.toBlob(node, opts); // Safari needs a warm-up pass to embed fonts
  const raw = await window.htmlToImage.toBlob(node, opts);
  const blob = await onBackdrop(raw);
  return new File([blob], `meeting-receipt-${$("#receiptNo").textContent.replace(/\W/g, "")}.png`, { type: "image/png" });
}
// Sit the receipt on the page's cream backdrop with some breathing room.
async function onBackdrop(blob) {
  const img = await createImageBitmap(blob);
  const pad = 64;
  const canvas = document.createElement("canvas");
  canvas.width = img.width + pad * 2;
  canvas.height = img.height + pad * 2;
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = "#f4f1ea";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.shadowColor = "rgba(40, 30, 10, 0.25)";
  ctx.shadowBlur = 36;
  ctx.shadowOffsetY = 18;
  ctx.drawImage(img, pad, pad);
  return new Promise((resolve) => canvas.toBlob(resolve, "image/png"));
}
// Render the image ahead of time so sharing it happens straight from the tap
// (mobile browsers only allow the share sheet right after a user gesture).
function prepareImage() {
  if (!imagePromise && window.htmlToImage) imagePromise = makeReceiptImage().catch(() => (imagePromise = null));
  return imagePromise;
}
function flash(btn, text) {
  const o = btn.textContent;
  btn.textContent = text;
  setTimeout(() => (btn.textContent = o), 1800);
}

function init() {
  const st = readMeetingHash();
  if (!st?.r?.c) { $("#empty").hidden = false; return; }
  const receiptOnly = new URLSearchParams(location.search).get("view") === "receipt";
  document.body.classList.toggle("receipt-only", receiptOnly);
  $("#report").hidden = false;
  render(st);
  const total = native(m.total, 2);
  const planned = !!st.r.p;
  if (receiptOnly) document.title = planned ? `${total} meeting estimate` : `${total} meeting receipt`;

  const base = location.origin + location.pathname;
  const receiptUrl = base + "?view=receipt" + location.hash;
  $("#fullReport").href = base + location.hash;

  $("#shareReceipt").addEventListener("click", async (e) => {
    if (navigator.share) {
      try { await navigator.share({ title: "Meeting receipt", text: planned ? `This meeting will cost ${total}.` : `This meeting cost ${total}.`, url: receiptUrl }); } catch {}
      return;
    }
    try { await navigator.clipboard.writeText(receiptUrl); flash(e.target, "Link copied!"); } catch {}
  });
  $("#saveImage").addEventListener("click", async (e) => {
    const btn = e.target;
    const file = await prepareImage();
    if (!file) { flash(btn, "Couldn't make the image"); return; }
    if (navigator.canShare?.({ files: [file] })) {
      try { await navigator.share({ files: [file], title: "Meeting receipt" }); return; } catch (err) { if (err.name === "AbortError") return; }
    }
    const a = document.createElement("a");
    a.href = URL.createObjectURL(file);
    a.download = file.name;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 5000);
    flash(btn, "Saved");
  });
  // Wait for the print animation and fonts, then pre-render the image.
  setTimeout(prepareImage, 1700); // after the "printing" reveal
  $("#copy").addEventListener("click", async (e) => {
    try { await navigator.clipboard.writeText(location.href); e.target.textContent = "Copied!"; setTimeout(() => (e.target.textContent = "Copy report link"), 1500); } catch {}
  });
  $("#print").addEventListener("click", () => window.print());
}
init();

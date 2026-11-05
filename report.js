import { LOCATIONS } from "./data.js";
import * as calc from "./calc.js";
import { encode, readMeetingHash } from "./share.js";

const $ = (s) => document.querySelector(s);
const { gbp, fmtTime } = calc;
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
const money = (n) => gbp(n, n < 1000 ? 2 : 0);
const plural = (n, one, many = one + "s") => `${n.toLocaleString("en-GB")} ${n === 1 ? one : many}`;

const WEEKS = 46; // working weeks a year, matching WORKING_HOURS_PER_YEAR

// Rough UK prices. `per` is a function for items costed from the meeting's own data.
const THINGS = [
  { icon: "🥐", one: "sausage roll", price: 1.4 },
  { icon: "☕", one: "flat white", price: 3.6 },
  { icon: "🍺", one: "pint", price: 5.5 },
  { icon: "📚", one: "paperback", price: 10 },
  { icon: "🎟️", one: "cinema ticket", price: 12 },
  { icon: "🍕", one: "takeaway pizza", price: 18 },
  { icon: "☁️", one: "month of a small cloud server", many: "months of a small cloud server", price: 25 },
  { icon: "🧪", one: "user research participant thanked with a £40 voucher", many: "user research participants thanked with a £40 voucher", price: 40 },
  { icon: "🧑‍💻", one: "hour of a graduate developer's time", many: "hours of a graduate developer's time", people: { role: "Graduate / Intern", hours: 1 } },
  { icon: "🧑‍🔧", one: "day of a senior engineer's time", many: "days of a senior engineer's time", people: { role: "Senior Software Engineer", hours: 7.5 } },
  { icon: "✈️", one: "return flight to Amsterdam", many: "return flights to Amsterdam", price: 120 },
  { icon: "⌨️", one: "mechanical keyboard", price: 120 },
  { icon: "🎧", one: "pair of noise-cancelling headphones", many: "pairs of noise-cancelling headphones", price: 300 },
  { icon: "🎤", one: "conference ticket", price: 500 },
  { icon: "💻", one: "MacBook Air", price: 999 },
  { icon: "🏕️", one: "team away day", price: 2500 },
];

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

function render(st) {
  const r = st.r;
  const total = r.c / 100;
  const ms = Math.max(1000, r.t || 0);
  const mins = ms / 60000;
  const perMs = total / ms;
  const people = calc.headcount(st);
  const hourly = calc.costPerHour(st);
  const place = LOCATIONS[st.location] ? st.location : "UK average";

  const rows = st.rows.map((row) => {
    const each = calc.hourlyRate(st, row);
    const share = hourly ? (each * row.count) / hourly : 0;
    return { ...row, each, salary: calc.rowSalary(st, row), share, cost: total * share };
  }).sort((a, b) => b.cost - a.cost);

  const start = r.s ? new Date(r.s) : null;
  const end = start ? new Date(r.s + ms) : null;
  const time = (d) => d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
  const minsLabel = mins < 1 ? `${Math.round(ms / 1000)}-second` : `${Math.round(mins)}-minute`;

  document.title = `${money(total)} meeting · Meeting Report`;

  // ---- receipt ----
  const no = receiptNumber(window.location.hash || JSON.stringify(st));
  $("#meta").innerHTML = [
    start ? `<div><span>Date</span><span>${start.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short", year: "numeric" })}</span></div>` : "",
    start ? `<div><span>Time</span><span>${time(start)} – ${time(end)}</span></div>` : "",
    `<div><span>Duration</span><span>${fmtTime(ms)}</span></div>`,
    `<div><span>Location</span><span>${esc(place)}</span></div>`,
  ].join("");
  $("#items").innerHTML = rows.map((row) => `
    <li>
      <div class="r-line"><span>${row.count} × ${esc(row.role)}</span><span>${gbp(row.cost, 2)}</span></div>
      <div class="r-detail">@ ${gbp(row.each, 2)}/hr each · ${gbp(row.salary)} salary</div>
    </li>`).join("");
  $("#sums").innerHTML = [
    ["People", people],
    ["Per minute", gbp(total / mins, 2)],
    ["Per hour", gbp(hourly, 2)],
    ["Per person", gbp(total / people, 2)],
    ["Cost basis", st.mode === "salary" ? "Salary only" : "True cost"],
  ].map(([k, v]) => `<div><dt>${k}</dt><dd>${v}</dd></div>`).join("");
  $("#total").textContent = gbp(total, 2);
  $("#receiptNo").textContent = `No. ${no}`;
  $("#barcode").style.backgroundImage = barcode(no);

  // ---- headline ----
  $("#lede").innerHTML =
    `This ${minsLabel} meeting of ${plural(people, "person", "people")} in ${esc(place)} cost <strong>${gbp(total, 2)}</strong>` +
    (start ? `, starting at ${time(start)} on ${start.toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" })}.` : ".");
  $("#kpis").innerHTML = [
    [gbp(total / mins, 2), "every minute"],
    [gbp(total / people, 2), "per person"],
    [gbp(hourly), "per hour at this size"],
  ].map(([v, k]) => `<div class="kpi"><strong>${v}</strong><span>${k}</span></div>`).join("");

  // ---- chart ----
  const maxCost = rows[0]?.cost || 1;
  $("#chart").innerHTML = rows.map((row, i) => `
    <div class="c-row" role="listitem" tabindex="0" data-i="${i}">
      <span class="c-label">${esc(row.role)}${row.count > 1 ? ` <em>× ${row.count}</em>` : ""}</span>
      <span class="c-track"><span class="c-bar" style="--w:${(row.cost / maxCost) * 100}%"></span></span>
      <span class="c-value">${gbp(row.cost, 2)}</span>
    </div>`).join("");
  const tip = $("#tooltip");
  const showTip = (el, x, y) => {
    const row = rows[el.dataset.i];
    tip.innerHTML = `<strong>${esc(row.role)}${row.count > 1 ? ` × ${row.count}` : ""}</strong>` +
      `<span>${gbp(row.cost, 2)} · ${Math.round(row.share * 100)}% of the bill</span>` +
      `<span>${gbp(row.each, 2)} an hour each</span>`;
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
      <span class="s-value"><strong>${gbp(saved, 2)}</strong> saved</span>
    </li>`).join("");

  // ---- recurring ----
  $("#recurring").innerHTML = [
    ["Working day", WEEKS * 5],
    ["Week", WEEKS],
    ["Fortnight", WEEKS / 2],
    ["Month", 12],
  ].map(([k, n]) => `<div class="kpi"><strong>${gbp(total * n)}</strong><span>a year if held every ${k.toLowerCase()}</span></div>`).join("");

  // ---- instead ----
  const priced = THINGS.map((t) => {
    const price = t.people
      ? calc.hourlyRate(st, { role: t.people.role, count: 1, salary: null }) * t.people.hours
      : t.price;
    return { ...t, price, n: Math.floor(total / price) };
  }).filter((t) => t.n >= 1).sort((a, b) => b.price - a.price).slice(0, 6);
  $("#instead").innerHTML = priced.length
    ? priced.map((t) => `<li><span class="i-icon" aria-hidden="true">${t.icon}</span><span class="i-n">${t.n.toLocaleString("en-GB")}</span><span class="i-what">${esc(t.n === 1 ? t.one : (t.many || t.one + "s"))}</span></li>`).join("")
    : `<li class="i-none">Not quite enough for a sausage roll. Short and sweet.</li>`;

  $("#assumptions").textContent =
    "Salaries are rough UK estimates for each role, adjusted for location. " +
    (st.mode === "salary" ? "Costs use salary only. " : "True cost adds 15% employer NI above £5,000, 5% pension and 10% overheads. ") +
    "Hourly rates assume 1,725 working hours a year.";

  $("#back").href = "calculator.html#m=" + encode(st);
  return loadRates(total);
}

async function loadRates(total) {
  const fx = $("#fx"), note = $("#fxNote");
  try {
    const res = await fetch("https://api.coinbase.com/v2/exchange-rates?currency=GBP");
    if (!res.ok) throw new Error(res.status);
    const { data } = await res.json();
    const usd = total * Number(data.rates.USD);
    const btc = total * Number(data.rates.BTC);
    if (!Number.isFinite(usd) || !Number.isFinite(btc)) throw new Error("bad rates");
    const sats = Math.round(btc * 1e8);
    fx.innerHTML =
      `<div><dt>USD</dt><dd>${usd.toLocaleString("en-US", { style: "currency", currency: "USD" })}</dd></div>` +
      `<div><dt>BTC</dt><dd>₿${btc.toFixed(8)}</dd></div>` +
      `<div class="sats"><dt></dt><dd>${sats.toLocaleString("en-GB")} sats</dd></div>`;
    note.textContent = `Live rates from Coinbase, ${new Date().toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}`;
  } catch {
    fx.innerHTML = "";
    note.textContent = "USD and BTC rates are unavailable right now. Refresh to try again.";
  }
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
  const ratesLoaded = render(st);
  const total = gbp(st.r.c / 100, 2);
  if (receiptOnly) document.title = `${total} meeting receipt`;

  const base = location.origin + location.pathname;
  const receiptUrl = base + "?view=receipt" + location.hash;
  $("#fullReport").href = base + location.hash;

  $("#shareReceipt").addEventListener("click", async (e) => {
    if (navigator.share) {
      try { await navigator.share({ title: "Meeting receipt", text: `This meeting cost ${total}.`, url: receiptUrl }); } catch {}
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
  Promise.all([ratesLoaded, new Promise((r) => setTimeout(r, 1700))]).then(prepareImage);
  $("#copy").addEventListener("click", async (e) => {
    try { await navigator.clipboard.writeText(location.href); e.target.textContent = "Copied!"; setTimeout(() => (e.target.textContent = "Copy report link"), 1500); } catch {}
  });
  $("#print").addEventListener("click", () => window.print());
}
init();

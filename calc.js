// Pure cost maths shared by the calculator, report and landing page.
import { COUNTRIES, LOCATIONS, ROLE_ALIASES } from "./data.js";

// ---------- country ----------
export const countryCode = (state) => LOCATIONS[state.location]?.country || "UK";
export const country = (state) => COUNTRIES[countryCode(state)];

// ---------- salaries and costs ----------
export function baseSalary(state, role) {
  const roles = country(state).roles;
  const name = String(role).trim().toLowerCase();
  const find = (n) => Object.keys(roles).find((r) => r.toLowerCase() === n);
  const key = find(name) || (ROLE_ALIASES[name] && find(ROLE_ALIASES[name].toLowerCase()));
  return key ? roles[key] : country(state).defaultSalary;
}
export function rowSalary(state, row) {
  if (row.salary != null) return row.salary;
  const raw = baseSalary(state, row.role) * (LOCATIONS[state.location]?.m ?? 1);
  return Math.round(raw / 500) * 500;
}
export function annualCost(state, salary) {
  if (state.mode === "salary") return salary;
  return salary + country(state).onCost(salary);
}
/** Cost per hour of one person in this row. */
export function hourlyRate(state, row) {
  return annualCost(state, rowSalary(state, row)) / country(state).hoursPerYear;
}
export function costPerHour(state) {
  return state.rows.reduce((t, r) => t + hourlyRate(state, r) * r.count, 0);
}
export const headcount = (state) => state.rows.reduce((t, r) => t + r.count, 0);
/** Working weeks a year, for "if it happens every week" maths. */
export const weeksPerYear = (state) => country(state).hoursPerYear / country(state).weekHours;

// ---------- formatting ----------
const LOCALE = { GBP: "en-GB", USD: "en-US" };
export function formatMoney(n, currency, dp = 0) {
  if (currency === "BTC") {
    const places = Math.abs(n) >= 1 ? 4 : Math.abs(n) >= 0.01 ? 6 : 8;
    return "₿" + n.toFixed(places);
  }
  return n.toLocaleString(LOCALE[currency] || "en-GB", { style: "currency", currency, minimumFractionDigits: dp, maximumFractionDigits: dp });
}
/** Format an amount in the meeting's own currency. */
export const money = (state, n, dp = 0) => formatMoney(n, country(state).currency, dp);

export function fmtTime(ms) {
  const s = Math.floor(ms / 1000);
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = s % 60;
  const pad = (n) => String(n).padStart(2, "0");
  return h ? `${h}:${pad(m)}:${pad(sec)}` : `${pad(m)}:${pad(sec)}`;
}

// ---------- location ----------
const US_ZONES = /^(America\/(New_York|Chicago|Denver|Los_Angeles|Phoenix|Anchorage|Detroit|Boise|Juneau|Sitka|Nome|Adak|Yakutat|Metlakatla|Menominee|Indiana\/.+|Kentucky\/.+|North_Dakota\/.+)|Pacific\/Honolulu)$/;
/** A sensible starting place from the browser's time zone: no prompt, nothing sent anywhere. */
export function locationFromTimeZone() {
  let tz = "";
  try { tz = Intl.DateTimeFormat().resolvedOptions().timeZone || ""; } catch {}
  return US_ZONES.test(tz) ? COUNTRIES.US.average : COUNTRIES.UK.average;
}
function km(lat1, lon1, lat2, lon2) {
  const rad = Math.PI / 180;
  const a = Math.sin(((lat2 - lat1) * rad) / 2) ** 2 +
    Math.cos(lat1 * rad) * Math.cos(lat2 * rad) * Math.sin(((lon2 - lon1) * rad) / 2) ** 2;
  return 12742 * Math.asin(Math.sqrt(a));
}
/**
 * The major city whose area you're in. Bigger cities reach further, so somewhere
 * like Milton Keynes lands on London rather than the slightly closer Oxford.
 * Returns null when you're nowhere near a covered country.
 */
export function nearestLocation(lat, lon) {
  let best = null;
  for (const [name, c] of Object.entries(LOCATIONS)) {
    if (c.lat == null) continue;
    const d = km(lat, lon, c.lat, c.lon);
    const score = d / c.r;
    if (!best || score < best.score) best = { name, d, score, country: c.country };
  }
  if (!best) return null;
  if (best.score <= 2) return best.name;
  if (best.d <= 1200) return COUNTRIES[best.country].average; // in the country, just not near a big city
  return null;
}

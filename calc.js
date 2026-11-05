// Pure cost maths shared by the calculator and the report.
import {
  ROLES, LOCATIONS, DEFAULT_SALARY,
  EMPLOYER_NI_RATE, EMPLOYER_NI_THRESHOLD, EMPLOYER_PENSION_RATE, OVERHEAD_RATE,
  WORKING_HOURS_PER_YEAR,
} from "./data.js";

export function baseSalary(role) {
  const key = Object.keys(ROLES).find((r) => r.toLowerCase() === String(role).trim().toLowerCase());
  return key ? ROLES[key] : DEFAULT_SALARY;
}
export function rowSalary(state, row) {
  if (row.salary != null) return row.salary;
  const raw = baseSalary(row.role) * (LOCATIONS[state.location] ?? 1);
  return Math.round(raw / 500) * 500;
}
export function annualCost(state, salary) {
  if (state.mode === "salary") return salary;
  const ni = Math.max(0, salary - EMPLOYER_NI_THRESHOLD) * EMPLOYER_NI_RATE;
  return salary + ni + salary * EMPLOYER_PENSION_RATE + salary * OVERHEAD_RATE;
}
/** Cost per hour of one person in this row. */
export function hourlyRate(state, row) {
  return annualCost(state, rowSalary(state, row)) / WORKING_HOURS_PER_YEAR;
}
export function costPerHour(state) {
  return state.rows.reduce((t, r) => t + hourlyRate(state, r) * r.count, 0);
}
export const headcount = (state) => state.rows.reduce((t, r) => t + r.count, 0);

export const gbp = (n, dp = 0) =>
  n.toLocaleString("en-GB", { style: "currency", currency: "GBP", minimumFractionDigits: dp, maximumFractionDigits: dp });

export function fmtTime(ms) {
  const s = Math.floor(ms / 1000);
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = s % 60;
  const pad = (n) => String(n).padStart(2, "0");
  return h ? `${h}:${pad(m)}:${pad(sec)}` : `${pad(m)}:${pad(sec)}`;
}

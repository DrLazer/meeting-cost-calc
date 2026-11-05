// Salary and employment-cost assumptions, per country.
// Every salary is a rough estimate for fun, and every figure is editable in the app.
// A meeting is always costed in its own country's currency and never converted on save.

// ---------- United Kingdom ----------
// Approximate national salaries (GBP, 2025/26).
const UK_ROLES = {
  "Software Engineer": 55000,
  "Senior Software Engineer": 70000,
  "Tech Lead": 80000,
  "Engineering Manager": 85000,
  "Solution Architect": 85000,
  "DevOps Engineer": 62000,
  "QA / Test Engineer": 45000,
  "Data Engineer": 60000,
  "Data Scientist": 58000,
  "Data Analyst": 40000,
  "Product Manager": 62000,
  "Product Owner": 55000,
  "Project Manager": 50000,
  "Delivery Manager": 58000,
  "Programme Manager": 70000,
  "Scrum Master": 55000,
  "Business Analyst": 48000,
  "Service Designer": 55000,
  "User Researcher": 50000,
  "UX / UI Designer": 47000,
  "Content Designer": 45000,
  "Consultant": 55000,
  "Head of Department": 95000,
  "Director": 110000,
  "CTO": 130000,
  "CEO": 150000,
  "HR Business Partner": 45000,
  "Marketing Manager": 48000,
  "Sales Manager": 55000,
  "Account Manager": 38000,
  "Accountant": 45000,
  "Lawyer": 75000,
  "Office Coordinator": 28000,
  "Graduate / Intern": 28000,
};

// m: salary multiplier against the national figure.
// lat/lon/r: centre and rough catchment radius (km), used to find the nearest city.
const UK_CITIES = {
  "UK average": { m: 1.0 },
  "London": { m: 1.25, lat: 51.51, lon: -0.13, r: 110 },
  "Cambridge": { m: 1.06, lat: 52.21, lon: 0.12, r: 30 },
  "Oxford": { m: 1.05, lat: 51.75, lon: -1.26, r: 30 },
  "Reading": { m: 1.05, lat: 51.45, lon: -0.97, r: 30 },
  "Bristol": { m: 1.0, lat: 51.45, lon: -2.59, r: 50 },
  "Edinburgh": { m: 0.98, lat: 55.95, lon: -3.19, r: 50 },
  "Manchester": { m: 0.95, lat: 53.48, lon: -2.24, r: 60 },
  "Birmingham": { m: 0.95, lat: 52.49, lon: -1.89, r: 60 },
  "Leeds": { m: 0.93, lat: 53.8, lon: -1.55, r: 45 },
  "Glasgow": { m: 0.92, lat: 55.86, lon: -4.25, r: 50 },
  "Liverpool": { m: 0.9, lat: 53.41, lon: -2.98, r: 40 },
  "Nottingham": { m: 0.89, lat: 52.95, lon: -1.15, r: 40 },
  "Sheffield": { m: 0.88, lat: 53.38, lon: -1.47, r: 40 },
  "Cardiff": { m: 0.88, lat: 51.48, lon: -3.18, r: 50 },
  "Newcastle": { m: 0.87, lat: 54.98, lon: -1.62, r: 50 },
  "Belfast": { m: 0.85, lat: 54.6, lon: -5.93, r: 60 },
};

// ---------- United States ----------
// Approximate national salaries (USD), informed by Bureau of Labor Statistics
// May 2024 median wages where an occupation matches (e.g. software developers $133,080).
const US_ROLES = {
  "Software Engineer": 133000,
  "Senior Software Engineer": 165000,
  "Tech Lead": 180000,
  "Engineering Manager": 190000,
  "Solution Architect": 160000,
  "DevOps Engineer": 130000,
  "QA / Test Engineer": 102000,
  "Data Engineer": 130000,
  "Data Scientist": 112000,
  "Data Analyst": 80000,
  "Product Manager": 150000,
  "Product Owner": 125000,
  "Project Manager": 100000,
  "Delivery Manager": 120000,
  "Program Manager": 145000,
  "Scrum Master": 115000,
  "Business Analyst": 100000,
  "Service Designer": 120000,
  "User Researcher": 125000,
  "UX / UI Designer": 100000,
  "Content Designer": 100000,
  "Consultant": 100000,
  "Head of Department": 190000,
  "Director": 220000,
  "CTO": 280000,
  "CEO": 250000,
  "HR Business Partner": 100000,
  "Marketing Manager": 160000,
  "Sales Manager": 138000,
  "Account Manager": 80000,
  "Accountant": 82000,
  "Lawyer": 151000,
  "Office Coordinator": 48000,
  "Graduate / Intern": 65000,
};

// City differences follow the 2026 federal GS locality pay rates (OPM), relative to
// a typical metro (27% locality), e.g. San Jose–San Francisco 46.34%, New York 37.95%.
const loc = (pct) => Math.round(((1 + pct / 100) / 1.27) * 100) / 100;
const US_CITIES = {
  "US average": { m: 1.0 },
  "San Francisco Bay Area": { m: loc(46.34), lat: 37.6, lon: -122.2, r: 90 },
  "New York": { m: loc(37.95), lat: 40.71, lon: -74.01, r: 120 },
  "Los Angeles": { m: loc(36.47), lat: 34.05, lon: -118.24, r: 110 },
  "Houston": { m: loc(35.0), lat: 29.76, lon: -95.37, r: 90 },
  "Washington DC": { m: loc(33.94), lat: 38.91, lon: -77.04, r: 100 },
  "San Diego": { m: loc(33.72), lat: 32.72, lon: -117.16, r: 60 },
  "Boston": { m: loc(32.58), lat: 42.36, lon: -71.06, r: 90 },
  "Seattle": { m: loc(31.57), lat: 47.61, lon: -122.33, r: 80 },
  "Chicago": { m: loc(30.86), lat: 41.88, lon: -87.63, r: 100 },
  "Denver": { m: loc(30.52), lat: 39.74, lon: -104.99, r: 80 },
  "Detroit": { m: loc(29.12), lat: 42.33, lon: -83.05, r: 80 },
  "Philadelphia": { m: loc(28.99), lat: 39.95, lon: -75.17, r: 80 },
  "Minneapolis": { m: loc(27.62), lat: 44.98, lon: -93.27, r: 80 },
  "Dallas": { m: loc(27.26), lat: 32.78, lon: -96.8, r: 100 },
  "Portland": { m: loc(26.13), lat: 45.52, lon: -122.68, r: 70 },
  "Miami": { m: loc(24.67), lat: 25.76, lon: -80.19, r: 90 },
  "Atlanta": { m: loc(23.79), lat: 33.75, lon: -84.39, r: 90 },
  "Raleigh": { m: loc(22.17), lat: 35.78, lon: -78.64, r: 70 },
  "Austin": { m: loc(21.64), lat: 30.27, lon: -97.74, r: 70 },
  "Phoenix": { m: loc(21.26), lat: 33.45, lon: -112.07, r: 90 },
  "Pittsburgh": { m: loc(20.21), lat: 40.44, lon: -80.0, r: 70 },
  "Kansas City": { m: loc(18.97), lat: 39.1, lon: -94.58, r: 70 },
  "Indianapolis": { m: loc(18.15), lat: 39.77, lon: -86.16, r: 70 },
};

// ---------- employment costs ----------
const US_SS_WAGE_BASE = 184500; // 2026 Social Security wage base
const US_HEALTH = 7885; // KFF 2025: $9,325 average single-coverage premium less $1,440 worker share

export const COUNTRIES = {
  UK: {
    name: "United Kingdom",
    currency: "GBP",
    symbol: "£",
    locale: "en-GB",
    average: "UK average",
    roles: UK_ROLES,
    cities: UK_CITIES,
    defaultSalary: 45000,
    weekHours: 37.5,
    hoursPerYear: 37.5 * 46, // 46 working weeks after holidays and bank holidays
    onCost: (s) => Math.max(0, s - 5000) * 0.15 + s * 0.05 + s * 0.1,
    onCostNote: "15% employer NI above £5,000, 5% pension and 10% overheads",
    hoursNote: "1,725 working hours a year (37.5-hour weeks, 46 weeks)",
  },
  US: {
    name: "United States",
    currency: "USD",
    symbol: "$",
    locale: "en-US",
    average: "US average",
    roles: US_ROLES,
    cities: US_CITIES,
    defaultSalary: 90000,
    weekHours: 40,
    hoursPerYear: 2080 - 88 - 80, // 40-hour weeks, less 11 federal holidays and 10 days' PTO
    onCost: (s) => Math.min(s, US_SS_WAGE_BASE) * 0.062 + s * 0.0145 + 42 + US_HEALTH + s * 0.04 + s * 0.1,
    onCostNote: "employer Social Security and Medicare (7.65%), $7,885 average health insurance, a 4% retirement match and 10% overheads",
    hoursNote: "1,912 working hours a year (40-hour weeks, less federal holidays and 10 days' PTO)",
  },
};

// Every place, keyed by name, with its country.
export const LOCATIONS = Object.fromEntries(
  Object.entries(COUNTRIES).flatMap(([code, c]) =>
    Object.entries(c.cities).map(([name, city]) => [name, { ...city, country: code }]))
);

// Titles spelt differently either side of the Atlantic.
export const ROLE_ALIASES = {
  "program manager": "Programme Manager",
  "programme manager": "Program Manager",
};

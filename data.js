// Approximate UK annual salaries (GBP, national median-ish, 2025/26).
// These are rough estimates for fun — every figure is editable in the app.
export const ROLES = {
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

// Regional multiplier against the UK figure above.
export const LOCATIONS = {
  "UK average": 1.0,
  "London": 1.25,
  "Cambridge": 1.06,
  "Oxford": 1.05,
  "Reading": 1.05,
  "Bristol": 1.0,
  "Edinburgh": 0.98,
  "Manchester": 0.95,
  "Birmingham": 0.95,
  "Leeds": 0.93,
  "Glasgow": 0.92,
  "Liverpool": 0.9,
  "Nottingham": 0.89,
  "Sheffield": 0.88,
  "Cardiff": 0.88,
  "Newcastle": 0.87,
  "Belfast": 0.85,
};

export const DEFAULT_SALARY = 45000;

// Employment cost assumptions for "true cost" mode.
export const EMPLOYER_NI_RATE = 0.15;
export const EMPLOYER_NI_THRESHOLD = 5000;
export const EMPLOYER_PENSION_RATE = 0.05;
export const OVERHEAD_RATE = 0.1; // desk, kit, software, management overhead

// 37.5h week × 46 working weeks (after holidays and bank holidays).
export const WORKING_HOURS_PER_YEAR = 37.5 * 46;

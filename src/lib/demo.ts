// Fictional demo accounts created by `pnpm db:seed`. Never real people.
export const demoPassword = "DemoPortal2026!";

export const demoAccounts = [
  { area: "admin", role: "Admin", email: "admin@demo-portal.example", name: "Alex Morgan" },
  { area: "admin", role: "Designer", email: "sam.designer@demo-portal.example", name: "Sam Keller" },
  { area: "admin", role: "Designer", email: "jo.designer@demo-portal.example", name: "Jo Brennan" },
  { area: "portal", role: "Lab owner · Smile Dental Lab", email: "owner@smile-lab.example", name: "Claire Duffy" },
  { area: "portal", role: "Lab staff · Smile Dental Lab", email: "tech@smile-lab.example", name: "Mark O'Neill" },
  { area: "portal", role: "Practice owner · Riverside Dental", email: "owner@riverside-dental.example", name: "Thandi Nkosi" },
  { area: "portal", role: "New lab awaiting approval", email: "owner@northside-studio.example", name: "Priya Shah" },
] as const;

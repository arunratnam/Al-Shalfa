/*
 * EZ Storage Fuel Expense app settings.
 *
 * To go live, paste your Firebase web app settings into `firebase` below
 * (Firebase console → Project settings → Your apps → Web app → SDK setup → Config).
 * While `firebase` is null the app runs in demo mode: data stays on that phone only.
 */
window.EZ_CONFIG = {
  firebase: null,
  // firebase: {
  //   apiKey: "…",
  //   authDomain: "your-project.firebaseapp.com",
  //   projectId: "your-project",
  //   appId: "…"
  // },

  companyName: "EZ Storage",
  formTitle: "Fuel Expense Submission Form",
  docNo: "EZ-OPS-FUEL-002",
  docVersion: "01",
  currency: "KD",
  departments: ["Operations", "Logistics", "Warehouse", "Delivery", "Sales", "Administration"],
  maxReceipts: 30
};

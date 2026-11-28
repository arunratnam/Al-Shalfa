/*
 * EZ Storage Fuel Expense app settings.
 *
 * Connected to the company's Firebase project "ezfuel-20933" (online version: one admin, all drivers).
 * Set `firebase: null` to build the offline version, where data stays on each phone.
 */
window.EZ_CONFIG = {
  firebase: {
    apiKey: "AIzaSyDdahN8JW00Y5_NFOdAHE4qb9r6ms6lJyk",
    authDomain: "ezfuel-20933.firebaseapp.com",
    projectId: "ezfuel-20933",
    storageBucket: "ezfuel-20933.firebasestorage.app",
    messagingSenderId: "996581712381",
    appId: "1:996581712381:web:3d530d3d26d2b04c80f994"
  },

  // Google Maps for the Live map. Restricted in Google Cloud to arunratnam.github.io and the Android app, so it can be public.
  // The admin can replace it in Company settings.
  mapsKey: "AIzaSyAhttQVTyZn6-jDKTcUkfYNS-9nbWuh3dE",

  appName: "EZ Staff",
  companyName: "EZ Storage",
  formTitle: "Fuel Expense Submission Form",
  docNo: "EZ-OPS-FUEL-002",
  docVersion: "01",
  currency: "KD",
  departments: ["Operations", "Logistics", "Warehouse", "Delivery", "Sales", "Administration"],
  maxReceipts: 30
};

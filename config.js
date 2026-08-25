/*
  SHIRT ORDER PRICING
  Customer-facing garment prices below do NOT include printing.
  Print prices are added per shirt.


*/
window.SHIRT_ORDER_CONFIG = {
  currency: "USD",

  // Google Apps Script Web App used to save completed orders.
  googleSheetsUrl: "https://script.google.com/macros/s/AKfycbw95_2HK0WTVDjpOh4muqxxZj2YQ3bkNpfGmgePGaoJoyLeFGyeixE49Pt05kNKezCyqA/exec",
  // Discount codes are validated by Google Apps Script and are not stored publicly.


  products: {
    "Short Sleeve T-Shirt": [
      { brand: "Standard", garmentPrice: 18 }
    ]
  },

  sizes: [
    { name: "Small", upcharge: 0 },
    { name: "Medium", upcharge: 0 },
    { name: "Large", upcharge: 0 },
    { name: "XLarge", upcharge: 0 },
    { name: "2XLarge", upcharge: 3 },
    { name: "3XLarge", upcharge: 3 },
    { name: "4XLarge", upcharge: 3 },
    { name: "5XLarge", upcharge: 3 }
  ],

  printLocations: [],

  payments: {
    venmo: {
      label: "Venmo",
      handle: "@Heather-Hess-108",
      url: ""
    },
    cashapp: {
      label: "Cash App",
      handle: "$Hhess1983",
      url: ""
    },
    cash: {
      label: "Cash",
      handle: "",
      url: ""
    }
  }
};

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
      { brand: "Gildan Light Cotton", garmentPrice: 12 },
      { brand: "Gildan Heavy Cotton", garmentPrice: 12 },
      { brand: "Gildan Soft Style", garmentPrice: 15 },
      { brand: "Port & Co", garmentPrice: 12 },
      { brand: "Comfort Colors", garmentPrice: 12 },
      { brand: "Bella Canvas", garmentPrice: 15 },
      
    ],
    "Long Sleeve T-Shirt": [
      { brand: "Gildan", garmentPrice: 16 },
      { brand: "Comfort Colors", garmentPrice: 19 }
    ],
    "Tank-Top": [
      { brand: "Standard / Best Available", garmentPrice: 11 }
    ],
    "Sweatshirt": [
      { brand: "Gildan", garmentPrice: 22 },
      { brand: "Port & Co", garmentPrice: 22 },
      { brand: "Jerzee", garmentPrice: 22 },
      { brand: "Comfort Colors", garmentPrice: 22 },
      { brand: "Comfort Colors Special Order", garmentPrice: 40 }
    ],
    "Hoodie": [
      { brand: "Standard / Best Available", garmentPrice: 25 }
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

  printLocations: [
    { name: "Full Front", price: 3, cost: 4 },
    { name: "Full Back", price: 5, cost: 5 },
    { name: "Pocket", price: 2, cost: 2 },
    { name: "Sleeve", price: 2, cost: 2 }
  ],

  payments: {
    venmo: {
      label: "Venmo",
      handle: "Payment details provided after order submission",
      url: ""
    },
    cashapp: {
      label: "Cash App",
      handle: "Payment details provided after order submission",
      url: ""
    },
    cash: {
      label: "Cash",
      handle: "",
      url: ""
    }
  }
};

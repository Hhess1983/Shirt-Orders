SHIRT ORDERS - FULLY UPDATED PACKAGE
=====================================

WEBSITE FILES FOR GITHUB
------------------------
Upload these files to the root of your GitHub Pages repository:
- index.html
- styles.css
- script.js
- config.js
- robots.txt

GOOGLE APPS SCRIPT
------------------
The fully updated backend is:
- google-apps-script/Code.gs

Replace the contents of Code.gs in your Apps Script project with that file.

IMPORTANT SECURITY CHANGES
--------------------------
1. The browser sends itemCount, but final merchandise quantity/pricing is recalculated
   by Apps Script from the submitted size/quantity selections.
2. Apps Script ignores the browser's subtotal for final pricing.
3. Apps Script ignores the browser's shipping price/provider/service at final checkout.
4. Apps Script requests a fresh Shippo rate during final order submission.
5. The website requires a successful JSON response from Apps Script before it marks
   an order submitted.
6. Payment instructions use the server-returned final total after submission.
7. Shippo API credentials remain in Apps Script Script Properties, not GitHub.

REQUIRED APPS SCRIPT PROPERTIES
-------------------------------
SHIPPO_TOKEN
SHIP_FROM_NAME
SHIP_FROM_STREET1
SHIP_FROM_STREET2   (optional)
SHIP_FROM_CITY
SHIP_FROM_STATE
SHIP_FROM_ZIP
SHIP_FROM_COUNTRY

Optional parcel settings:
SHIPPO_SHIRT_WEIGHT_OZ
SHIPPO_PACKAGING_WEIGHT_OZ
SHIPPO_PARCEL_LENGTH
SHIPPO_PARCEL_WIDTH
SHIPPO_PARCEL_HEIGHT

CURRENT SIMPLE-SITE PRICING
---------------------------
Short Sleeve T-Shirt: $18
Small through XLarge: no upcharge
2XLarge through 5XLarge: +$3 each

IMPORTANT
---------
The server-side PRODUCT_PRICES and SIZE_UPCHARGES in Code.gs are now authoritative.
If you change website pricing later, change the matching server-side pricing too.

After changing Code.gs:
Deploy > Manage deployments > Edit existing deployment > New version > Deploy.
Keep the same /exec URL.

const cfg = window.SHIRT_ORDER_CONFIG;
const money = new Intl.NumberFormat('en-US', { style: 'currency', currency: cfg.currency || 'USD' });

const els = {
  form: document.getElementById('orderForm'),
  type: document.getElementById('shirtTypeOptions'),
  brand: document.getElementById('brandOptions'),
  sizes: document.getElementById('sizeOptions'),
  locations: document.getElementById('printLocationOptions'),
  payments: document.getElementById('paymentOptions'),
  instructions: document.getElementById('paymentInstructions'),
  total: document.getElementById('grandTotal'),
  lines: document.getElementById('summaryLines'),
  dialog: document.getElementById('reviewDialog'),
  review: document.getElementById('reviewText'),
  discountCode: document.getElementById('discountCode'),
  applyDiscount: document.getElementById('applyDiscount'),
  discountMessage: document.getElementById('discountMessage'),
  mobileTotal: document.getElementById('mobileGrandTotal'),
  viewOrderButton: document.getElementById('viewOrderButton'),
  submitOrder: document.getElementById('submitOrder'),
  submitStatus: document.getElementById('submitStatus'),
  shippingFields: document.getElementById('shippingFields'),
  getShippingRate: document.getElementById('getShippingRate'),
  shippingRateMessage: document.getElementById('shippingRateMessage'),
};

let activeDiscount = null;
let currentOrder = null;
let orderSubmitted = false;
let shippingQuote = null;

function optionPrice(price, prefix = '+') {
  return Number(price) ? `${prefix}${money.format(price)}` : '';
}

function renderTypes() {
  // Single shirt type; selected automatically.
}

function renderBrands(typeName) {
  // Brand selection removed; using the single configured product.
}

function renderSizes() {
  els.sizes.innerHTML = cfg.sizes.map(item => `
    <div class="size-row">
      <label class="option-label">
        <input type="checkbox" name="size" value="${item.name}" data-upcharge="${item.upcharge}">
        <span>${item.name}</span>
        <span class="option-price">${optionPrice(item.upcharge)}</span>
      </label>
      <div class="qty-wrap">
        <span>Qty</span>
        <input type="number" class="size-qty" data-size="${item.name}" min="1" max="99" value="1" disabled inputmode="numeric">
      </div>
    </div>`).join('');
}

function renderPrintLocations() {
  els.locations.innerHTML = cfg.printLocations.map(item => `
    <label class="option-label">
      <input type="checkbox" name="printLocation" value="${item.name}" data-price="${item.price}">
      <span>${item.name}</span>
      <span class="option-price">${optionPrice(item.price)} / shirt</span>
    </label>`).join('');
}

function renderPayments() {
  els.payments.innerHTML = Object.entries(cfg.payments).map(([key, p], i) => `
    <label class="payment-label">
      <input type="radio" name="payment" value="${key}" ${i === 0 ? 'required' : ''}>
      <strong>${p.label}</strong>
    </label>`).join('');
}

renderSizes();
renderPayments();

function selectedRadio(name) {
  const selected = document.querySelector(`input[name="${name}"]:checked`);
  if (selected) return selected;

  if (name === 'shirtType') {
    return { value: 'Short Sleeve T-Shirt' };
  }

  if (name === 'brand') {
    return {
      value: 'Standard',
      dataset: { garmentPrice: '18' }
    };
  }

  return null;
}

function selectedChecks(name) {
  return [...document.querySelectorAll(`input[name="${name}"]:checked`)];
}

function getSizeSelections() {
  return selectedChecks('size').map(box => {
    const qtyInput = document.querySelector(`.size-qty[data-size="${CSS.escape(box.value)}"]`);
    const qty = Math.max(1, Number(qtyInput?.value || 1));
    return { name: box.value, qty, upcharge: Number(box.dataset.upcharge || 0) };
  });
}

function getDiscount(subtotal) {
  if (!activeDiscount || subtotal <= 0) return { amount: 0, code: '', label: '' };

  return {
    amount: Math.max(0, Math.min(subtotal, Number(activeDiscount.amount || 0))),
    code: activeDiscount.code || '',
    label: activeDiscount.label || activeDiscount.code || ''
  };
}

function validateDiscountWithServer(code, subtotal) {
  return new Promise((resolve, reject) => {
    const endpoint = cfg.googleSheetsUrl;
    if (!endpoint) {
      reject(new Error('Google Apps Script is not configured.'));
      return;
    }

    const callbackName = `discountCallback_${Date.now()}_${Math.floor(Math.random() * 100000)}`;
    const script = document.createElement('script');

    const timeout = setTimeout(() => {
      cleanup();
      reject(new Error('Discount validation timed out.'));
    }, 10000);

    function cleanup() {
      clearTimeout(timeout);
      delete window[callbackName];
      script.remove();
    }

    window[callbackName] = (result) => {
      cleanup();
      resolve(result);
    };

    const params = new URLSearchParams({
      action: 'validateDiscount',
      code,
      subtotal: String(subtotal),
      callback: callbackName
    });

    script.src = `${endpoint}?${params.toString()}`;
    script.onerror = () => {
      cleanup();
      reject(new Error('Could not contact the discount server.'));
    };

    document.body.appendChild(script);
  });
}


function getDeliveryMethod() {
  return selectedRadio('deliveryMethod')?.value || 'pickup';
}

function getShippingAddress() {
  return {
    name: document.getElementById('customerName')?.value.trim() || '',
    street1: document.getElementById('shipAddress1')?.value.trim() || '',
    street2: document.getElementById('shipAddress2')?.value.trim() || '',
    city: document.getElementById('shipCity')?.value.trim() || '',
    state: document.getElementById('shipState')?.value.trim().toUpperCase() || '',
    zip: document.getElementById('shipZip')?.value.trim() || '',
    country: 'US'
  };
}

function shippingAddressIsComplete() {
  const a = getShippingAddress();
  return Boolean(a.name && a.street1 && a.city && a.state && a.zip);
}

function clearShippingQuote(message = '') {
  shippingQuote = null;
  if (els.shippingRateMessage) {
    els.shippingRateMessage.textContent = message;
    els.shippingRateMessage.className = 'shipping-rate-message';
  }
}

async function requestShippingRate() {
  if (getDeliveryMethod() !== 'shipping') return;

  const calc = calculate();

  if (!calc.itemCount) {
    els.shippingRateMessage.textContent = 'Select at least one shirt size and quantity first.';
    els.shippingRateMessage.className = 'shipping-rate-message error';
    return;
  }

  if (!shippingAddressIsComplete()) {
    els.shippingRateMessage.textContent = 'Enter the complete shipping address first.';
    els.shippingRateMessage.className = 'shipping-rate-message error';
    return;
  }

  els.getShippingRate.disabled = true;
  els.getShippingRate.textContent = 'Getting Rate…';
  els.shippingRateMessage.textContent = 'Checking Shippo rates…';
  els.shippingRateMessage.className = 'shipping-rate-message';

  try {
    const response = await fetch(cfg.googleSheetsUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({
        action: 'shippingRate',
        address: getShippingAddress(),
        itemCount: calc.itemCount
      }),
      redirect: 'follow'
    });

    const result = await response.json();

    if (!result || result.success !== true) {
      throw new Error(result?.error || 'No shipping rate was returned.');
    }

    shippingQuote = {
      amount: Number(result.amount || 0),
      provider: result.provider || '',
      service: result.service || '',
      estimatedDays: result.estimatedDays ?? null
    };

    const days = shippingQuote.estimatedDays
      ? ` • about ${shippingQuote.estimatedDays} business day${shippingQuote.estimatedDays === 1 ? '' : 's'}`
      : '';

    els.shippingRateMessage.textContent =
      `${shippingQuote.provider} ${shippingQuote.service}: ${money.format(shippingQuote.amount)}${days}`;
    els.shippingRateMessage.className = 'shipping-rate-message success';
    calculate();
  } catch (error) {
    shippingQuote = null;
    els.shippingRateMessage.textContent =
      `Unable to calculate shipping. ${error.message || 'Please try again.'}`;
    els.shippingRateMessage.className = 'shipping-rate-message error';
    calculate();
  } finally {
    els.getShippingRate.disabled = false;
    els.getShippingRate.textContent = 'Get Shipping Rate';
  }
}

function calculate() {
  const type = selectedRadio('shirtType');
  const brand = selectedRadio('brand');
  const sizes = getSizeSelections();

  const garmentPrice = Number(brand?.dataset.garmentPrice || 0);
  const itemCount = sizes.reduce((sum, item) => sum + item.qty, 0);
  const garmentSubtotal = garmentPrice * itemCount;
  const sizeSubtotal = sizes.reduce((sum, item) => sum + (item.upcharge * item.qty), 0);

  // Discounts apply to merchandise only. Shipping is added afterward.
  const subtotal = garmentSubtotal + sizeSubtotal;
  const discount = getDiscount(subtotal);
  const shippingAmount =
    getDeliveryMethod() === 'shipping' && shippingQuote
      ? Number(shippingQuote.amount || 0)
      : 0;

  const total = Math.max(0, subtotal - discount.amount) + shippingAmount;

  const lines = [];
  if (type) lines.push(['Shirt', type.value, '']);
  if (sizes.length) lines.push(['Sizes', sizes.map(s => `${s.name} × ${s.qty}`).join(', '), '']);
  lines.push(['Items', String(itemCount), '']);

  if (itemCount) {
    lines.push(['Shirts', money.format(garmentSubtotal), '']);
    if (sizeSubtotal) lines.push(['Size upcharges', money.format(sizeSubtotal), '']);
    if (discount.amount) {
      lines.push([`Discount (${discount.code})`, `−${money.format(discount.amount)}`, 'discount-line']);
    }

    if (getDeliveryMethod() === 'pickup') {
      lines.push(['Delivery', 'Local Pickup - Smyrna, GA', '']);
    } else if (shippingQuote) {
      lines.push([
        'Shipping',
        `${shippingQuote.provider} ${shippingQuote.service} • ${money.format(shippingAmount)}`,
        ''
      ]);
    } else {
      lines.push(['Shipping', 'Rate required', '']);
    }
  }

  els.lines.innerHTML = lines.map(([label, value, cls]) => `
    <div class="summary-line ${cls}"><span>${label}</span><span>${value}</span></div>`).join('');

  els.total.textContent = money.format(total);
  if (els.mobileTotal) {
    els.mobileTotal.textContent = money.format(total);
  }

  return {
    total,
    subtotal,
    discount,
    shippingAmount,
    itemCount,
    sizes,
    type,
    brand,
    garmentPrice,
    garmentSubtotal,
    sizeSubtotal
  };
}
function updatePaymentInstructions() {
  const choice = selectedRadio('payment');

  if (!choice) {
    els.instructions.classList.add('hidden');
    return;
  }

  const p = cfg.payments[choice.value];

  if (choice.value === 'cash') {
    els.instructions.innerHTML =
      `<strong>Cash</strong><br>Pay when the order is picked up.`;
  } else {
    els.instructions.innerHTML =
      `<strong>${p.label}</strong><br>Payment instructions will appear after the order is submitted.`;
  }

  els.instructions.classList.remove('hidden');
}

function validateRequiredGroups() {
  const sizeBoxes = document.querySelectorAll('input[name="size"]');
  const anySize = selectedChecks('size').length > 0;
  const delivery = getDeliveryMethod();

  if (sizeBoxes[0]) {
    sizeBoxes[0].setCustomValidity(anySize ? '' : 'Please select at least one shirt size.');
  }

  const address1 = document.getElementById('shipAddress1');
  if (delivery === 'shipping') {
    const addressComplete = shippingAddressIsComplete();
    if (address1) {
      address1.setCustomValidity(addressComplete ? '' : 'Enter a complete shipping address.');
    }

    if (!addressComplete) return false;

    if (!shippingQuote) {
      els.shippingRateMessage.textContent = 'Click Get Shipping Rate before reviewing the order.';
      els.shippingRateMessage.className = 'shipping-rate-message error';
      return false;
    }
  } else if (address1) {
    address1.setCustomValidity('');
  }

  return anySize;
}
function update() {
  document.querySelectorAll('input[name="size"]').forEach(box => {
    const qty = document.querySelector(`.size-qty[data-size="${CSS.escape(box.value)}"]`);
    qty.disabled = !box.checked;
  });

  const currentCalc = calculate();

  if (
    activeDiscount &&
    Number(activeDiscount.validatedSubtotal || 0) !== Number(currentCalc.subtotal.toFixed(2))
  ) {
    activeDiscount = null;
    els.discountCode.value = '';
    els.discountMessage.textContent = 'Order changed. Re-enter the discount code to recalculate it.';
    els.discountMessage.className = 'discount-message';
    els.applyDiscount.textContent = 'Apply';
    calculate();
  }

  validateRequiredGroups();
  updatePaymentInstructions();
}

async function applyDiscountCode() {
  const enteredCode = (els.discountCode.value || '').trim();
  els.discountMessage.className = 'discount-message';

  if (!enteredCode) {
    activeDiscount = null;
    els.discountMessage.textContent = '';
    els.applyDiscount.textContent = 'Apply';
    update();
    return;
  }

  const calc = calculate();
  if (calc.subtotal <= 0) {
    els.discountMessage.textContent = 'Build the order before applying a discount code.';
    els.discountMessage.classList.add('error');
    return;
  }

  els.applyDiscount.disabled = true;
  els.applyDiscount.textContent = 'Checking…';
  els.discountMessage.textContent = 'Validating code…';

  try {
    const result = await validateDiscountWithServer(enteredCode, calc.subtotal);

    if (!result || !result.valid) {
      activeDiscount = null;
      els.discountMessage.textContent = (result && result.message) || 'That discount code is not valid.';
      els.discountMessage.classList.add('error');
      els.applyDiscount.textContent = 'Apply';
      update();
      return;
    }

    activeDiscount = {
      code: result.code,
      amount: Number(result.amount || 0),
      label: result.label || result.code,
      validatedSubtotal: Number(calc.subtotal.toFixed(2))
    };

    els.discountCode.value = result.code;
    els.discountMessage.textContent = `${activeDiscount.label} applied.`;
    els.discountMessage.classList.add('success');
    els.applyDiscount.textContent = 'Remove';
    update();
  } catch (error) {
    activeDiscount = null;
    els.discountMessage.textContent = 'Could not validate the discount code. Please try again.';
    els.discountMessage.classList.add('error');
    els.applyDiscount.textContent = 'Apply';
    update();
  } finally {
    els.applyDiscount.disabled = false;
  }
}
els.applyDiscount.addEventListener('click', () => {
  if (activeDiscount) {
    activeDiscount = null;
    els.discountCode.value = '';
    els.discountMessage.textContent = 'Discount removed.';
    els.discountMessage.className = 'discount-message';
    els.applyDiscount.textContent = 'Apply';
    update();
    return;
  }
  applyDiscountCode();
});

els.discountCode.addEventListener('keydown', (event) => {
  if (event.key === 'Enter') {
    event.preventDefault();
    applyDiscountCode();
  }
});

els.discountCode.addEventListener('input', () => {
  if (activeDiscount && els.discountCode.value.trim().toUpperCase() !== activeDiscount.code) {
    activeDiscount = null;
    els.applyDiscount.textContent = 'Apply';
    els.discountMessage.textContent = '';
    els.discountMessage.className = 'discount-message';
    update();
  }
});

document.addEventListener('change', (event) => {
  if (event.target.matches('input[name="deliveryMethod"]')) {
    const shipping = event.target.value === 'shipping';
    els.shippingFields.classList.toggle('hidden', !shipping);
    clearShippingQuote(
      shipping ? 'Enter the shipping address, then click Get Shipping Rate.' : ''
    );
  }

  if (event.target.matches('input[name="size"], .size-qty') && shippingQuote) {
    clearShippingQuote('Quantity changed. Please get a new shipping rate.');
  }

  update();
});

document.addEventListener('input', (event) => {
  if (
    event.target.matches('#shipAddress1, #shipAddress2, #shipCity, #shipState, #shipZip') &&
    shippingQuote
  ) {
    clearShippingQuote('Shipping address changed. Please get a new shipping rate.');
  }

  update();
});

els.getShippingRate?.addEventListener('click', requestShippingRate);
update();

function buildOrder() {
  const calc = calculate();
  const paymentKey = selectedRadio('payment')?.value;
  const p = paymentKey ? cfg.payments[paymentKey] : null;
  const orderId = `SO-${Date.now().toString().slice(-6)}`;
  const customer = document.getElementById('customerName').value.trim();
  const color = document.getElementById('shirtColor').value.trim();
  const image = document.getElementById('printImage').value.trim();
  const notes = document.getElementById('notes').value.trim();
  const customerEmail = document.getElementById('customerEmail').value.trim();
  const deliveryMethod = getDeliveryMethod();
  const shippingAddress = deliveryMethod === 'shipping' ? getShippingAddress() : null;

  const sizesText = calc.sizes.map(s => `${s.name} x${s.qty}`).join(', ');

  const payload = {
    orderNumber: orderId,
    customerName: customer,
    shirtType: calc.type?.value || '',
    brand: calc.brand?.value || '',
    color: color,
    sizes: sizesText,
    itemCount: calc.itemCount,
    printImage: image,
    notes: notes,
    subtotal: Number(calc.subtotal.toFixed(2)),
    discountCode: calc.discount.code || '',
    discountAmount: Number(calc.discount.amount.toFixed(2)),
    total: Number(calc.total.toFixed(2)),
    paymentMethod: p?.label || '',
    customerEmail: customerEmail,
    deliveryMethod: deliveryMethod === 'shipping' ? 'Shipping' : 'Local Pickup - Smyrna, GA',
    shippingAmount: Number(calc.shippingAmount.toFixed(2)),
    shippingProvider: shippingQuote?.provider || '',
    shippingService: shippingQuote?.service || '',
    shippingAddress: shippingAddress
  };

  const text = [
    `Order: ${orderId}`,
    `Customer: ${customer}`,
    customerEmail ? `Email: ${customerEmail}` : '',
    `Shirt Type: ${payload.shirtType || 'Not selected'}`,
    `Size(s): ${sizesText || 'Not selected'}`,
    `Color: ${color}`,
    `Delivery: ${payload.deliveryMethod}`,
    deliveryMethod === 'shipping'
      ? `Shipping Address: ${shippingAddress.street1}${shippingAddress.street2 ? ', ' + shippingAddress.street2 : ''}, ${shippingAddress.city}, ${shippingAddress.state} ${shippingAddress.zip}`
      : '',
    deliveryMethod === 'shipping'
      ? `Shipping: ${shippingQuote.provider} ${shippingQuote.service} - ${money.format(calc.shippingAmount)}`
      : '',
    `Print Image: ${image}`,
    `Garment subtotal: ${money.format(calc.garmentSubtotal)}`,
    calc.sizeSubtotal ? `Size upcharges: ${money.format(calc.sizeSubtotal)}` : '',
    calc.discount.amount ? `Discount (${calc.discount.code}): -${money.format(calc.discount.amount)}` : '',
    calc.discount.amount ? `Subtotal before discount: ${money.format(calc.subtotal)}` : '',
    notes ? `Notes: ${notes}` : '',
    `Total: ${money.format(calc.total)}`,
    p ? `Payment: ${p.label}` : ''
  ].filter(Boolean).join('\n');

  return { text, payment: p, payload };
}

function continueToPaymentAfterSubmit() {
  if (!currentOrder || !currentOrder.payment) return;

  const payment = currentOrder.payment;
  const orderNumber = currentOrder.payload.orderNumber;
  const total = money.format(currentOrder.payload.total);

  // No redirects or external login pages.
  if (currentOrder.payload.paymentMethod === 'Cash') {
    els.submitStatus.innerHTML =
      `Order <strong>${orderNumber}</strong> has been submitted.<br>` +
      `Total: <strong>${total}</strong><br>` +
      `Payment method: <strong>Cash</strong><br>` +
      `Please pay when the order is picked up.`;
  } else {
    els.submitStatus.innerHTML =
      `Order <strong>${orderNumber}</strong> has been submitted.<br>` +
      `Total: <strong>${total}</strong><br>` +
      `Open the ${payment.label} app and send payment to <strong>${payment.handle}</strong>.<br>` +
      `Please include <strong>${orderNumber}</strong> in the payment note.`;
  }

}

async function submitOrderToSheet() {
  if (!currentOrder || orderSubmitted) return;

  const url = cfg.googleSheetsUrl;
  if (!url) {
    els.submitStatus.textContent = 'Google Sheets is not configured.';
    els.submitStatus.className = 'submit-status error';
    return;
  }

  els.submitOrder.disabled = true;
  els.submitOrder.textContent = 'Submitting…';
  els.submitStatus.textContent = 'Submitting order and verifying final pricing…';
  els.submitStatus.className = 'submit-status';

  try {
    // The Apps Script backend independently recalculates merchandise pricing,
    // discounts, and Shippo shipping before accepting the order.
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify(currentOrder.payload),
      redirect: 'follow'
    });

    const result = await response.json();

    if (!result || result.success !== true) {
      throw new Error(result?.error || 'The server did not accept the order.');
    }

    // Use the trusted server-calculated values from this point forward.
    currentOrder.payload.subtotal = Number(result.subtotal || 0);
    currentOrder.payload.discountCode = result.discountCode || '';
    currentOrder.payload.discountAmount = Number(result.discountAmount || 0);
    currentOrder.payload.shippingAmount = Number(result.shippingAmount || 0);
    currentOrder.payload.shippingProvider = result.shippingProvider || '';
    currentOrder.payload.shippingService = result.shippingService || '';
    currentOrder.payload.total = Number(result.total || 0);

    orderSubmitted = true;
    els.submitOrder.textContent = 'Order Submitted ✓';
    els.submitStatus.textContent =
      `Order ${currentOrder.payload.orderNumber} has been submitted.`;
    els.submitStatus.className = 'submit-status success';

    continueToPaymentAfterSubmit();

  } catch (error) {
    els.submitOrder.disabled = false;
    els.submitOrder.textContent = 'Submit Order';
    els.submitStatus.textContent =
      `The order could not be submitted: ${error.message || 'Please try again.'}`;
    els.submitStatus.className = 'submit-status error';
  }
}

els.form.addEventListener('submit', (e) => {
  e.preventDefault();
  validateRequiredGroups();
  if (!els.form.reportValidity()) return;

  currentOrder = buildOrder();
  orderSubmitted = false;
els.review.textContent = currentOrder.text;

  els.submitOrder.disabled = false;
  els.submitOrder.textContent = 'Submit Order';
  els.submitStatus.textContent = 'Submit the order to complete your order and view payment details.';
  els.submitStatus.className = 'submit-status';

  els.dialog.showModal();
});

document.getElementById('closeDialog').addEventListener('click', () => els.dialog.close());
els.submitOrder.addEventListener('click', submitOrderToSheet);
document.getElementById('copyOrder').addEventListener('click', async () => {
  await navigator.clipboard.writeText(els.review.textContent);
  const btn = document.getElementById('copyOrder');
  const original = btn.textContent;
  btn.textContent = 'Copied';
  setTimeout(() => btn.textContent = original, 1200);
});
if (els.viewOrderButton) {
  els.viewOrderButton.addEventListener('click', () => {
    document.querySelector('.summary-column').scrollIntoView({
      behavior: 'smooth',
      block: 'start'
    });
  });
}

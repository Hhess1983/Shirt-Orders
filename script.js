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
  mobilePaymentAction: document.getElementById('mobilePaymentAction'),
  mobilePaymentLink: document.getElementById('mobilePaymentLink')
};

let activeDiscount = null;
let currentOrder = null;
let orderSubmitted = false;

function optionPrice(price, prefix = '+') {
  return Number(price) ? `${prefix}${money.format(price)}` : '';
}

function renderTypes() {
  const types = Object.keys(cfg.products);
  els.type.innerHTML = types.map((name, i) => {
    const starting = Math.min(...cfg.products[name].map(x => x.garmentPrice)) + Math.min(...cfg.printLocations.map(x => x.price));
    return `
      <label class="option-label">
        <input type="radio" name="shirtType" value="${name}" ${i === 0 ? 'required' : ''}>
        <span>${name}</span>
        <span class="option-price">from ${money.format(starting)}</span>
      </label>`;
  }).join('');
}

function renderBrands(typeName) {
  const items = cfg.products[typeName] || [];
  if (!items.length) {
    els.brand.innerHTML = '<p class="empty-state">Choose a shirt type first.</p>';
    return;
  }

  els.brand.innerHTML = items.map((item, i) => `
    <label class="option-label">
      <input type="radio" name="brand" value="${item.brand}" data-garment-price="${item.garmentPrice}" ${i === 0 ? 'required' : ''}>
      <span>${item.brand}</span>
      <span class="option-price">garment ${money.format(item.garmentPrice)}</span>
    </label>`).join('');

  if (items.length === 1) {
    els.brand.querySelector('input[name="brand"]').checked = true;
  }
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
      <span class="option-price">${p.handle}</span>
    </label>`).join('');
}

renderTypes();
renderSizes();
renderPrintLocations();
renderPayments();

function selectedRadio(name) {
  return document.querySelector(`input[name="${name}"]:checked`);
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

function calculate() {
  const type = selectedRadio('shirtType');
  const brand = selectedRadio('brand');
  const locations = selectedChecks('printLocation');
  const sizes = getSizeSelections();

  const garmentPrice = Number(brand?.dataset.garmentPrice || 0);
  const printPricePerShirt = locations.reduce((sum, item) => sum + Number(item.dataset.price || 0), 0);
  const itemCount = sizes.reduce((sum, item) => sum + item.qty, 0);
  const garmentSubtotal = garmentPrice * itemCount;
  const printSubtotal = printPricePerShirt * itemCount;
  const sizeSubtotal = sizes.reduce((sum, item) => sum + (item.upcharge * item.qty), 0);
  const subtotal = garmentSubtotal + printSubtotal + sizeSubtotal;
  const discount = getDiscount(subtotal);
  const total = Math.max(0, subtotal - discount.amount);

  const lines = [];
  if (type) lines.push(['Type', type.value, '']);
  if (brand) lines.push(['Brand', brand.value, '']);
  if (sizes.length) lines.push(['Sizes', sizes.map(s => `${s.name} × ${s.qty}`).join(', '), '']);
  if (locations.length) lines.push(['Print', locations.map(x => x.value).join(', '), '']);
  lines.push(['Items', String(itemCount), '']);

  if (itemCount && brand) {
    lines.push(['Garments', money.format(garmentSubtotal), '']);
    if (printSubtotal) lines.push(['Printing', money.format(printSubtotal), '']);
    if (sizeSubtotal) lines.push(['Size upcharges', money.format(sizeSubtotal), '']);
    if (discount.amount) lines.push([`Discount (${discount.code})`, `−${money.format(discount.amount)}`, 'discount-line']);
  }

  els.lines.innerHTML = lines.map(([label, value, cls]) => `
    <div class="summary-line ${cls}"><span>${label}</span><span>${value}</span></div>`).join('');
  els.total.textContent = money.format(total);
  if (els.mobileTotal) {
  els.mobileTotal.textContent = money.format(total);
}

  return { total, subtotal, discount, itemCount, sizes, type, brand, locations, garmentPrice, printPricePerShirt, garmentSubtotal, printSubtotal, sizeSubtotal };
}
function updatePaymentInstructions() {
  const choice = selectedRadio('payment');
  if (!choice) {
    els.instructions.classList.add('hidden');
    return;
  }
  const p = cfg.payments[choice.value];
  els.instructions.innerHTML = `<strong>${p.label}</strong><br>Pay <strong>${els.total.textContent}</strong> to <strong>${p.handle}</strong>. Include the customer name in the payment note.`;
  els.instructions.classList.remove('hidden');
}

function validateRequiredGroups() {
  const sizeBoxes = document.querySelectorAll('input[name="size"]');
  const printBoxes = document.querySelectorAll('input[name="printLocation"]');
  const anySize = selectedChecks('size').length > 0;
  const anyPrint = selectedChecks('printLocation').length > 0;

  if (sizeBoxes[0]) sizeBoxes[0].setCustomValidity(anySize ? '' : 'Please select at least one shirt size.');
  if (printBoxes[0]) printBoxes[0].setCustomValidity(anyPrint ? '' : 'Please select at least one print location.');
  return anySize && anyPrint;
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
  if (event.target.matches('input[name="shirtType"]')) {
    renderBrands(event.target.value);
  }
  update();
});
document.addEventListener('input', update);
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

  const sizesText = calc.sizes.map(s => `${s.name} x${s.qty}`).join(', ');
  const locationsText = calc.locations.map(x => x.value).join(', ');

  const payload = {
    orderNumber: orderId,
    customerName: customer,
    shirtType: calc.type?.value || '',
    brand: calc.brand?.value || '',
    color: color,
    sizes: sizesText,
    printLocations: locationsText,
    printImage: image,
    notes: notes,
    subtotal: Number(calc.subtotal.toFixed(2)),
    discountCode: calc.discount.code || '',
    discountAmount: Number(calc.discount.amount.toFixed(2)),
    total: Number(calc.total.toFixed(2)),
    paymentMethod: p?.label || ''
  };

  const text = [
    `Order: ${orderId}`,
    `Customer: ${customer}`,
    `Shirt Type: ${payload.shirtType || 'Not selected'}`,
    `Brand: ${payload.brand || 'Not selected'}`,
    `Size(s): ${sizesText || 'Not selected'}`,
    `Color: ${color}`,
    `Print Image: ${image}`,
    `Print Location(s): ${locationsText}`,
    `Garment subtotal: ${money.format(calc.garmentSubtotal)}`,
    calc.printSubtotal ? `Print subtotal: ${money.format(calc.printSubtotal)}` : '',
    calc.sizeSubtotal ? `Size upcharges: ${money.format(calc.sizeSubtotal)}` : '',
    calc.discount.amount ? `Discount (${calc.discount.code}): -${money.format(calc.discount.amount)}` : '',
    calc.discount.amount ? `Subtotal before discount: ${money.format(calc.subtotal)}` : '',
    notes ? `Notes: ${notes}` : '',
    `Total: ${money.format(calc.total)}`,
    p ? `Payment: ${p.label} (${p.handle})` : ''
  ].filter(Boolean).join('\n');

  return { text, payment: p, payload };
}

function continueToPaymentAfterSubmit() {
  if (!currentOrder || !currentOrder.payment) return;

  const payment = currentOrder.payment;
  const isCash = currentOrder.payload.paymentMethod === 'Cash';
  const isMobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);

  els.mobilePaymentAction.classList.add('hidden');
  els.mobilePaymentLink.removeAttribute('href');

  if (isCash || !payment.url) {
    els.submitStatus.textContent =
      `Order ${currentOrder.payload.orderNumber} has been submitted. Payment method: Cash.`;
    return;
  }

  // On mobile, external app handoffs are most reliable from a direct customer tap.
  if (isMobile) {
    els.submitStatus.textContent =
      `Order ${currentOrder.payload.orderNumber} has been submitted. Tap below to pay with ${payment.label}.`;

    els.mobilePaymentLink.textContent = `Pay with ${payment.label}`;
    els.mobilePaymentLink.href = payment.url;
    els.mobilePaymentAction.classList.remove('hidden');
    return;
  }

  // Desktop browsers can usually follow the redirect after the save completes.
  els.submitStatus.textContent =
    `Order ${currentOrder.payload.orderNumber} has been submitted. Opening ${payment.label}…`;

  setTimeout(() => {
    window.location.href = payment.url;
  }, 700);
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
  els.submitStatus.textContent = 'Saving order…';
  els.submitStatus.className = 'submit-status';

  try {
    // text/plain keeps the request "simple" and avoids an Apps Script CORS preflight.
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify(currentOrder.payload),
      redirect: 'follow'
    });

    let result = null;
    try {
      result = await response.json();
    } catch (_) {
      // Some Apps Script deployments return an opaque/redirected response.
    }

    if (result && result.success === false) {
      throw new Error(result.error || 'Your order has been rejected.');
    }

    orderSubmitted = true;
    els.submitOrder.textContent = 'Order Submitted ✓';
    els.submitStatus.textContent = `Order ${currentOrder.payload.orderNumber} has been submitted.`;
    els.submitStatus.className = 'submit-status success';
    continueToPaymentAfterSubmit();
  } catch (error) {
    // Fallback for browsers/deployments that block reading the Apps Script response
    // even though the POST itself is allowed.
    try {
      await fetch(url, {
        method: 'POST',
        mode: 'no-cors',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify(currentOrder.payload)
      });
      orderSubmitted = true;
      els.submitOrder.textContent = 'Order Submitted ✓';
      els.submitStatus.textContent = `Order ${currentOrder.payload.orderNumber} has been submitted.`;
      els.submitStatus.className = 'submit-status success';
      continueToPaymentAfterSubmit();
    } catch (fallbackError) {
      els.submitOrder.disabled = false;
      els.submitOrder.textContent = 'Submit Order';
      els.submitStatus.textContent = 'The order could not be sent. Check your internet connection and Apps Script deployment.';
      els.submitStatus.className = 'submit-status error';
    }
  }
}

els.form.addEventListener('submit', (e) => {
  e.preventDefault();
  validateRequiredGroups();
  if (!els.form.reportValidity()) return;

  currentOrder = buildOrder();
  orderSubmitted = false;
  els.mobilePaymentAction.classList.add('hidden');
  els.mobilePaymentLink.removeAttribute('href');

  els.review.textContent = currentOrder.text;

  els.submitOrder.disabled = false;
  els.submitOrder.textContent = 'Submit Order';
  els.submitStatus.textContent = 'Submit the order to save it before opening payment.';
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

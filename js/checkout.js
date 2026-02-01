(() => {
  "use strict";

  const CART_KEY = "cart";
  const PRODUCTS_KEY = window.PRODUCTS_KEY || "products";
  const SETTINGS_KEY = "storeSettings";
  const ORDERS_KEY = "orders";

  const $ = (id) => document.getElementById(id);

  function getJSON(key, fallback) {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch {
      return fallback;
    }
  }

  function setJSON(key, value) {
    localStorage.setItem(key, JSON.stringify(value));
  }

  function uid() {
    return "TS-" + Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 7);
  }

  
  function getApiBase() {
    return String(settings.squareApiBaseUrl || "https://twin-supply.vercel.app").replace(/\/$/, "");
  }

  function collectCustomer() {
    return {
      name: $("c-name")?.value.trim(),
      email: $("c-email")?.value.trim(),
      phone: $("c-phone")?.value.trim(),
      address1: $("c-address1")?.value.trim(),
      address2: $("c-address2")?.value.trim(),
      city: $("c-city")?.value.trim(),
      state: $("c-state")?.value.trim(),
      zip: $("c-zip")?.value.trim(),
      country: $("c-country")?.value.trim()
    };
  }
function money(n, currency) {
    const val = Number(n || 0);
    return new Intl.NumberFormat("en-US", { style: "currency", currency: currency || "USD" }).format(val);
  }

  function getProductsSafe() {
    const lsProducts = getJSON(PRODUCTS_KEY, null);
    if (Array.isArray(lsProducts) && lsProducts.length) return lsProducts;

    if (Array.isArray(window.allProducts) && window.allProducts.length) return window.allProducts;
    if (Array.isArray(window.baseProducts) && window.baseProducts.length) return window.baseProducts;

    return [];
  }

  function getSettings() {
    const def = {
      currency: "USD",
      taxRate: 0,
      feePercent: 0.029,
      feeFixed: 0.30,
      paypalClientId: "",
      paypalMode: "sandbox",
      paypalBrand: "Twin-Supply",
      orderWebhookUrl: "",
      orderWebhookToken: "",
      shippingMethods: [
        { id: "standard", name: "Standard", price: 7.99 },
        { id: "express", name: "Express", price: 14.99 },
        { id: "pickup", name: "Pickup", price: 0 }
      ],
      squareAppId: "",
      squareLocationId: "",
      squareEnv: "sandbox",
      squareApiBaseUrl: "https://twin-supply.vercel.app"
    };

    const s = getJSON(SETTINGS_KEY, def);
    if (!s || typeof s !== "object") return def;

    if (!s.currency) s.currency = "USD";
    if (typeof s.taxRate !== "number") s.taxRate = Number(s.taxRate || 0);
    if (typeof s.feePercent !== "number") s.feePercent = Number(s.feePercent || 0);
    if (typeof s.feeFixed !== "number") s.feeFixed = Number(s.feeFixed || 0);

    if (typeof s.paypalClientId !== "string") s.paypalClientId = String(s.paypalClientId || "");
    if (s.paypalMode !== "live") s.paypalMode = "sandbox";
    if (typeof s.paypalBrand !== "string") s.paypalBrand = String(s.paypalBrand || "Twin-Supply");
    if (typeof s.orderWebhookUrl !== "string") s.orderWebhookUrl = String(s.orderWebhookUrl || "");
    if (typeof s.orderWebhookToken !== "string") s.orderWebhookToken = String(s.orderWebhookToken || "");

    if (typeof s.squareAppId !== "string") s.squareAppId = String(s.squareAppId || "");
    if (typeof s.squareLocationId !== "string") s.squareLocationId = String(s.squareLocationId || "");
    if (String(s.squareEnv || "").toLowerCase() !== "live") s.squareEnv = "sandbox";
    if (typeof s.squareApiBaseUrl !== "string") s.squareApiBaseUrl = String(s.squareApiBaseUrl || "https://twin-supply.vercel.app");

    if (!Array.isArray(s.shippingMethods) || !s.shippingMethods.length) s.shippingMethods = def.shippingMethods;
    return s;
  }

  function normalizeCart(cart, products) {
    const map = new Map(products.map((p) => [String(p.id), p]));
    return (cart || [])
      .filter((ci) => map.has(String(ci.id)))
      .map((ci) => {
        const p = map.get(String(ci.id));
        return {
          id: p.id,
          name: p.name,
          price: Number(p.price || 0),
          cost: Number(p.cost || 0),
          stock: Number(p.stock || 0),
          qty: Math.max(1, Number(ci.qty || 1)),
          image: p.image || ""
        };
      });
  }

  function getShipPriceById(id, settings) {
    const m = (settings.shippingMethods || []).find((x) => x.id === id);
    return m ? Number(m.price || 0) : 0;
  }

  function calcTotals(items, shippingCharged, taxRate) {
    const subtotal = items.reduce((sum, it) => sum + it.price * it.qty, 0);
    const tax = subtotal * (Number(taxRate || 0) / 100);
    const total = subtotal + Number(shippingCharged || 0) + tax;
    return { subtotal, tax, total };
  }

  function validateStock(orderItems) {
    const list = getProductsSafe();
    const map = new Map(list.map((p) => [String(p.id), p]));
    const bad = [];
    orderItems.forEach((it) => {
      const p = map.get(String(it.id));
      const stock = p ? Number(p.stock || 0) : 0;
      if (stock < it.qty) bad.push(`${p ? p.name : "Unknown"} (stock: ${stock})`);
    });
    return bad;
  }

  function updateProductsStockAfterOrder(orderItems) {
    const list = getJSON(PRODUCTS_KEY, getProductsSafe());
    const map = new Map(list.map((p) => [String(p.id), p]));

    orderItems.forEach((it) => {
      const p = map.get(String(it.id));
      if (!p) return;
      const stock = Number(p.stock || 0);
      p.stock = Math.max(0, stock - Number(it.qty || 1));
    });

    setJSON(PRODUCTS_KEY, Array.from(map.values()));
  }

  function loadPayPalSDK(clientId, currency) {
    return new Promise((resolve, reject) => {
      if (window.paypal) return resolve();

      const existing = document.querySelector('script[data-pp-sdk="1"]');
      if (existing) {
        existing.addEventListener("load", () => resolve());
        existing.addEventListener("error", () => reject(new Error("PayPal SDK failed to load")));
        return;
      }

      const script = document.createElement("script");
      script.setAttribute("data-pp-sdk", "1");
      script.src =
        "https://www.paypal.com/sdk/js?client-id=" +
        encodeURIComponent(clientId) +
        "&currency=" +
        encodeURIComponent(currency || "USD") +
        "&intent=capture&commit=true&components=buttons&enable-funding=venmo";
      script.onload = () => resolve();
      script.onerror = () => reject(new Error("PayPal SDK failed to load"));
      document.head.appendChild(script);
    });
  }


  async function sendOrderToWebhook(order) {
    let url = String(settings.orderWebhookUrl || "").trim();
    if (!url) return;

    // If you set a token, append it as ?token=...
    const token = String(settings.orderWebhookToken || "").trim();
    if (token) {
      const join = url.includes("?") ? "&" : "?";
      url = url + join + "token=" + encodeURIComponent(token);
    }

    try {
      await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ order })
      });
    } catch (err) {
      // Non-blocking
      console.error("Webhook failed", err);
    }

  }

  // ===== DOM =====
  const form = $("checkout-form");
  const shipSelect = $("ship-method");
  const labelCostEl = $("ship-label-cost");
  const msgEl = $("checkout-msg");
  const itemsWrap = $("summary-list");
  const elSubtotal = $("sum-subtotal");
  const elShipping = $("sum-shipping");
  const elTax = $("sum-tax");
  const elTotal = $("sum-total");

  const ppMissing = $("paypal-missing");
  const ppButtons = $("paypal-buttons");
  const ppStatus = $("paypal-status");

  const venmoWrap = $("venmo-wrap");
  const venmoButtons = $("venmo-buttons");
  const cashAppWrap = $("cashapp-wrap");
  const cashAppButton = $("cashapp-button");
  const cashAppStatus = $("cashapp-status");

  // Guard: PayPal buttons often won't render on file:// and localStorage can behave inconsistently.
  if (location.protocol === "file:") {
    if (ppStatus) {
      ppStatus.textContent =
        "You're opening this page as a file (file://). PayPal won't work reliably this way. Run a local server (VS Code Live Server or python -m http.server 5500).";
    }
    if (ppMissing) {
      ppMissing.style.display = "block";
      ppMissing.textContent =
        "Open the store on http://localhost (not file://). Also: switching between file:// and http:// changes localStorage, so your cart may look empty.";
    }
  }


  // ===== STATE =====
  const settings = getSettings();
  const products = getProductsSafe();
  const cart = getJSON(CART_KEY, []);
  const items = normalizeCart(cart, products);

  if (!items.length) {
    if (msgEl) msgEl.textContent = "Your cart is empty.";
    if (ppStatus) ppStatus.textContent = "";
  }

  // Populate shipping methods
  if (shipSelect) {
    shipSelect.innerHTML = (settings.shippingMethods || [])
      .map((m) => `<option value="${m.id}">${m.name} (${money(m.price, settings.currency)})</option>`)
      .join("");
  }

  function renderSummary() {
    if (!itemsWrap) return;

    itemsWrap.innerHTML = items
      .map(
        (it) => `
        <div class="listItem" style="align-items:center">
          <div style="display:flex;gap:10px;align-items:center">
            ${it.image ? `<img src="${it.image}" alt="" style="width:44px;height:44px;border-radius:12px;object-fit:cover;border:1px solid rgba(255,255,255,.10)">` : `<div style="width:44px;height:44px;border-radius:12px;border:1px solid rgba(255,255,255,.10);background:rgba(255,255,255,.06)"></div>`}
            <div>
              <div style="font-weight:950">${it.name}</div>
              <div style="color:var(--muted);font-weight:800;font-size:13px">Qty: ${it.qty}</div>
            </div>
          </div>
          <div style="font-weight:950">${money(it.price * it.qty, settings.currency)}</div>
        </div>`
      )
      .join("");

    const shippingCharged = getShipPriceById(shipSelect?.value, settings);
    const totals = calcTotals(items, shippingCharged, settings.taxRate);

    if (elSubtotal) elSubtotal.textContent = money(totals.subtotal, settings.currency);
    if (elShipping) elShipping.textContent = money(shippingCharged, settings.currency);
    if (elTax) elTax.textContent = money(totals.tax, settings.currency);
    if (elTotal) elTotal.textContent = money(totals.total, settings.currency);
  }

  shipSelect?.addEventListener("change", renderSummary);
  renderSummary();

  // Prevent default submit (we pay via PayPal)
  form?.addEventListener("submit", (e) => {
    e.preventDefault();
  });

  function isFormValid() {
    if (!form) return false;
    // Use native required validations
    if (typeof form.checkValidity === "function" && !form.checkValidity()) return false;
    if (!items.length) return false;
    const bad = validateStock(items);
    if (bad.length) return false;
    return true;
  }

  function reportValidationErrors() {
    if (msgEl) msgEl.textContent = "";
    if (!form) return false;

    if (typeof form.reportValidity === "function") {
      const ok = form.reportValidity();
      if (!ok) return false;
    }

    if (!items.length) {
      if (msgEl) msgEl.textContent = "Your cart is empty.";
      return false;
    }

    const bad = validateStock(items);
    if (bad.length) {
      if (msgEl) msgEl.textContent = "Not enough stock for: " + bad.join(", ");
      return false;
    }

    return true;
  }

  function buildOrderDraft(paypalDetails, opts = {}) {
    const shippingCharged = getShipPriceById(shipSelect?.value, settings);
    const labelInput = Number(labelCostEl?.value || 0);
    const shippingLabelCost = labelInput > 0 ? labelInput : shippingCharged;

    const totals = calcTotals(items, shippingCharged, settings.taxRate);
    const cogs = items.reduce((sum, it) => sum + Number(it.cost || 0) * it.qty, 0);

    // Estimate fees; we will replace with actual PayPal fee if available
    const estFees = totals.total * Number(settings.feePercent || 0) + Number(settings.feeFixed || 0);

    // Try to read PayPal fee from capture response
    const capture = paypalDetails?.purchase_units?.[0]?.payments?.captures?.[0];
    const ppFee = Number(capture?.seller_receivable_breakdown?.paypal_fee?.value || 0);
    const fee = ppFee > 0 ? ppFee : estFees;

    const profit = totals.total - cogs - fee - shippingLabelCost;

    const order = {
      id: (opts.orderId || uid()),
      createdAt: new Date().toISOString(),
      status: "paid",
      customer: {
        name: $("c-name")?.value.trim(),
        email: $("c-email")?.value.trim(),
        phone: $("c-phone")?.value.trim(),
        address1: $("c-address1")?.value.trim(),
        address2: $("c-address2")?.value.trim(),
        city: $("c-city")?.value.trim(),
        state: $("c-state")?.value.trim(),
        zip: $("c-zip")?.value.trim(),
        country: $("c-country")?.value.trim()
      },
      shipping: {
        methodId: shipSelect?.value,
        charged: shippingCharged,
        labelCost: shippingLabelCost
      },
      notes: $("order-notes")?.value.trim(),
      items: items.map((it) => ({ id: it.id, name: it.name, price: it.price, cost: it.cost || 0, qty: it.qty })),
      subtotal: totals.subtotal,
      tax: totals.tax,
      total: totals.total,
      fees: fee,
      cogs,
      profit,
      payment: {
        provider: "paypal",
        method: String(opts.method || "paypal"),
        paypalOrderId: paypalDetails?.id || "",
        paypalCaptureId: capture?.id || "",
        paypalStatus: capture?.status || paypalDetails?.status || "",
        payerEmail: paypalDetails?.payer?.email_address || "",
        payerId: paypalDetails?.payer?.payer_id || ""
      }
    };

    return order;
  }


  // ===== CASH APP PAY (Square Web Payments SDK) =====
  function squareMoneyToCents(amount) {
    const n = Number(amount || 0);
    return Math.round(n * 100);
  }

  function loadSquareSdk(env) {
    return new Promise((resolve, reject) => {
      if (window.Square && typeof window.Square.payments === "function") return resolve(true);

      const isLive = String(env || "").toLowerCase() === "live";
      const src = isLive
        ? "https://web.squarecdn.com/v1/square.js"
        : "https://sandbox.web.squarecdn.com/v1/square.js";

      const existing = document.querySelector(`script[data-square-sdk="true"]`);
      if (existing) {
        existing.addEventListener("load", () => resolve(true));
        existing.addEventListener("error", reject);
        return;
      }

      const s = document.createElement("script");
      s.src = src;
      s.async = true;
      s.dataset.squareSdk = "true";
      s.onload = () => resolve(true);
      s.onerror = (e) => reject(e);
      document.head.appendChild(s);
    });
  }

  async function initCashAppPay() {
    if (!cashAppWrap || !cashAppButton) return;

    // Only show Cash App if configured in Dashboard
    if (!settings.squareAppId || !settings.squareLocationId) return;

    // Cash App Pay is US-only (Square requirement).
    // We still try to render; SDK will hide it if not eligible.
    cashAppWrap.style.display = "block";
    if (cashAppStatus) cashAppStatus.textContent = "Loading Cash App Pay...";

    try {
      await loadSquareSdk(settings.squareEnv);

      if (!window.Square || typeof window.Square.payments !== "function") {
        throw new Error("Square SDK not available");
      }

      const payments = window.Square.payments(settings.squareAppId, settings.squareLocationId);

      const shippingCharged = getShipPriceById(shipSelect?.value, settings);
      const totals = calcTotals(items, shippingCharged, settings.taxRate);

      const paymentRequest = payments.paymentRequest({
        countryCode: "US",
        currencyCode: settings.currency || "USD",
        total: { amount: totals.total.toFixed(2), label: "Total" }
      });

      const cashAppPay = await payments.cashAppPay(paymentRequest, {
        redirectURL: window.location.href,
        referenceId: uid()
      });

      await cashAppPay.attach("#cashapp-button");

      if (cashAppStatus) cashAppStatus.textContent = "";

      // Disable / enable based on form validity (same rules as PayPal)
      const setDisabled = () => {
        // Square Cash App Pay doesn't have actions.disable() like PayPal,
        // so we just show a message if form is invalid.
        if (!isFormValid()) {
          if (cashAppStatus) cashAppStatus.textContent = "Fill in your info to enable Cash App Pay.";
        } else if (cashAppStatus && cashAppStatus.textContent === "Fill in your info to enable Cash App Pay.") {
          cashAppStatus.textContent = "";
        }
      };
      ["input", "change", "keyup"].forEach((evt) => form?.addEventListener(evt, setDisabled));
      shipSelect?.addEventListener("change", setDisabled);
      setDisabled();

      cashAppPay.addEventListener("ontokenization", async (event) => {
        const { tokenResult, error } = event.detail || {};
        if (error) {
          console.error(error);
          if (cashAppStatus) cashAppStatus.textContent = "Cash App Pay error. Try again.";
          return;
        }

        if (!isFormValid()) {
          reportValidationErrors();
          if (cashAppStatus) cashAppStatus.textContent = "Please complete your information first.";
          return;
        }

        if (tokenResult?.status !== "OK" || !tokenResult?.token) {
          if (cashAppStatus) cashAppStatus.textContent = "Cash App Pay was cancelled.";
          return;
        }

        if (cashAppStatus) cashAppStatus.textContent = "Processing Cash App payment...";

        const shippingCharged2 = getShipPriceById(shipSelect?.value, settings);
        const totals2 = calcTotals(items, shippingCharged2, settings.taxRate);

        // IMPORTANT: In production, calculate totals on the server to prevent tampering.
        const apiBase = (settings.squareApiBaseUrl || "https://twin-supply.vercel.app").replace(/\/$/, "");
        const localOrderId = uid();
        const payload = {
          sourceId: tokenResult.token,
          idempotencyKey: (crypto?.randomUUID ? crypto.randomUUID() : uid()),
          currency: settings.currency || "USD",
          buyerEmail: $("c-email")?.value.trim() || "",
          locationId: settings.squareLocationId || "",
          cart: items.map((it) => ({ id: it.id, qty: it.qty })),
          shippingMethodId: shipSelect?.value || "standard",
          expectedTotal: totals2.total,
          customer: collectCustomer(),
          notes: $("order-notes")?.value.trim(),
          localOrderId
        };

        try {
          const resp = await fetch(`${apiBase}/api/square-create-payment`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload)
          });

          const data = await resp.json().catch(() => ({}));
          if (!resp.ok) {
            console.error("Square payment failed", data);
            if (cashAppStatus) cashAppStatus.textContent = "Cash App payment failed. Please try again.";
            return;
          }

          // Save order locally (same format as PayPal orders)
          const orders = getJSON(ORDERS_KEY, []);
          const order = buildOrderDraftCashApp(data?.payment || data, { orderId: payload.localOrderId });
          orders.unshift(order);
          setJSON(ORDERS_KEY, orders);

          sendOrderToWebhook(order);

          updateProductsStockAfterOrder(items);
          setJSON(CART_KEY, []);

          window.location.href = "success.html?orderId=" + encodeURIComponent(order.id);
        } catch (e) {
          console.error(e);
          if (cashAppStatus) cashAppStatus.textContent = "Cash App payment failed. Please try again.";
        }
      });
    } catch (err) {
      console.error(err);
      cashAppWrap.style.display = "none";
      if (cashAppStatus) cashAppStatus.textContent = "";
    }
  }

  function buildOrderDraftCashApp(squarePayment, opts = {}) {
    const shippingCharged = getShipPriceById(shipSelect?.value, settings);
    const labelInput = Number(labelCostEl?.value || 0);
    const shippingLabelCost = labelInput > 0 ? labelInput : shippingCharged;

    const totals = calcTotals(items, shippingCharged, settings.taxRate);
    const cogs = items.reduce((sum, it) => sum + Number(it.cost || 0) * it.qty, 0);

    const estFees = totals.total * Number(settings.feePercent || 0) + Number(settings.feeFixed || 0);
    const fee = estFees;

    const profit = totals.total - cogs - fee - shippingLabelCost;

    return {
      id: (opts.orderId || uid()),
      createdAt: new Date().toISOString(),
      status: "paid",
      customer: {
        name: $("c-name")?.value.trim(),
        email: $("c-email")?.value.trim(),
        phone: $("c-phone")?.value.trim(),
        address1: $("c-address1")?.value.trim(),
        address2: $("c-address2")?.value.trim(),
        city: $("c-city")?.value.trim(),
        state: $("c-state")?.value.trim(),
        zip: $("c-zip")?.value.trim(),
        country: $("c-country")?.value.trim()
      },
      shipping: {
        methodId: shipSelect?.value,
        charged: shippingCharged,
        labelCost: shippingLabelCost
      },
      notes: $("order-notes")?.value.trim(),
      items: items.map((it) => ({ id: it.id, name: it.name, price: it.price, cost: it.cost || 0, qty: it.qty })),
      subtotal: totals.subtotal,
      tax: totals.tax,
      total: totals.total,
      fees: fee,
      cogs,
      profit,
      payment: {
        provider: "square",
        method: "cashapp",
        squarePaymentId: squarePayment?.id || "",
        squareStatus: squarePayment?.status || "",
        receiptUrl: squarePayment?.receiptUrl || squarePayment?.receipt_url || ""
      }
    };
  }

  async function initPayPal() {
    if (!ppButtons) return;

    if (!settings.paypalClientId) {
      // Fallback for quick tests: PayPal "sb" client-id (sandbox). 
      // For your own Sandbox/Live, set it in Admin → Dashboard → Payments.
      settings.paypalClientId = "sb";
      if (ppMissing) {
        ppMissing.style.display = "block";
        ppMissing.textContent = "PayPal sandbox is enabled (client-id=sb). For your own Sandbox/Live payments, open Admin → Dashboard → Payments and paste your Client ID.";
      }
    }


    try {
      await loadPayPalSDK(settings.paypalClientId, settings.currency);
    } catch (err) {
      if (ppStatus) ppStatus.textContent = "Payment system failed to load. Try again.";
      console.error(err);
      return;
    }

    if (!window.paypal) {
      if (ppStatus) ppStatus.textContent = "PayPal is not available.";
      return;
    }

    let pendingOrderIdPayPal = null;
    let pendingOrderIdVenmo = null;

    const btn = window.paypal.Buttons({
      style: { layout: "vertical", label: "paypal" },

      onInit: (data, actions) => {
        // Disable by default, enable when form becomes valid
        actions.disable();

        const tick = () => {
          if (isFormValid()) actions.enable();
          else actions.disable();
        };

        // Re-check often enough
        ["input", "change", "keyup"].forEach((evt) => {
          form?.addEventListener(evt, tick);
        });
        shipSelect?.addEventListener("change", tick);

        tick();
      },

      
      createOrder: async (data, actions) => {
        if (!reportValidationErrors()) {
          return Promise.reject(new Error("Form invalid"));
        }

        const shippingCharged = getShipPriceById(shipSelect?.value, settings);
        const totals = calcTotals(items, shippingCharged, settings.taxRate);

        const apiBase = getApiBase();
        const localOrderId = uid();
        pendingOrderIdPayPal = localOrderId;

        const payload = {
          cart: items.map((it) => ({ id: it.id, qty: it.qty })),
          shippingMethodId: shipSelect?.value || "standard",
          expectedTotal: totals.total,
          currency: settings.currency || "USD",
          brandName: settings.paypalBrand || "Twin-Supply",
          referenceId: localOrderId
        };

        try {
          const resp = await fetch(`${apiBase}/api/paypal-create-order`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload)
          });

          const j = await resp.json().catch(() => ({}));
          if (!resp.ok || !j.id) throw new Error(j.error || "Server create order failed");
          return j.id;
        } catch (err) {
          console.error(err);

          // Sandbox fallback (client-only) while setting up server env vars
          if (String(settings.paypalMode || "").toLowerCase() === "sandbox") {
            return actions.order.create({
              intent: "CAPTURE",
              application_context: {
                brand_name: settings.paypalBrand || "Twin-Supply",
                user_action: "PAY_NOW"
              },
              purchase_units: [
                {
                  description: "Twin-Supply Order",
                  amount: {
                    currency_code: settings.currency || "USD",
                    value: totals.total.toFixed(2),
                    breakdown: {
                      item_total: { currency_code: settings.currency || "USD", value: totals.subtotal.toFixed(2) },
                      shipping: { currency_code: settings.currency || "USD", value: Number(shippingCharged || 0).toFixed(2) },
                      tax_total: { currency_code: settings.currency || "USD", value: totals.tax.toFixed(2) }
                    }
                  }
                }
              ]
            });
          }

          if (ppStatus) ppStatus.textContent = "Server payments are not configured. Set PAYPAL_CLIENT_ID + PAYPAL_CLIENT_SECRET on Vercel.";
          throw err;
        }
      },

      
      
          onApprove: async (data, actions) => {
            if (ppStatus) ppStatus.textContent = "Processing payment...";

            const shippingCharged = getShipPriceById(shipSelect?.value, settings);
            const totals = calcTotals(items, shippingCharged, settings.taxRate);

            const apiBase = getApiBase();
            const localOrderId = pendingOrderIdPayPal || uid();

            try {
              let captureDetails = null;

              try {
                const resp = await fetch(`${apiBase}/api/paypal-capture-order`, {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({
                    orderID: data.orderID,
                    cart: items.map((it) => ({ id: it.id, qty: it.qty })),
                    shippingMethodId: shipSelect?.value || "standard",
                    expectedTotal: totals.total,
                    customer: collectCustomer(),
                    notes: $("order-notes")?.value.trim(),
                    method: "paypal",
                    localOrderId
                  })
                });

                const j = await resp.json().catch(() => ({}));
                if (!resp.ok || !j.capture) throw new Error(j.error || "Server capture failed");
                captureDetails = j.capture;
              } catch (serverErr) {
                console.error(serverErr);
                if (String(settings.paypalMode || "").toLowerCase() === "sandbox") {
                  captureDetails = await actions.order.capture();
                } else {
                  throw serverErr;
                }
              }

              const orders = getJSON(ORDERS_KEY, []);
              const order = buildOrderDraft(captureDetails, { method: "paypal", orderId: localOrderId });
              orders.unshift(order);
              setJSON(ORDERS_KEY, orders);

              sendOrderToWebhook(order);

              updateProductsStockAfterOrder(items);
              setJSON(CART_KEY, []);

              pendingOrderIdPayPal = null;
              window.location.href = "success.html?orderId=" + encodeURIComponent(order.id);
            } catch (err) {
              console.error(err);
              if (ppStatus) ppStatus.textContent = "Payment failed. Please try again.";
            }
          },


          onCancel: () => {
        if (ppStatus) ppStatus.textContent = "Payment cancelled.";
      },

      onError: (err) => {
        console.error(err);
        if (ppStatus) ppStatus.textContent = "Payment error. Please try again.";
      }
    });

    if (btn.isEligible()) btn.render("#paypal-buttons");
    else if (ppStatus) ppStatus.textContent = "PayPal is not eligible for this device/browser.";

    // Standalone Venmo button (only shows when eligible; Venmo is not supported in sandbox)
    try {
      if (venmoWrap && venmoButtons && window.paypal?.FUNDING?.VENMO) {
        const vbtn = window.paypal.Buttons({
          fundingSource: window.paypal.FUNDING.VENMO,
          style: { layout: "vertical", label: "venmo" },

          onInit: (data, actions) => {
            actions.disable();

            const tick = () => {
              if (isFormValid()) actions.enable();
              else actions.disable();
            };

            ["input", "change", "keyup"].forEach((evt) => form?.addEventListener(evt, tick));
            shipSelect?.addEventListener("change", tick);

            tick();
          },

          
          createOrder: async (data, actions) => {
            if (!reportValidationErrors()) {
              return Promise.reject(new Error("Form invalid"));
            }

            const shippingCharged = getShipPriceById(shipSelect?.value, settings);
            const totals = calcTotals(items, shippingCharged, settings.taxRate);

            const apiBase = getApiBase();
            const localOrderId = uid();
            pendingOrderIdVenmo = localOrderId;

            const payload = {
              cart: items.map((it) => ({ id: it.id, qty: it.qty })),
              shippingMethodId: shipSelect?.value || "standard",
              expectedTotal: totals.total,
              currency: settings.currency || "USD",
              brandName: settings.paypalBrand || "Twin-Supply",
              referenceId: localOrderId
            };

            try {
              const resp = await fetch(`${apiBase}/api/paypal-create-order`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload)
              });

              const j = await resp.json().catch(() => ({}));
              if (!resp.ok || !j.id) throw new Error(j.error || "Server create order failed");
              return j.id;
            } catch (err) {
              console.error(err);

              if (String(settings.paypalMode || "").toLowerCase() === "sandbox") {
                return actions.order.create({
                  intent: "CAPTURE",
                  application_context: {
                    brand_name: settings.paypalBrand || "Twin-Supply",
                    user_action: "PAY_NOW"
                  },
                  purchase_units: [
                    {
                      description: "Twin-Supply Order",
                      amount: {
                        currency_code: settings.currency || "USD",
                        value: totals.total.toFixed(2),
                        breakdown: {
                          item_total: { currency_code: settings.currency || "USD", value: totals.subtotal.toFixed(2) },
                          shipping: { currency_code: settings.currency || "USD", value: Number(shippingCharged || 0).toFixed(2) },
                          tax_total: { currency_code: settings.currency || "USD", value: totals.tax.toFixed(2) }
                        }
                      }
                    }
                  ]
                });
              }

              if (ppStatus) ppStatus.textContent = "Server payments are not configured. Set PAYPAL_CLIENT_ID + PAYPAL_CLIENT_SECRET on Vercel.";
              throw err;
            }
          },


          onApprove: async (data, actions) => {
            if (ppStatus) ppStatus.textContent = "Processing payment...";

            const shippingCharged = getShipPriceById(shipSelect?.value, settings);
            const totals = calcTotals(items, shippingCharged, settings.taxRate);

            const apiBase = getApiBase();
            const localOrderId = pendingOrderIdVenmo || uid();

            try {
              let captureDetails = null;

              try {
                const resp = await fetch(`${apiBase}/api/paypal-capture-order`, {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({
                    orderID: data.orderID,
                    cart: items.map((it) => ({ id: it.id, qty: it.qty })),
                    shippingMethodId: shipSelect?.value || "standard",
                    expectedTotal: totals.total,
                    customer: collectCustomer(),
                    notes: $("order-notes")?.value.trim(),
                    method: "venmo",
                    localOrderId
                  })
                });

                const j = await resp.json().catch(() => ({}));
                if (!resp.ok || !j.capture) throw new Error(j.error || "Server capture failed");
                captureDetails = j.capture;
              } catch (serverErr) {
                console.error(serverErr);
                // Sandbox fallback
                if (String(settings.paypalMode || "").toLowerCase() === "sandbox") {
                  captureDetails = await actions.order.capture();
                } else {
                  throw serverErr;
                }
              }

              const orders = getJSON(ORDERS_KEY, []);
              const order = buildOrderDraft(captureDetails, { method: "venmo", orderId: localOrderId });
              orders.unshift(order);
              setJSON(ORDERS_KEY, orders);

              sendOrderToWebhook(order);

              updateProductsStockAfterOrder(items);
              setJSON(CART_KEY, []);

              pendingOrderIdVenmo = null;
              window.location.href = "success.html?orderId=" + encodeURIComponent(order.id);
            } catch (err) {
              console.error(err);
              if (ppStatus) ppStatus.textContent = "Payment failed. Please try again.";
            }
          },

          onCancel: () => {
            if (ppStatus) ppStatus.textContent = "Payment cancelled.";
          },

          onError: (err) => {
            console.error(err);
            if (ppStatus) ppStatus.textContent = "Payment failed. Please try again.";
          }
        });

        if (vbtn.isEligible()) {
          venmoWrap.style.display = "block";
          vbtn.render("#venmo-buttons");
        } else {
          venmoWrap.style.display = "none";
        }
      }
    } catch (e) {
      console.error(e);
      if (venmoWrap) venmoWrap.style.display = "none";
    }
  }

  initPayPal();
  initCashAppPay();
})();
(() => {
  "use strict";

  const ORDERS_KEY = "orders";
  const SETTINGS_KEY = "storeSettings";
  const CART_KEY = "cart";

  const $ = (id) => document.getElementById(id);

  function getJSON(key, fallback) {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch {
      return fallback;
    }
  }

  function money(n, currency) {
    const val = Number(n || 0);
    return new Intl.NumberFormat("en-US", { style: "currency", currency: currency || "USD" }).format(val);
  }

  // Always clear cart after successful return (extra safety)
  try { localStorage.setItem(CART_KEY, "[]"); } catch {}

  const settings = getJSON(SETTINGS_KEY, { currency: "USD" });
  const orders = getJSON(ORDERS_KEY, []);

  const params = new URLSearchParams(location.search);
  const orderId = params.get("orderId");

  const idEl = $("order-id");
  const itemsEl = $("order-items");
  const totalEl = $("order-total");
  const payEl = $("payment-info");

  const order = (orders || []).find(o => String(o.id) === String(orderId));

  if (!order) {
    if (idEl) idEl.textContent = "Order not found.";
    if (itemsEl) itemsEl.innerHTML = "";
    if (totalEl) totalEl.textContent = money(0, settings.currency);
    if (payEl) payEl.textContent = "";
    return;
  }

  if (idEl) idEl.textContent = "Order ID: " + order.id;

  const items = Array.isArray(order.items) ? order.items : [];
  if (itemsEl) {
    itemsEl.innerHTML = items.map(it => {
      const line = Number(it.price || 0) * Number(it.qty || 0);
      return `
        <div class="listItem" style="align-items:center">
          <div>
            <div style="font-weight:950">${it.name}</div>
            <div style="color:var(--muted);font-weight:800;font-size:13px;margin-top:4px">Qty: ${it.qty}</div>
          </div>
          <div style="font-weight:950">${money(line, settings.currency)}</div>
        </div>
      `;
    }).join("");
  }

  if (totalEl) totalEl.textContent = money(order.total || 0, settings.currency);

  if (payEl) {
    const p = order.payment || {};
    if (p.provider === "paypal") {
      payEl.textContent = `Paid with PayPal · Capture: ${p.paypalCaptureId || "—"} · Status: ${p.paypalStatus || "—"}`;
    } else {
      payEl.textContent = "Payment recorded.";
    }
  }
})();
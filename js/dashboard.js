(() => {
  "use strict";

  const ADMIN_SESSION_KEY = "adminLogged";

  const PRODUCTS_KEY = window.PRODUCTS_KEY || "products";
  const ORDERS_KEY = "orders";
  const PURCHASES_KEY = "purchases";
  const SETTINGS_KEY = "storeSettings";

  const $ = (id) => document.getElementById(id);

  // ===== GUARD =====
  (function adminGuard() {
    if (localStorage.getItem(ADMIN_SESSION_KEY) !== "true") {
      window.location.href = "admin.html";
    }
  })();

  // ===== HELPERS =====
  function getJSON(key, fallback) {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch {
      return fallback;
    }
  }

  function setJSON(key, val) {
    localStorage.setItem(key, JSON.stringify(val));
  }

  function money(n, currency) {
    const val = Number(n || 0);
    return new Intl.NumberFormat("en-US", { style: "currency", currency: currency || "USD" }).format(val);
  }

  function todayISO() {
    const d = new Date();
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    return `${yyyy}-${mm}-${dd}`;
  }

  function fmtDate(iso) {
    try {
      return new Date(iso).toLocaleString();
    } catch {
      return iso || "";
    }
  }

  function uid(prefix) {
    return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
  }

  function getProductsSafe() {
    const ls = getJSON(PRODUCTS_KEY, null);
    if (Array.isArray(ls) && ls.length) return ls;
    if (Array.isArray(window.allProducts) && window.allProducts.length) return window.allProducts;
    if (Array.isArray(window.baseProducts) && window.baseProducts.length) return window.baseProducts;
    return [];
  }

  function getSettings() {
    const def = {
      currency: "USD",
      taxRate: 0,
      feePercent: 0.029,
      feeFixed: 0.3,
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

    if (!Array.isArray(s.shippingMethods) || !s.shippingMethods.length) {
      s.shippingMethods = def.shippingMethods;
    }

    return s;
  }

  // ===== DATA =====
  let settings = getSettings();
  let products = getProductsSafe();
  let orders = getJSON(ORDERS_KEY, []);
  let purchases = getJSON(PURCHASES_KEY, []);

  // ===== FINANCIALS =====
  function computeOrderFinancials(order, s) {
    const currency = s.currency;

    const subtotal = Number(order.subtotal || 0);
    const tax = Number(order.tax || 0);
    const total = Number(order.total || 0);

    const cogsFromItems = (order.items || []).reduce((sum, it) => sum + (Number(it.cost || 0) * Number(it.qty || 0)), 0);
    const cogs = Number(order.cogs ?? cogsFromItems);

    const labelCost = Number(order.shipping?.labelCost || 0);

    let fees;
    if (typeof order.fees === "number") {
      fees = Number(order.fees);
    } else {
      fees = (total * Number(s.feePercent || 0)) + Number(s.feeFixed || 0);
    }

    const profit = total - cogs - fees - labelCost;

    return { subtotal, tax, total, cogs, labelCost, fees, profit, currency };
  }

  function isPaidStatus(st) {
    const s = String(st || "").toLowerCase();
    return ["paid", "shipped", "delivered"].includes(s);
  }

  // ===== KPI =====
  function renderKPIs() {
    const paid = orders.filter((o) => isPaidStatus(o.status));
    const revenue = paid.reduce((sum, o) => sum + Number(o.total || 0), 0);
    const profit = paid.reduce((sum, o) => sum + computeOrderFinancials(o, settings).profit, 0);
    const units = paid.reduce((sum, o) => sum + (o.items || []).reduce((ss, it) => ss + Number(it.qty || 0), 0), 0);
    const pending = orders.filter((o) => String(o.status || "").toLowerCase() === "pending").length;

    $("kpi-revenue").textContent = money(revenue, settings.currency);
    $("kpi-profit").textContent = money(profit, settings.currency);
    $("kpi-orders").textContent = String(orders.length);
    $("kpi-pending").textContent = String(pending);
    $("kpi-units").textContent = String(units);
  }

  // ===== ORDERS TABLE =====
  function badge(status) {
    const s = String(status || "pending").toLowerCase();
    return `<span class="pill ${s}">${s.toUpperCase()}</span>`;
  }

  function renderOrders() {
    const tb = $("orders-tbody");
    if (!tb) return;

    tb.innerHTML = orders
      .slice(0, 30)
      .map((o) => {
        const f = computeOrderFinancials(o, settings);
        const email = o.customer?.email ? String(o.customer.email) : "—";
        return `
          <tr>
            <td>${fmtDate(o.createdAt)}</td>
            <td><b>${o.id || ""}</b></td>
            <td>${email}</td>
            <td>${badge(o.status)}</td>
            <td>${money(f.total, settings.currency)}</td>
            <td>${money(f.profit, settings.currency)}</td>
            <td>
              <select class="miniSelect" data-status-id="${o.id}">
                ${["pending", "paid", "shipped", "delivered", "cancelled"]
                  .map((s) => `<option value="${s}" ${String(o.status).toLowerCase() === s ? "selected" : ""}>${s}</option>`)
                  .join("")}
              </select>
              <button class="btn" data-view-id="${o.id}" type="button" style="padding:10px 12px">View</button>
            </td>
          </tr>
        `;
      })
      .join("");

    tb.querySelectorAll("[data-status-id]").forEach((sel) => {
      sel.addEventListener("change", () => {
        const id = sel.getAttribute("data-status-id");
        const o = orders.find((x) => x.id === id);
        if (!o) return;
        o.status = sel.value;
        setJSON(ORDERS_KEY, orders);
        renderKPIs();
        renderOrders();
      });
    });

    tb.querySelectorAll("[data-view-id]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const id = btn.getAttribute("data-view-id");
        showOrderDetails(id);
      });
    });
  }

  function clearOrderDetails() {
    const panel = $("order-detail");
    const body = $("order-detail-body");
    if (body) body.innerHTML = "";
    if (panel) panel.style.display = "none";
  }

  function showOrderDetails(orderId) {
    const panel = $("order-detail");
    const body = $("order-detail-body");
    if (!panel || !body) return;

    const o = orders.find((x) => x.id === orderId);
    if (!o) {
      body.innerHTML = `<div style="color:var(--muted);font-weight:800">Order not found.</div>`;
      panel.style.display = "block";
      return;
    }

    const f = computeOrderFinancials(o, settings);
    const itemsHtml = (o.items || [])
      .map((it) => {
        const line = Number(it.price || 0) * Number(it.qty || 0);
        return `
          <div class="miniLine">
            <div>
              <div style="font-weight:950">${it.name || "Item"}</div>
              <div style="color:var(--muted);font-weight:800;font-size:13px;margin-top:4px">
                Qty: ${it.qty} · Price: ${money(it.price || 0, settings.currency)} · Cost: ${money(it.cost || 0, settings.currency)}
              </div>
            </div>
            <div style="font-weight:950">${money(line, settings.currency)}</div>
          </div>
        `;
      })
      .join("");

    body.innerHTML = `
      <div class="miniGrid">
        <div class="miniCard">
          <div class="miniLabel">Order</div>
          <div class="miniValue">${o.id}</div>
        </div>
        <div class="miniCard">
          <div class="miniLabel">Status</div>
          <div class="miniValue">${String(o.status || "pending").toUpperCase()}</div>
        </div>
        <div class="miniCard">
          <div class="miniLabel">Total</div>
          <div class="miniValue">${money(f.total, settings.currency)}</div>
        </div>
        <div class="miniCard">
          <div class="miniLabel">Profit</div>
          <div class="miniValue">${money(f.profit, settings.currency)}</div>
        </div>
      </div>

      <div style="margin-top:12px" class="miniStack">
        <div class="miniCard">
          <div class="miniLabel">Customer</div>
          <div class="miniValue" style="font-weight:900">${o.customer?.name || "—"}</div>
          <div style="color:var(--muted);font-weight:800;font-size:13px;margin-top:4px">${o.customer?.email || ""}</div>
        </div>
        <div class="miniCard">
          <div class="miniLabel">Shipping</div>
          <div class="miniValue" style="font-weight:900">${o.shipping?.methodName || o.shipping?.methodId || "—"}</div>
          <div style="color:var(--muted);font-weight:800;font-size:13px;margin-top:4px">
            Charged: ${money(o.shipping?.charged || 0, settings.currency)} · Label: ${money(o.shipping?.labelCost || 0, settings.currency)}
          </div>
        </div>
      </div>

      <div style="margin-top:12px" class="miniCard">
        <div class="miniLabel">Items</div>
        <div style="margin-top:10px">${itemsHtml || `<div style="color:var(--muted);font-weight:800">No items.</div>`}</div>
      </div>

      <div style="margin-top:12px" class="miniCard">
        <div class="miniLabel">Totals</div>
        <div class="miniTotals">
          <div><span>Subtotal</span><b>${money(o.subtotal || 0, settings.currency)}</b></div>
          <div><span>Tax</span><b>${money(o.tax || 0, settings.currency)}</b></div>
          <div><span>Fees</span><b>${money(f.fees, settings.currency)}</b></div>
          <div><span>COGS</span><b>${money(f.cogs, settings.currency)}</b></div>
          <div><span>Label</span><b>${money(f.labelCost, settings.currency)}</b></div>
          <div><span>Total</span><b>${money(f.total, settings.currency)}</b></div>
        </div>
      </div>
    `;

    panel.style.display = "block";
    window.scrollTo({ top: panel.getBoundingClientRect().top + window.scrollY - 30, behavior: "smooth" });
  }

  // Close details (button exists in HTML)
  $("detail-close")?.addEventListener("click", clearOrderDetails);

  // ===== EXPORT / IMPORT =====
  $("export-btn")?.addEventListener("click", () => {
    const payload = {
      exportedAt: new Date().toISOString(),
      products: getJSON(PRODUCTS_KEY, products),
      orders: getJSON(ORDERS_KEY, orders),
      purchases: getJSON(PURCHASES_KEY, purchases),
      settings: getJSON(SETTINGS_KEY, settings)
    };

    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "twins-supply-backup.json";
    a.click();
    URL.revokeObjectURL(a.href);
  });

  $("import-file")?.addEventListener("change", (e) => {
    const file = e.target.files && e.target.files[0];
    if (!file) return;

    const r = new FileReader();
    r.onload = function () {
      try {
        const data = JSON.parse(String(r.result || "{}"));
        if (data.products) setJSON(PRODUCTS_KEY, data.products);
        if (data.orders) setJSON(ORDERS_KEY, data.orders);
        if (data.purchases) setJSON(PURCHASES_KEY, data.purchases);
        if (data.settings) setJSON(SETTINGS_KEY, data.settings);
        window.location.reload();
      } catch {
        alert("Invalid backup file.");
      }
    };
    r.readAsText(file);
  });

  // Logout
  $("dash-logout")?.addEventListener("click", () => {
    localStorage.removeItem(ADMIN_SESSION_KEY);
    window.location.href = "admin.html";
  });

  // ===== CALCULATOR =====
  function initCalculator() {
    $("calc-fee-percent").value = String((Number(settings.feePercent || 0) * 100).toFixed(2));
    $("calc-fee-fixed").value = String(Number(settings.feeFixed || 0).toFixed(2));

    $("calc-run")?.addEventListener("click", () => {
      const price = Number($("calc-price").value || 0);
      const cost = Number($("calc-cost").value || 0);
      const ship = Number($("calc-ship").value || 0);
      const extra = Number($("calc-extra").value || 0);

      const feePct = Number($("calc-fee-percent").value || 0) / 100;
      const feeFixed = Number($("calc-fee-fixed").value || 0);

      const fees = (price * feePct) + feeFixed;
      const prof = price - cost - ship - extra - fees;

      $("calc-profit").textContent = money(prof, settings.currency);
      const margin = price > 0 ? (prof / price) * 100 : 0;
      $("calc-margin").textContent = `${margin.toFixed(1)}%`;

      const denom = 1 - feePct;
      const be = denom > 0 ? (cost + ship + extra + feeFixed) / denom : 0;
      $("calc-breakeven").textContent = money(be, settings.currency);
    });
  }

  // ===== SETTINGS =====
  function renderSettingsForm() {
    $("set-tax").value = String(Number(settings.taxRate || 0));
    $("set-currency").value = String(settings.currency || "USD").toUpperCase();
    $("set-fee-percent").value = String(Number(settings.feePercent || 0));
    $("set-fee-fixed").value = String(Number(settings.feeFixed || 0));

    // Shipping method prices
    const mStandard = settings.shippingMethods.find((m) => m.id === "standard");
    const mExpress = settings.shippingMethods.find((m) => m.id === "express");
    const mPickup = settings.shippingMethods.find((m) => m.id === "pickup");

    $("ship-standard").value = String(Number(mStandard?.price || 0));
    $("ship-express").value = String(Number(mExpress?.price || 0));
    $("ship-pickup").value = String(Number(mPickup?.price || 0));

    if ($("paypal-client-id")) $("paypal-client-id").value = String(settings.paypalClientId || "");
    if ($("paypal-mode")) $("paypal-mode").value = String(settings.paypalMode || "sandbox");
    if ($("paypal-brand")) $("paypal-brand").value = String(settings.paypalBrand || "Twin-Supply");
    if ($("square-app-id")) $("square-app-id").value = String(settings.squareAppId || "");
    if ($("square-location-id")) $("square-location-id").value = String(settings.squareLocationId || "");
    if ($("square-env")) $("square-env").value = String(settings.squareEnv || "sandbox");
    if ($("square-api-base")) $("square-api-base").value = String(settings.squareApiBaseUrl || "https://twin-supply.vercel.app");
    if ($("order-webhook-url")) $("order-webhook-url").value = String(settings.orderWebhookUrl || "");
    if ($("order-webhook-token")) $("order-webhook-token").value = String(settings.orderWebhookToken || "");
  }

  $("save-settings")?.addEventListener("click", () => {
    settings.taxRate = Number($("set-tax").value || 0);
    settings.currency = String($("set-currency").value || "USD").trim().toUpperCase();
    settings.feePercent = Number($("set-fee-percent").value || 0);
    settings.feeFixed = Number($("set-fee-fixed").value || 0);

    settings.paypalClientId = String($("paypal-client-id")?.value || "").trim();
    settings.paypalMode = (String($("paypal-mode")?.value || "sandbox").toLowerCase() === "live") ? "live" : "sandbox";
    settings.paypalBrand = String($("paypal-brand")?.value || "Twin-Supply").trim() || "Twin-Supply";
    settings.orderWebhookUrl = String($("order-webhook-url")?.value || "").trim();
    settings.orderWebhookToken = String($("order-webhook-token")?.value || "").trim();
    settings.squareAppId = String($("square-app-id")?.value || "").trim();
    settings.squareLocationId = String($("square-location-id")?.value || "").trim();
    settings.squareEnv = (String($("square-env")?.value || "sandbox").toLowerCase() === "live") ? "live" : "sandbox";
    settings.squareApiBaseUrl = String($("square-api-base")?.value || "https://twin-supply.vercel.app").trim() || "https://twin-supply.vercel.app";


    const shipStandard = Number($("ship-standard").value || 0);
    const shipExpress = Number($("ship-express").value || 0);
    const shipPickup = Number($("ship-pickup").value || 0);

    const methods = settings.shippingMethods || [];
    const upsert = (id, name, price) => {
      const m = methods.find((x) => x.id === id);
      if (m) {
        m.name = m.name || name;
        m.price = price;
      } else {
        methods.push({ id, name, price });
      }
    };

    upsert("standard", "Standard", shipStandard);
    upsert("express", "Express", shipExpress);
    upsert("pickup", "Pickup", shipPickup);
    settings.shippingMethods = methods;

    setJSON(SETTINGS_KEY, settings);
    $("settings-msg").textContent = "Saved.";
    setTimeout(() => ($("settings-msg").textContent = ""), 1200);

    // Refresh in-memory settings
    settings = getSettings();
    renderKPIs();
    renderOrders();
    initCalculator();
  });

  // ===== PURCHASES / RESTOCKS =====
  function weightedCost(oldCost, oldStock, addCost, addQty) {
    const a = Number(oldStock || 0);
    const b = Number(addQty || 0);
    const oc = Number(oldCost || 0);
    const nc = Number(addCost || 0);
    const total = a + b;
    if (total <= 0) return nc;
    return ((oc * a) + (nc * b)) / total;
  }

  function fillPurchaseProducts() {
    const sel = $("pur-product");
    if (!sel) return;

    products = getProductsSafe();
    sel.innerHTML = products
      .map((p) => {
        const stock = Number(p.stock || 0);
        return `<option value="${p.id}">${p.name} (stock: ${stock})</option>`;
      })
      .join("");
  }

  function renderPurchases() {
    const tb = $("purchases-tbody");
    if (!tb) return;

    tb.innerHTML = purchases
      .slice(0, 12)
      .map((p) => {
        return `
          <tr>
            <td>${p.date || ""}</td>
            <td>${p.productName || ""}</td>
            <td>${Number(p.qty || 0)}</td>
            <td>${money(p.unitCost || 0, settings.currency)}</td>
            <td>${money(Number(p.qty || 0) * Number(p.unitCost || 0), settings.currency)}</td>
          </tr>
        `;
      })
      .join("");
  }

  $("pur-save")?.addEventListener("click", () => {
    const msg = $("pur-msg");
    msg.textContent = "";

    const date = $("pur-date").value;
    const vendor = String($("pur-vendor").value || "").trim();
    const pid = $("pur-product").value;
    const qty = Math.max(1, Number($("pur-qty").value || 1));
    const unitCost = Number($("pur-cost").value || 0);
    const notes = String($("pur-notes").value || "").trim();

    if (!date) {
      msg.textContent = "Pick a date.";
      return;
    }
    if (!pid) {
      msg.textContent = "Select a product.";
      return;
    }

    const list = getJSON(PRODUCTS_KEY, getProductsSafe());
    const p = list.find((x) => String(x.id) === String(pid));
    if (!p) {
      msg.textContent = "Product not found.";
      return;
    }

    const oldStock = Number(p.stock || 0);
    const newStock = oldStock + qty;
    const oldCost = Number(p.cost || 0);
    const newCost = unitCost > 0 ? weightedCost(oldCost, oldStock, unitCost, qty) : oldCost;

    p.stock = newStock;
    if (unitCost > 0) p.cost = Number(newCost.toFixed(2));

    setJSON(PRODUCTS_KEY, list);

    const row = {
      id: uid("PUR"),
      date,
      vendor,
      productId: p.id,
      productName: p.name,
      qty,
      unitCost,
      notes
    };

    purchases.unshift(row);
    setJSON(PURCHASES_KEY, purchases);

    msg.textContent = "Saved. Stock updated.";
    setTimeout(() => (msg.textContent = ""), 1500);

    fillPurchaseProducts();
    renderPurchases();
  });

  // Clear orders
  $("orders-clear")?.addEventListener("click", () => {
    if (!confirm("Delete ALL orders? This cannot be undone.")) return;
    orders = [];
    setJSON(ORDERS_KEY, orders);
    clearOrderDetails();
    renderKPIs();
    renderOrders();
  });

  // ===== START =====
  renderSettingsForm();
  initCalculator();
  renderKPIs();
  renderOrders();
  fillPurchaseProducts();
  renderPurchases();

  // Default purchase date
  $("pur-date").value = todayISO();
})();

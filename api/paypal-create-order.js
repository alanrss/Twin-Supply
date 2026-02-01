// api/paypal-create-order.js (Vercel Serverless Function - Node.js)
// Creates a PayPal order on the server (prevents client-side total tampering).

module.exports = async (req, res) => {
  const allowedOrigin = process.env.ALLOWED_ORIGIN || "*";
  const origin = req.headers.origin || "";

  res.setHeader("Vary", "Origin");
  res.setHeader("Access-Control-Allow-Origin", allowedOrigin === "*" ? "*" : allowedOrigin);
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Use POST" });

  if (allowedOrigin !== "*" && origin !== allowedOrigin) {
    return res.status(403).json({ error: "Forbidden origin" });
  }

  // ---- helpers ----
  async function readJsonBody(r) {
    // Vercel may not populate req.body in this runtime
    if (r.body && typeof r.body === "object") return r.body;
    const chunks = [];
    for await (const c of r) chunks.push(c);
    const raw = Buffer.concat(chunks).toString("utf8") || "{}";
    try { return JSON.parse(raw); } catch { return {}; }
  }

  function round2(n) {
    return Math.round((Number(n || 0) + Number.EPSILON) * 100) / 100;
  }

  function getShippingPrice(methodId) {
    const id = String(methodId || "").toLowerCase();
    const std = Number(process.env.SHIPPING_STANDARD_PRICE || 7.99);
    const exp = Number(process.env.SHIPPING_EXPRESS_PRICE || 14.99);
    const pick = Number(process.env.SHIPPING_PICKUP_PRICE || 0);
    if (id === "express") return exp;
    if (id === "pickup") return pick;
    return std; // default standard
  }

  function getTaxRate() {
    const r = Number(process.env.TAX_RATE || 0);
    if (!Number.isFinite(r)) return 0;
    // TAX_RATE is stored as a percentage in Dashboard (e.g. 7.5 for 7.5%).
    return Math.min(Math.max(r, 0), 100) / 100;
  }

  function loadProducts() {
    // bundled with deployment; for real-time sync you'd use a DB
    const fs = require("fs");
    const path = require("path");
    const p = path.join(__dirname, "..", "data", "products.json");
    const raw = fs.readFileSync(p, "utf8");
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? arr : [];
  }

  function normalizeCart(cart) {
    if (!Array.isArray(cart)) return [];
    return cart
      .map((x) => ({
        id: Number(x?.id),
        qty: Math.max(1, Math.min(999, Number(x?.qty || x?.quantity || 1)))
      }))
      .filter((x) => Number.isFinite(x.id) && Number.isFinite(x.qty) && x.qty > 0);
  }

  function calcTotalsFromCart(cartItems, products, shippingMethodId) {
    const byId = new Map(products.map((p) => [Number(p.id), p]));
    const currency = String(process.env.CURRENCY || "USD").toUpperCase();

    let subtotal = 0;
    const items = [];

    for (const it of cartItems) {
      const p = byId.get(Number(it.id));
      if (!p) continue;
      const price = Number(p.price || 0);
      const qty = Math.max(1, Math.floor(Number(it.qty || 1)));
      if (!Number.isFinite(price) || price <= 0) continue;
      subtotal += price * qty;
      items.push({
        name: String(p.name || "Item").slice(0, 127),
        unit_amount: { currency_code: currency, value: round2(price).toFixed(2) },
        quantity: String(qty),
        category: "PHYSICAL_GOODS"
      });
    }

    subtotal = round2(subtotal);
    const shipping = round2(getShippingPrice(shippingMethodId));
    const tax = round2(subtotal * getTaxRate());
    const total = round2(subtotal + shipping + tax);

    return { currency, subtotal, shipping, tax, total, items };
  }

  async function paypalAccessToken(baseUrl, clientId, secret) {
    const basic = Buffer.from(`${clientId}:${secret}`).toString("base64");
    const resp = await fetch(`${baseUrl}/v1/oauth2/token`, {
      method: "POST",
      headers: {
        Authorization: `Basic ${basic}`,
        "Content-Type": "application/x-www-form-urlencoded"
      },
      body: "grant_type=client_credentials"
    });
    const data = await resp.json().catch(() => ({}));
    if (!resp.ok || !data.access_token) {
      throw new Error(`PayPal auth failed: ${resp.status} ${JSON.stringify(data)}`);
    }
    return data.access_token;
  }

  // ---- main ----
  try {
    const body = await readJsonBody(req);

    const paypalClientId = process.env.PAYPAL_CLIENT_ID;
    const paypalSecret = process.env.PAYPAL_CLIENT_SECRET;
    const paypalEnv = String(process.env.PAYPAL_ENV || "sandbox").toLowerCase();
    const baseUrl = paypalEnv === "live" || paypalEnv === "production"
      ? "https://api-m.paypal.com"
      : "https://api-m.sandbox.paypal.com";

    if (!paypalClientId || !paypalSecret) {
      return res.status(500).json({ error: "Missing PAYPAL_CLIENT_ID / PAYPAL_CLIENT_SECRET env vars" });
    }

    const cart = normalizeCart(body.cart);
    if (!cart.length) return res.status(400).json({ error: "Cart is empty" });

    const shippingMethodId = String(body.shippingMethodId || "standard");
    const expectedTotal = Number(body.expectedTotal || 0);

    const products = loadProducts();
    const totals = calcTotalsFromCart(cart, products, shippingMethodId);

    // Optional mismatch check (client UI total vs server total)
    if (Number.isFinite(expectedTotal) && expectedTotal > 0) {
      if (Math.abs(round2(expectedTotal) - totals.total) > 0.01) {
        return res.status(400).json({
          error: "Totals mismatch",
          serverTotal: totals.total,
          clientTotal: round2(expectedTotal)
        });
      }
    }

    const referenceId = String(body.referenceId || `TS-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`);

    const accessToken = await paypalAccessToken(baseUrl, paypalClientId, paypalSecret);

    const orderBody = {
      intent: "CAPTURE",
      application_context: {
        brand_name: String(process.env.PAYPAL_BRAND || body.brandName || "Twin-Supply").slice(0, 127),
        user_action: "PAY_NOW"
      },
      purchase_units: [
        {
          custom_id: referenceId,
          description: "Twin-Supply Order",
          amount: {
            currency_code: totals.currency,
            value: totals.total.toFixed(2),
            breakdown: {
              item_total: { currency_code: totals.currency, value: totals.subtotal.toFixed(2) },
              shipping: { currency_code: totals.currency, value: totals.shipping.toFixed(2) },
              tax_total: { currency_code: totals.currency, value: totals.tax.toFixed(2) }
            }
          },
          items: totals.items
        }
      ]
    };

    const createResp = await fetch(`${baseUrl}/v2/checkout/orders`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify(orderBody)
    });

    const createData = await createResp.json().catch(() => ({}));
    if (!createResp.ok || !createData.id) {
      return res.status(500).json({ error: "PayPal create order failed", detail: createData });
    }

    return res.status(200).json({
      id: createData.id,
      referenceId,
      totals,
      links: createData.links || []
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Server error", detail: String(err) });
  }
};

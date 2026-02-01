// api/square-create-payment.js (Vercel Serverless Function - Node.js)
// Creates a Square payment using a one-time token from the Web Payments SDK (Cash App Pay, cards, etc.)
// Server computes totals from data/products.json (prevents client-side tampering) and can send emails + decrement stock.

const { SquareClient, SquareEnvironment, SquareError } = require("square");

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

  const token = process.env.SQUARE_ACCESS_TOKEN;
  if (!token) return res.status(500).json({ error: "Missing SQUARE_ACCESS_TOKEN env var" });

  async function readJsonBody(r) {
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
    return std;
  }

  function getTaxRate() {
    const r = Number(process.env.TAX_RATE || 0);
    if (!Number.isFinite(r)) return 0;
    // TAX_RATE is stored as a percentage in Dashboard (e.g. 7.5 for 7.5%).
    return Math.min(Math.max(r, 0), 100) / 100;
  }

  function loadProductsLocal() {
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
      items.push({ id: Number(p.id), name: String(p.name || "Item"), price: round2(price), qty });
    }

    subtotal = round2(subtotal);
    const shipping = round2(getShippingPrice(shippingMethodId));
    const tax = round2(subtotal * getTaxRate());
    const total = round2(subtotal + shipping + tax);

    return { currency, subtotal, shipping, tax, total, items };
  }

  function htmlEscape(s) {
    return String(s || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  async function sendEmailIfConfigured({ to, subject, html }) {
    const apiKey = process.env.RESEND_API_KEY;
    const from = process.env.EMAIL_FROM;
    if (!apiKey || !from || !to) return { skipped: true };
    const resp = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ from, to, subject, html })
    });
    const data = await resp.json().catch(() => ({}));
    if (!resp.ok) throw new Error(`Resend error: ${resp.status} ${JSON.stringify(data)}`);
    return data;
  }

  function buildEmailHtml({ orderId, customer, totals, items, payment }) {
    const cust = customer || {};
    const lines = (items || []).map((it) => {
      return `<tr>
        <td style="padding:6px 0;">${htmlEscape(it.name)}</td>
        <td style="padding:6px 0; text-align:center;">${htmlEscape(it.qty)}</td>
        <td style="padding:6px 0; text-align:right;">$${htmlEscape(Number(it.price).toFixed(2))}</td>
      </tr>`;
    }).join("");

    return `
      <div style="font-family:Arial,sans-serif;max-width:640px;margin:0 auto;">
        <h2>Order Confirmation</h2>
        <p><strong>Order:</strong> ${htmlEscape(orderId)}</p>
        <p><strong>Payment:</strong> ${htmlEscape(payment?.provider || "square")} ${payment?.method ? `(${htmlEscape(payment.method)})` : ""}</p>

        <h3>Customer</h3>
        <p style="line-height:1.5;">
          ${htmlEscape(cust.name)}<br/>
          ${htmlEscape(cust.email)}<br/>
          ${htmlEscape(cust.phone || "")}<br/>
          ${htmlEscape(cust.address1)} ${htmlEscape(cust.address2 || "")}<br/>
          ${htmlEscape(cust.city)}, ${htmlEscape(cust.state)} ${htmlEscape(cust.zip)}<br/>
          ${htmlEscape(cust.country)}
        </p>

        <h3>Items</h3>
        <table style="width:100%;border-collapse:collapse;">
          <thead>
            <tr>
              <th style="text-align:left;border-bottom:1px solid #eee;padding:6px 0;">Item</th>
              <th style="text-align:center;border-bottom:1px solid #eee;padding:6px 0;">Qty</th>
              <th style="text-align:right;border-bottom:1px solid #eee;padding:6px 0;">Price</th>
            </tr>
          </thead>
          <tbody>${lines}</tbody>
        </table>

        <h3>Totals</h3>
        <p style="line-height:1.8;">
          Subtotal: $${htmlEscape(totals.subtotal.toFixed(2))}<br/>
          Shipping: $${htmlEscape(totals.shipping.toFixed(2))}<br/>
          Tax: $${htmlEscape(totals.tax.toFixed(2))}<br/>
          <strong>Total: $${htmlEscape(totals.total.toFixed(2))}</strong>
        </p>
      </div>
    `;
  }

  async function decrementStockOnGitHub(items) {
    const owner = process.env.GITHUB_OWNER;
    const repo = process.env.GITHUB_REPO;
    const branch = process.env.GITHUB_BRANCH || "main";
    const filePath = process.env.GITHUB_FILE_PATH || "data/products.json";
    const token = process.env.GITHUB_TOKEN;
    if (!owner || !repo || !token) return { skipped: true };

    const getUrl = `https://api.github.com/repos/${owner}/${repo}/contents/${filePath}?ref=${branch}`;
    const getResp = await fetch(getUrl, {
      headers: { Authorization: `Bearer ${token}`, Accept: "application/vnd.github+json" }
    });
    if (!getResp.ok) {
      const detail = await getResp.text();
      return { error: "GitHub GET failed", detail };
    }
    const existing = await getResp.json();
    const sha = existing.sha;
    const content = Buffer.from(existing.content || "", "base64").toString("utf8");
    let products = [];
    try { products = JSON.parse(content); } catch { products = []; }
    if (!Array.isArray(products)) products = [];

    const byId = new Map(items.map((it) => [Number(it.id), Number(it.qty)]));
    const updated = products.map((p) => {
      const id = Number(p.id);
      const dec = byId.get(id);
      if (!dec) return p;
      const stock = Number(p.stock);
      if (!Number.isFinite(stock)) return p;
      const next = Math.max(0, stock - Math.max(1, Math.floor(dec)));
      return { ...p, stock: next };
    });

    const jsonText = JSON.stringify(updated, null, 2);
    const contentB64 = Buffer.from(jsonText, "utf8").toString("base64");

    const putUrl = `https://api.github.com/repos/${owner}/${repo}/contents/${filePath}`;
    const putBody = {
      message: `Decrement stock (${new Date().toISOString()})`,
      content: contentB64,
      branch,
      sha
    };

    const putResp = await fetch(putUrl, {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/vnd.github+json",
        "Content-Type": "application/json"
      },
      body: JSON.stringify(putBody)
    });

    if (!putResp.ok) {
      const detail = await putResp.text();
      return { error: "GitHub PUT failed", detail };
    }

    return { ok: true };
  }

  try {
    let body = await readJsonBody(req);
    body = body || {};

    const sourceId = String(body.sourceId || "").trim();
    const idempotencyKey = String(body.idempotencyKey || "").trim();
    const currency = String(body.currency || process.env.CURRENCY || "USD").trim().toUpperCase();
    const buyerEmailAddress = String(body.buyerEmail || "").trim();
    const locationId = String(body.locationId || "").trim();

    if (!sourceId) return res.status(400).json({ error: "Missing sourceId" });
    if (!idempotencyKey) return res.status(400).json({ error: "Missing idempotencyKey" });

    const cart = normalizeCart(body.cart);
    const shippingMethodId = String(body.shippingMethodId || "standard");
    const expectedTotal = Number(body.expectedTotal || 0);

    let totals = null;
    if (cart.length) {
      const products = loadProductsLocal();
      totals = calcTotalsFromCart(cart, products, shippingMethodId);
      if (Number.isFinite(expectedTotal) && expectedTotal > 0) {
        if (Math.abs(round2(expectedTotal) - totals.total) > 0.01) {
          return res.status(400).json({
            error: "Totals mismatch",
            serverTotal: totals.total,
            clientTotal: round2(expectedTotal)
          });
        }
      }
    } else {
      // backward compatibility (not recommended)
      const amountNum = Number(body.amount || 0);
      if (!Number.isFinite(amountNum) || amountNum <= 0) return res.status(400).json({ error: "Invalid amount" });
      totals = { currency, subtotal: amountNum, shipping: 0, tax: 0, total: round2(amountNum), items: [] };
    }

    const cents = Math.round(Number(totals.total) * 100);
    if (!Number.isFinite(cents) || cents <= 0) return res.status(400).json({ error: "Invalid server amount" });

    const env = String(process.env.SQUARE_ENV || "sandbox").toLowerCase();
    const environment = env === "production" || env === "live" ? SquareEnvironment.Production : SquareEnvironment.Sandbox;

    const client = new SquareClient({ token, environment });

    const result = await client.payments.create({
      sourceId,
      idempotencyKey,
      amountMoney: {
        amount: BigInt(cents),
        currency: currency
      },
      autocomplete: true,
      ...(locationId ? { locationId } : {}),
      ...(buyerEmailAddress ? { buyerEmailAddress } : {})
    });

    const payment = result?.payment || result;

    // Stock decrement (best-effort)
    const stockResult = await decrementStockOnGitHub(totals.items);

    // Email (best-effort; only if configured)
    const adminEmail = process.env.ADMIN_EMAIL;
    const customer = body.customer || {};
    const orderId = String(body.localOrderId || body.referenceId || `TS-${Date.now()}`);
    const payInfo = {
      provider: "square",
      method: "cashapp",
      squarePaymentId: payment?.id || "",
      squareStatus: payment?.status || ""
    };

    const emailHtml = buildEmailHtml({ orderId, customer, totals, items: totals.items, payment: payInfo });

    let emailResult = { skipped: true };
    try {
      if (adminEmail) {
        await sendEmailIfConfigured({
          to: adminEmail,
          subject: `New Order ${orderId} (Cash App Pay)`,
          html: emailHtml
        });
      }
      const custEmail = String(customer.email || buyerEmailAddress || "").trim();
      if (custEmail && custEmail.includes("@")) {
        await sendEmailIfConfigured({
          to: custEmail,
          subject: `Your order ${orderId} is confirmed`,
          html: emailHtml
        });
      }
      emailResult = { ok: true };
    } catch (e) {
      console.error("Email failed", e);
      emailResult = { error: String(e) };
    }

    return res.status(200).json({ ok: true, payment, totals, stock: stockResult, email: emailResult });
  } catch (err) {
    if (err instanceof SquareError) {
      return res.status(err.statusCode || 500).json({
        error: "SquareError",
        message: err.message,
        body: err.body
      });
    }
    console.error(err);
    return res.status(500).json({ error: "Square payment failed", detail: String(err) });
  }
};

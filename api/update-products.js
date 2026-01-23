// api/update-products.js (Vercel Serverless Function - Node.js)
module.exports = async (req, res) => {
  const allowedOrigin = process.env.ALLOWED_ORIGIN || "*";
  const origin = req.headers.origin || "";

  res.setHeader("Vary", "Origin");
  res.setHeader("Access-Control-Allow-Origin", allowedOrigin === "*" ? "*" : allowedOrigin);
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, X-Admin-Key");

  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Use POST" });

  if (allowedOrigin !== "*" && origin !== allowedOrigin) {
    return res.status(403).json({ error: "Forbidden origin" });
  }

  const adminKey = req.headers["x-admin-key"];
  if (!process.env.ADMIN_KEY || adminKey !== process.env.ADMIN_KEY) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  // read raw body
  async function readJsonBody(r) {
    const chunks = [];
    for await (const c of r) chunks.push(c);
    const raw = Buffer.concat(chunks).toString("utf8") || "{}";
    return JSON.parse(raw);
  }

  try {
    const body = await readJsonBody(req);
    const products = body?.products;

    if (!Array.isArray(products)) {
      return res.status(400).json({ error: "Body debe incluir { products: [] }" });
    }

    const owner = process.env.GITHUB_OWNER;
    const repo = process.env.GITHUB_REPO;
    const branch = process.env.GITHUB_BRANCH || "main";
    const filePath = process.env.GITHUB_FILE_PATH || "data/products.json";
    const token = process.env.GITHUB_TOKEN;

    if (!owner || !repo || !token) {
      return res.status(500).json({ error: "Missing server env vars" });
    }

    // 1) obtener SHA actual si existe
    const getUrl = `https://api.github.com/repos/${owner}/${repo}/contents/${filePath}?ref=${branch}`;
    const getResp = await fetch(getUrl, {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/vnd.github+json"
      }
    });

    let sha = null;
    if (getResp.ok) {
      const existing = await getResp.json();
      sha = existing.sha;
    } else if (getResp.status !== 404) {
      const detail = await getResp.text();
      return res.status(500).json({ error: "GitHub GET failed", detail });
    }

    // 2) preparar contenido
    const jsonText = JSON.stringify(products, null, 2);
    const contentB64 = Buffer.from(jsonText, "utf8").toString("base64");

    // 3) PUT (crear/actualizar)
    const putUrl = `https://api.github.com/repos/${owner}/${repo}/contents/${filePath}`;
    const putBody = {
      message: `Update products.json (${new Date().toISOString()})`,
      content: contentB64,
      branch
    };
    if (sha) putBody.sha = sha;

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
      return res.status(500).json({ error: "GitHub PUT failed", detail });
    }

    return res.status(200).json({ ok: true });
  } catch (err) {
    return res.status(500).json({ error: "Server error", detail: String(err) });
  }
};

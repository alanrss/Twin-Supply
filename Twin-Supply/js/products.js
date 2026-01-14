/* products.js
   Option B Sync (GitHub Pages friendly):
   - "Live" products come from /products.json (shared across all devices once you upload it to GitHub).
   - Admin edits are stored locally as a DRAFT (localStorage) until you export and upload the new products.json.
   - Store pages read DRAFT first (only on that device), otherwise they read the live JSON.
*/

(() => {
  "use strict";

  const PRODUCTS_JSON_URL = "products.json";         // committed file (shared)
  const PRODUCTS_CACHE_KEY = "productsCache";        // last fetched live cache (local)
  const PRODUCTS_DRAFT_KEY = "productsDraft";        // admin draft (local)
  const PRODUCTS_KEY = "products";                   // legacy key (kept for backward compatibility)

  // ---- fallback (only used if JSON can't be fetched and there's no cache/draft)
  const baseProducts = [
    {
      id: 1,
      name: "Essential Hoodie",
      price: 65,
      image: "assets/placeholder.jpg",
      gender: "Unisex",
      category: "Hoodies",
      department: "Clothing",
      stock: 20,
      description: "Premium cotton · Relaxed fit",
      featured: true,
      bestseller: true
    },
    {
      id: 2,
      name: "Street Tee",
      price: 28,
      image: "assets/placeholder.jpg",
      gender: "Unisex",
      category: "T-Shirts",
      department: "Clothing",
      stock: 50,
      description: "Minimal · Soft touch",
      featured: true,
      bestseller: false
    },
    {
      id: 3,
      name: "Retro Cap",
      price: 22,
      image: "assets/placeholder.jpg",
      gender: "Unisex",
      category: "Accessories",
      department: "Clothing",
      stock: 35,
      description: "Fine embroidery · Adjustable",
      featured: false,
      bestseller: false
    },
    {
      id: 4,
      name: "Sneakers Drop",
      price: 120,
      image: "assets/placeholder.jpg",
      gender: "Men",
      category: "Sneakers",
      department: "Clothing",
      stock: 8,
      description: "Limited edition · Low stock",
      featured: false,
      bestseller: true
    }
  ];

  // ---- helpers
  function safeJSONParse(str, fallback) {
    try { return JSON.parse(str); } catch { return fallback; }
  }

  function normalizeProduct(p) {
    const obj = { ...(p || {}) };

    obj.id = Number(obj.id || 0);
    obj.name = String(obj.name || "").trim();
    obj.price = Number(obj.price || 0);
    obj.image = String(obj.image || "assets/placeholder.jpg").trim();

    // Normalize gender
    const g = String(obj.gender || "Unisex").trim();
    obj.gender = g;

    obj.category = String(obj.category || "Other").trim();

    // Department (Perfumes / Clothing)
    const d = String(obj.department || "").trim();
    obj.department = d || inferDepartment(obj.category);

    obj.stock = Number(obj.stock ?? 0);
    obj.description = String(obj.description || "").trim();

    obj.featured = Boolean(obj.featured);
    obj.bestseller = Boolean(obj.bestseller);

    return obj;
  }

  function inferDepartment(category) {
    const c = String(category || "").toLowerCase();
    if (c.includes("perfume") || c.includes("fragrance") || c.includes("cologne")) return "Perfumes";
    return "Clothing";
  }

  function normalizeList(list) {
    const arr = Array.isArray(list) ? list : [];
    // remove invalid IDs
    const normalized = arr.map(normalizeProduct).filter(p => p.id > 0 && p.name);
    // ensure unique IDs
    const map = new Map();
    normalized.forEach(p => map.set(Number(p.id), p));
    return Array.from(map.values());
  }

  function setAllProducts(list) {
    window.allProducts = normalizeList(list);
    window.dispatchEvent(new CustomEvent("products:ready", { detail: { count: window.allProducts.length } }));
    return window.allProducts;
  }

  // ---- read sources (sync)
  function loadDraftSync() {
    const draft = safeJSONParse(localStorage.getItem(PRODUCTS_DRAFT_KEY), null);
    if (Array.isArray(draft) && draft.length) return normalizeList(draft);
    return null;
  }

  function loadLiveCacheSync() {
    // new cache key
    const cache = safeJSONParse(localStorage.getItem(PRODUCTS_CACHE_KEY), null);
    if (Array.isArray(cache) && cache.length) return normalizeList(cache);

    // legacy key (backward compatibility)
    const legacy = safeJSONParse(localStorage.getItem(PRODUCTS_KEY), null);
    if (Array.isArray(legacy) && legacy.length) return normalizeList(legacy);

    return null;
  }

  // ---- fetch live JSON (async)
  async function fetchLiveProducts() {
    // cache bust a little to reduce stale on mobile
    const url = PRODUCTS_JSON_URL + "?v=" + Date.now();

    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) throw new Error("Failed to fetch products.json");
    const json = await res.json();
    const normalized = normalizeList(json);

    // persist cache
    localStorage.setItem(PRODUCTS_CACHE_KEY, JSON.stringify(normalized));
    // keep legacy key updated too (some scripts may still rely on it)
    localStorage.setItem(PRODUCTS_KEY, JSON.stringify(normalized));

    return normalized;
  }

  // ---- Public API (used by admin + store)
  function getProductById(id) {
    const pid = Number(id);
    return (window.allProducts || []).find(p => Number(p.id) === pid);
  }

  function saveDraftProducts(products) {
    const normalized = normalizeList(products);
    localStorage.setItem(PRODUCTS_DRAFT_KEY, JSON.stringify(normalized));
    return setAllProducts(normalized);
  }

  function clearDraftProducts() {
    localStorage.removeItem(PRODUCTS_DRAFT_KEY);
  }

  function exportProductsJSON() {
    // Export DRAFT if exists, otherwise export current (live)
    const list = window.allProducts || [];
    return JSON.stringify(normalizeList(list), null, 2);
  }

  function importProductsJSON(jsonText) {
    const parsed = safeJSONParse(jsonText, null);
    if (!Array.isArray(parsed)) throw new Error("Invalid JSON: expected an array");
    return saveDraftProducts(parsed);
  }

  async function refreshFromLive() {
    // Don't override draft
    const draft = loadDraftSync();
    if (draft && draft.length) return setAllProducts(draft);

    const live = await fetchLiveProducts();
    setAllProducts(live);
    window.dispatchEvent(new CustomEvent("products:updated", { detail: { count: live.length } }));
    return live;
  }

  // ---- Initialize immediately (sync) then refresh (async)
  const draft = loadDraftSync();
  const cache = loadLiveCacheSync();
  setAllProducts(draft || cache || baseProducts);

  // A promise other scripts can wait on if needed
  window.productsReady = (async () => {
    try {
      await refreshFromLive();
    } catch {
      // keep whatever we already had (draft/cache/base)
    }
    return window.allProducts || [];
  })();

  // expose
  window.baseProducts = baseProducts;
  window.getProductById = getProductById;
  window.saveProducts = saveDraftProducts; // legacy alias (admin/store)

  // New sync/export helpers
  window.saveDraftProducts = saveDraftProducts;
  window.clearDraftProducts = clearDraftProducts;
  window.exportProductsJSON = exportProductsJSON;
  window.importProductsJSON = importProductsJSON;
  window.refreshProductsFromLive = refreshFromLive;

  // keys (useful for debugging)
  window.PRODUCTS_KEY = PRODUCTS_KEY;
  window.PRODUCTS_DRAFT_KEY = PRODUCTS_DRAFT_KEY;
  window.PRODUCTS_CACHE_KEY = PRODUCTS_CACHE_KEY;
})();

/* products.js
   - Fuente principal: data/products.json (GitHub)
   - Cache local: localStorage("products")
   - Expone: window.allProducts, window.saveProducts, window.getProductById
   - NUEVO: window.productsReady (Promise) + window.syncProductsFromRemote()
*/

const PRODUCTS_KEY = "products";

const baseProducts = [
  {
    id: 1,
    name: "Essential Hoodie",
    price: 65,
    image: "assets/placeholder.jpg",
    gender: "Unisex",
    category: "Hoodies",
    stock: 20,
    description: "Algodón premium · Fit relajado",
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
    stock: 35,
    description: "Bordado fino · Ajustable",
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
    stock: 8,
    description: "Edición limitada · Stock bajo",
    featured: false,
    bestseller: true
  }
];

function normalizeGender(g) {
  const v = String(g || "").trim().toLowerCase();
  if (["men","man","male","hombre","hombres","m","mens"].includes(v)) return "Men";
  if (["women","woman","female","mujer","mujeres","w","womens"].includes(v)) return "Women";
  if (["unisex","all","todos","todas"].includes(v)) return "Unisex";
  const raw = String(g || "Unisex").trim();
  if (!raw) return "Unisex";
  return raw.charAt(0).toUpperCase() + raw.slice(1);
}

function guessDepartment(p) {
  const dept = String(p.department || "").trim();
  if (dept) return dept;
  const cat = String(p.category || "").toLowerCase();
  const name = String(p.name || "").toLowerCase();
  const hay = (cat + " " + name);
  const perfumeHints = ["perfume","fragrance","cologne","parfum","eau de","attar","oud","spray"];
  const isPerfume = perfumeHints.some((h) => hay.includes(h));
  return isPerfume ? "Perfumes" : "Clothing";
}

function normalizeProduct(p) {
  return {
    id: Number(p.id),
    name: String(p.name || "").trim(),
    price: Number(p.price || 0),
    image: String(p.image || "assets/placeholder.jpg"),
    department: String(guessDepartment(p) || "Clothing"),
    gender: normalizeGender(p.gender || "Unisex"),
    category: String(p.category || "General"),
    stock: Number(p.stock ?? 0),
    description: String(p.description || ""),
    featured: Boolean(p.featured),
    bestseller: Boolean(p.bestseller)
  };
}

function loadLocalProducts() {
  const raw = localStorage.getItem(PRODUCTS_KEY);
  let list = [];
  if (raw) {
    try { list = JSON.parse(raw); } catch { list = []; }
  }
  if (!Array.isArray(list) || list.length === 0) list = baseProducts;
  const normalized = list.map(normalizeProduct);
  localStorage.setItem(PRODUCTS_KEY, JSON.stringify(normalized));
  return normalized;
}

function saveProducts(products) {
  const normalized = (products || []).map(normalizeProduct);
  localStorage.setItem(PRODUCTS_KEY, JSON.stringify(normalized));
  window.allProducts = normalized;
  return normalized;
}

function getProductById(id) {
  const pid = Number(id);
  return (window.allProducts || []).find(p => Number(p.id) === pid);
}

async function fetchRemoteProducts() {
  // resuelve bien rutas en GitHub Pages (shop.html/admin.html/etc)
  const url = new URL("data/products.json", window.location.href);
  url.searchParams.set("v", String(Date.now())); // cache-bust
  const res = await fetch(url.toString(), { cache: "no-store" });
  if (!res.ok) throw new Error("No pude cargar data/products.json");
  const data = await res.json();
  if (!Array.isArray(data)) throw new Error("data/products.json no es un array");
  return data;
}

function sameProducts(a, b) {
  try {
    return JSON.stringify(a) === JSON.stringify(b);
  } catch {
    return false;
  }
}

async function syncProductsFromRemote() {
  const remote = await fetchRemoteProducts();
  const normalizedRemote = remote.map(normalizeProduct);
  const local = loadLocalProducts(); // ya normaliza
  if (!sameProducts(local, normalizedRemote)) {
    saveProducts(normalizedRemote);
    window.dispatchEvent(new CustomEvent("products:updated", { detail: normalizedRemote }));
  }
  return window.allProducts;
}

// Exponer globals
window.baseProducts = baseProducts;
window.PRODUCTS_KEY = PRODUCTS_KEY;
window.saveProducts = saveProducts;
window.getProductById = getProductById;

// Inicial inmediato (para que no “truene” nada)
window.allProducts = loadLocalProducts();

// NUEVO: Promise para que shop/product/admin puedan esperar antes de renderizar
window.syncProductsFromRemote = syncProductsFromRemote;
window.productsReady = (async () => {
  try { await syncProductsFromRemote(); }
  catch (e) { console.warn("[products] Remote sync failed:", e); }
  return window.allProducts;
})();

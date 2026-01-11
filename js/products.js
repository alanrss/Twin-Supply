/* products.js
   - Fuente única de productos: localStorage("products") con fallback a baseProducts
   - Incluye nuevos campos: featured, bestseller
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
    gender: "Hombre",
    category: "Sneakers",
    stock: 8,
    description: "Edición limitada · Stock bajo",
    featured: false,
    bestseller: true
  }
];

function normalizeProduct(p) {
  return {
    id: Number(p.id),
    name: String(p.name || "").trim(),
    price: Number(p.price || 0),
    image: String(p.image || "assets/placeholder.jpg"),
    gender: String(p.gender || "Unisex"),
    category: String(p.category || "General"),
    stock: Number(p.stock ?? 0),
    description: String(p.description || ""),
    featured: Boolean(p.featured),
    bestseller: Boolean(p.bestseller)
  };
}

function loadProducts() {
  const raw = localStorage.getItem(PRODUCTS_KEY);
  let list = [];
  if (raw) {
    try {
      list = JSON.parse(raw);
    } catch {
      list = [];
    }
  }
  if (!Array.isArray(list) || list.length === 0) list = baseProducts;
  const normalized = list.map(normalizeProduct);
  // guarda normalizado para que admin/home/tienda usen lo mismo
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

window.baseProducts = baseProducts;
window.allProducts = loadProducts();
window.saveProducts = saveProducts;
window.getProductById = getProductById;
window.PRODUCTS_KEY = PRODUCTS_KEY;

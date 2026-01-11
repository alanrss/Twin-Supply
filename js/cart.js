/* cart.js
   - Carrito en localStorage("cart")
   - Contador global #cart-count
   - Stepper qty
   - Limpieza automática de ítems inexistentes
*/

const CART_KEY = "cart";

function getCart() {
  const raw = localStorage.getItem(CART_KEY);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveCart(cart) {
  localStorage.setItem(CART_KEY, JSON.stringify(cart));
  updateCartCount();
}

function cleanCart() {
  const products = window.allProducts || [];
  const validIds = new Set(products.map(p => Number(p.id)));
  const cart = getCart().filter(i => validIds.has(Number(i.id)));
  saveCart(cart);
  return cart;
}

function getCartCount() {
  return getCart().reduce((sum, item) => sum + Number(item.qty || 0), 0);
}

function updateCartCount() {
  const el = document.getElementById("cart-count");
  if (el) el.textContent = String(getCartCount());
}

function addToCart(productId, qty = 1) {
  const id = Number(productId);
  const product = window.getProductById ? window.getProductById(id) : null;
  if (!product) return;

  // stock check (no backend, pero mínimo)
  if (product.stock <= 0) return;

  let cart = getCart();
  const idx = cart.findIndex(i => Number(i.id) === id);
  const addQty = Math.max(1, Number(qty || 1));

  if (idx >= 0) {
    cart[idx].qty = Number(cart[idx].qty || 0) + addQty;
  } else {
    cart.push({ id, qty: addQty });
  }

  saveCart(cart);
}

function removeFromCart(productId) {
  const id = Number(productId);
  const cart = getCart().filter(i => Number(i.id) !== id);
  saveCart(cart);
}

function setCartQty(productId, qty) {
  const id = Number(productId);
  let cart = getCart();
  const idx = cart.findIndex(i => Number(i.id) === id);
  if (idx < 0) return;

  const newQty = Math.max(1, Number(qty || 1));
  cart[idx].qty = newQty;
  saveCart(cart);
}

function formatMoney(n) {
  const num = Number(n || 0);
  return `$${num.toFixed(2)}`;
}

function renderCart() {
  const listEl = document.getElementById("cart-items");
  const totalEl = document.getElementById("cart-total");
  if (!listEl || !totalEl) return;

  const cart = cleanCart();
  const products = window.allProducts || [];

  let total = 0;

  if (cart.length === 0) {
    listEl.innerHTML = `<div class="panel"><div class="panelInner">
      <div class="kicker">Carrito</div>
      <div class="h1" style="margin:10px 0 0">Tu carrito está vacío</div>
      <p class="sub">Agrega productos desde el shop.</p>
      <div style="margin-top:14px"><a class="btn btnPrimary" href="shop.html">Ir al shop</a></div>
    </div></div>`;
    totalEl.textContent = formatMoney(0);
    return;
  }

  listEl.innerHTML = "";
  cart.forEach(item => {
    const p = products.find(x => Number(x.id) === Number(item.id));
    if (!p) return;

    const line = Number(p.price) * Number(item.qty);
    total += line;

    const div = document.createElement("div");
    div.className = "cartItem";
    div.innerHTML = `
      <img src="${p.image}" alt="${p.name}">
      <div>
        <div style="font-weight:950">${p.name}</div>
        <div style="color:var(--muted);font-weight:800;font-size:13px;margin-top:4px">${p.gender} · ${p.category}</div>
        <div style="margin-top:8px;font-weight:950">${formatMoney(p.price)}</div>
      </div>
      <div class="cartRight">
        <div class="qty">
          <button class="qty-minus" aria-label="menos">-</button>
          <input class="qty-input" type="number" min="1" value="${Number(item.qty)}">
          <button class="qty-plus" aria-label="más">+</button>
        </div>
        <button class="btn btnDanger remove-btn" style="padding:10px 12px;border-radius:14px">Eliminar</button>
      </div>
    `;

    div.querySelector(".remove-btn").addEventListener("click", () => removeFromCart(p.id));

    const input = div.querySelector(".qty-input");
    div.querySelector(".qty-minus").addEventListener("click", () => {
      const v = Math.max(1, Number(input.value || 1) - 1);
      input.value = v;
      setCartQty(p.id, v);
      renderCart();
    });
    div.querySelector(".qty-plus").addEventListener("click", () => {
      const v = Math.max(1, Number(input.value || 1) + 1);
      input.value = v;
      setCartQty(p.id, v);
      renderCart();
    });
    input.addEventListener("change", () => {
      const v = Math.max(1, Number(input.value || 1));
      input.value = v;
      setCartQty(p.id, v);
      renderCart();
    });

    listEl.appendChild(div);
  });

  totalEl.textContent = formatMoney(total);
}

/* Export global */
window.getCart = getCart;
window.saveCart = saveCart;
window.addToCart = addToCart;
window.removeFromCart = removeFromCart;
window.setCartQty = setCartQty;
window.updateCartCount = updateCartCount;
window.renderCart = renderCart;

/* Init */
document.addEventListener("DOMContentLoaded", () => {
  updateCartCount();
});

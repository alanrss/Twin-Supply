/* cart.js
   - Cart en localStorage("cart")
   - Contador global #cart-count
   - Stepper qty
   - Limpieza automática de ítems inexistentes
   - ✅ Espera productsReady (products.json)
   - ✅ Respeta stock (cap qty)
   - ✅ Remove re-renderiza
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

function getCartCount() {
  return getCart().reduce((sum, item) => sum + Number(item.qty || 0), 0);
}

function updateCartCount() {
  const el = document.getElementById("cart-count");
  if (el) el.textContent = String(getCartCount());
}

function cleanCart() {
  const products = window.allProducts || [];
  if (!products.length) return getCart(); // por si algo raro pasa

  const validIds = new Set(products.map(p => Number(p.id)));
  const cart = getCart().filter(i => validIds.has(Number(i.id)));
  saveCart(cart);
  return cart;
}

function clampToStock(product, desiredQty) {
  const maxStock = Number(product?.stock ?? 0);
  let q = Math.max(1, Number(desiredQty || 1));
  if (maxStock > 0) q = Math.min(maxStock, q);
  return q;
}

function addToCart(productId, qty = 1) {
  const id = Number(productId);
  const product = window.getProductById ? window.getProductById(id) : null;
  if (!product) return;

  const maxStock = Number(product.stock ?? 0);
  if (maxStock <= 0) return;

  let cart = getCart();
  const idx = cart.findIndex(i => Number(i.id) === id);

  const addQty = Math.max(1, Number(qty || 1));
  const currentQty = idx >= 0 ? Number(cart[idx].qty || 0) : 0;

  // ✅ no exceder stock
  const newQty = Math.min(maxStock, currentQty + addQty);
  if (newQty === currentQty) return;

  if (idx >= 0) cart[idx].qty = newQty;
  else cart.push({ id, qty: newQty });

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

  const product = window.getProductById ? window.getProductById(id) : null;
  if (!product) {
    // si ya no existe, lo quitamos
    removeFromCart(id);
    return;
  }

  const maxStock = Number(product.stock ?? 0);
  if (maxStock <= 0) {
    removeFromCart(id);
    return;
  }

  const newQty = clampToStock(product, qty);
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
      <div class="kicker">Cart</div>
      <div class="h1" style="margin:10px 0 0">Your cart is empty</div>
      <p class="sub">Add products from the shop.</p>
      <div style="margin-top:14px"><a class="btn btnPrimary" href="shop.html">Go to Shop</a></div>
    </div></div>`;
    totalEl.textContent = formatMoney(0);
    return;
  }

  listEl.innerHTML = "";
  cart.forEach(item => {
    const p = products.find(x => Number(x.id) === Number(item.id));
    if (!p) return;

    const maxStock = Number(p.stock ?? 0);
    const safeQty = maxStock > 0 ? Math.min(maxStock, Number(item.qty || 1)) : 1;

    // si estaba guardado con qty mayor que stock, lo corregimos
    if (safeQty !== Number(item.qty || 1)) setCartQty(p.id, safeQty);

    const line = Number(p.price) * safeQty;
    total += line;

    const div = document.createElement("div");
    div.className = "cartItem";
    div.innerHTML = `
      <img src="${p.image}" alt="${p.name}">
      <div>
        <div style="font-weight:950">${p.name}</div>
        <div style="color:var(--muted);font-weight:800;font-size:13px;margin-top:4px">
          ${p.gender} · ${p.category}
        </div>
        <div style="margin-top:8px;font-weight:950">${formatMoney(p.price)}</div>
      </div>
      <div class="cartRight">
        <div class="qty">
          <button class="qty-minus" aria-label="menos">-</button>
          <input class="qty-input" type="number" min="1" ${maxStock > 0 ? `max="${maxStock}"` : ""} value="${safeQty}">
          <button class="qty-plus" aria-label="más">+</button>
        </div>
        <button class="btn btnDanger remove-btn" style="padding:10px 12px;border-radius:14px">Remove</button>
      </div>
    `;

    // ✅ Remove ahora sí actualiza UI + total
    div.querySelector(".remove-btn").addEventListener("click", () => {
      removeFromCart(p.id);
      renderCart();
    });

    const input = div.querySelector(".qty-input");
    const minusBtn = div.querySelector(".qty-minus");
    const plusBtn = div.querySelector(".qty-plus");

    function refreshDisableState() {
      const v = Number(input.value || 1);
      minusBtn.disabled = v <= 1;
      if (maxStock > 0) plusBtn.disabled = v >= maxStock;
      else plusBtn.disabled = false;
    }

    minusBtn.addEventListener("click", () => {
      const v = Math.max(1, Number(input.value || 1) - 1);
      input.value = v;
      setCartQty(p.id, v);
      renderCart();
    });

    plusBtn.addEventListener("click", () => {
      const v = Math.max(1, Number(input.value || 1) + 1);
      input.value = maxStock > 0 ? Math.min(maxStock, v) : v;
      setCartQty(p.id, input.value);
      renderCart();
    });

    input.addEventListener("change", () => {
      const v = maxStock > 0 ? Math.min(maxStock, Math.max(1, Number(input.value || 1))) : Math.max(1, Number(input.value || 1));
      input.value = v;
      setCartQty(p.id, v);
      renderCart();
    });

    refreshDisableState();
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
document.addEventListener("DOMContentLoaded", async () => {
  // ✅ importantísimo con products.json
  await (window.productsReady || Promise.resolve());
  cleanCart();
  updateCartCount();

  // si estás en cart.html, renderiza
  if (document.getElementById("cart-items")) renderCart();

  // si products.json se actualiza mientras estás en la página
  window.addEventListener("products:updated", () => {
    cleanCart();
    updateCartCount();
    if (document.getElementById("cart-items")) renderCart();
  });
});

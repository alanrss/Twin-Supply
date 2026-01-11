/* admin.js
   - Login simple
   - CRUD productos
   - NUEVO: Featured + Best Seller
   - resetProducts limpia carrito y regresa a baseProducts
*/

const ADMIN_PASSWORD = "1234"; // <-- cámbiala si quieres
const ADMIN_SESSION_KEY = "adminLogged";

function $(id){ return document.getElementById(id); }

function requireLogin() {
  const logged = localStorage.getItem(ADMIN_SESSION_KEY) === "true";
  const loginBox = $("login-box");
  const adminBox = $("admin-box");
  if (!loginBox || !adminBox) return;

  loginBox.style.display = logged ? "none" : "block";
  adminBox.style.display = logged ? "block" : "none";
}

function login() {
  const pass = $("admin-pass")?.value || "";
  if (pass === ADMIN_PASSWORD) {
    localStorage.setItem(ADMIN_SESSION_KEY, "true");
    requireLogin();
    renderList();
  } else {
    alert("Password incorrecta");
  }
}

function logout() {
  localStorage.removeItem(ADMIN_SESSION_KEY);
  requireLogin();
}

function nextId(products) {
  const max = (products || []).reduce((m,p) => Math.max(m, Number(p.id||0)), 0);
  return max + 1;
}

function readForm() {
  return {
    id: Number($("p-id")?.value || 0),
    name: ($("p-name")?.value || "").trim(),
    price: Number($("p-price")?.value || 0),
    image: ($("p-image")?.value || "").trim() || "assets/placeholder.jpg",
    gender: ($("p-gender")?.value || "Unisex"),
    category: ($("p-category")?.value || "General").trim(),
    stock: Number($("p-stock")?.value || 0),
    description: ($("p-desc")?.value || "").trim(),
    featured: Boolean($("p-featured")?.checked),
    bestseller: Boolean($("p-bestseller")?.checked)
  };
}

function fillForm(p) {
  $("p-id").value = p.id;
  $("p-name").value = p.name;
  $("p-price").value = p.price;
  $("p-image").value = p.image;
  $("p-gender").value = p.gender;
  $("p-category").value = p.category;
  $("p-stock").value = p.stock;
  $("p-desc").value = p.description || "";
  $("p-featured").checked = Boolean(p.featured);
  $("p-bestseller").checked = Boolean(p.bestseller);
}

function clearForm() {
  $("p-id").value = "";
  $("p-name").value = "";
  $("p-price").value = "";
  $("p-image").value = "";
  $("p-gender").value = "Unisex";
  $("p-category").value = "";
  $("p-stock").value = "0";
  $("p-desc").value = "";
  $("p-featured").checked = false;
  $("p-bestseller").checked = false;
}

function upsertProduct() {
  let products = window.allProducts || [];
  const data = readForm();

  if (!data.name || !data.category) {
    alert("Falta name o category");
    return;
  }

  if (data.id) {
    // update
    products = products.map(p => Number(p.id) === Number(data.id) ? data : p);
  } else {
    data.id = nextId(products);
    products = [data, ...products];
  }

  window.saveProducts(products);
  clearForm();
  renderList();
  alert("Guardado");
}

function deleteProduct(id) {
  let products = window.allProducts || [];
  products = products.filter(p => Number(p.id) !== Number(id));
  window.saveProducts(products);

  // limpia carrito de items borrados (cart.js ya limpia, pero lo hacemos ahora)
  const cart = (window.getCart ? window.getCart() : []).filter(i => Number(i.id) !== Number(id));
  localStorage.setItem("cart", JSON.stringify(cart));

  renderList();
}

function resetProducts() {
  // reset productos y limpia carrito
  localStorage.setItem(window.PRODUCTS_KEY, JSON.stringify(window.baseProducts || []));
  localStorage.setItem("cart", "[]");
  window.allProducts = (window.baseProducts || []).slice();
  renderList();
  alert("Productos reseteados y carrito limpiado");
}

function renderList() {
  const list = $("products-list");
  if (!list) return;

  const products = window.allProducts || [];
  list.innerHTML = products.map(p => `
    <div class="listItem">
      <img src="${p.image}" alt="${p.name}">
      <div>
        <div style="font-weight:950">${p.name}</div>
        <div style="color:var(--muted);font-weight:800;font-size:13px;margin-top:4px">${p.gender} · ${p.category} · Stock: ${p.stock}</div>
        <div style="margin-top:8px;display:flex;gap:8px;flex-wrap:wrap">
          ${p.featured ? `<span class="pillTag hot">✨ Featured</span>` : `<span class="pillTag">Featured</span>`}
          ${p.bestseller ? `<span class="pillTag hot">🔥 Best Seller</span>` : `<span class="pillTag">Best</span>`}
          <span class="pillTag">$${Number(p.price).toFixed(2)}</span>
        </div>
      </div>
      <div style="display:flex;gap:8px;flex-wrap:wrap;justify-content:end">
        <button class="btn" data-edit="${p.id}" style="padding:10px 12px;border-radius:14px">Editar</button>
        <button class="btn btnDanger" data-del="${p.id}" style="padding:10px 12px;border-radius:14px">Eliminar</button>
      </div>
    </div>
  `).join("");

  list.querySelectorAll("[data-edit]").forEach(btn => {
    btn.addEventListener("click", () => {
      const id = Number(btn.dataset.edit);
      const p = window.getProductById(id);
      if (p) fillForm(p);
      window.scrollTo({ top: 0, behavior: "smooth" });
    });
  });

  list.querySelectorAll("[data-del]").forEach(btn => {
    btn.addEventListener("click", () => {
      const id = Number(btn.dataset.del);
      if (confirm("¿Eliminar producto?")) deleteProduct(id);
    });
  });
}

document.addEventListener("DOMContentLoaded", () => {
  // login
  $("login-btn")?.addEventListener("click", login);
  $("logout-btn")?.addEventListener("click", logout);

  // actions
  $("save-btn")?.addEventListener("click", upsertProduct);
  $("clear-btn")?.addEventListener("click", clearForm);
  $("reset-btn")?.addEventListener("click", resetProducts);

  requireLogin();
  renderList();
});

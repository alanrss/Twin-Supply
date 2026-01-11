/* shop.js
   - Vista plantilla: secciones horizontales por categoría
   - Vista grid: category/gender/favorites
*/

function qs(name) {
  return new URLSearchParams(window.location.search).get(name);
}

function productCardHTML(p) {
  const liked = window.hasLiked ? window.hasLiked(p.id) : false;
  const likeCount = window.getLikeCount ? window.getLikeCount(p.id) : 0;
  const saved = window.isFav ? window.isFav(p.id) : false;

  return `
    <article class="card" data-id="${p.id}">
      <div class="thumb">
        <img src="${p.image}" alt="${p.name}">
      </div>
      <div class="cardBody">
        <div class="cardRow">
          <div class="name">${p.name}</div>
          <div class="price">$${Number(p.price).toFixed(2)}</div>
        </div>
        <div class="desc">${p.gender} · ${p.category}${p.bestseller ? " · 🔥 Best Seller" : ""}${p.featured ? " · ✨ Featured" : ""}</div>

        <div class="cardActions">
          <div class="qty" style="width:100%">
            <button class="qminus">-</button>
            <input class="qinput" type="number" min="1" value="1">
            <button class="qplus">+</button>
          </div>
        </div>

        <div class="cardActions">
          <button class="actionBtn add-btn">Add to Cart</button>
          <button class="iconBtn save-btn ${saved ? "active" : ""}" title="Guardar">🔖</button>
          <button class="iconBtn like-btn ${liked ? "active" : ""}" title="Like">♥</button>
        </div>

        <div class="desc" style="margin-top:8px">Likes: <b>${likeCount}</b></div>
      </div>
    </article>
  `;
}

function bindCard(card) {
  const id = Number(card.dataset.id);

  card.addEventListener("click", () => {
    window.location.href = `product.html?id=${id}`;
  });

  const qinput = card.querySelector(".qinput");
  card.querySelector(".qminus").addEventListener("click", (e) => {
    e.preventDefault(); e.stopPropagation();
    qinput.value = String(Math.max(1, Number(qinput.value || 1) - 1));
  });
  card.querySelector(".qplus").addEventListener("click", (e) => {
    e.preventDefault(); e.stopPropagation();
    qinput.value = String(Math.max(1, Number(qinput.value || 1) + 1));
  });
  qinput.addEventListener("click", (e) => { e.stopPropagation(); });

  card.querySelector(".add-btn").addEventListener("click", (e) => {
    e.preventDefault(); e.stopPropagation();
    window.addToCart(id, Number(qinput.value || 1));
  });

  card.querySelector(".save-btn").addEventListener("click", (e) => {
    e.preventDefault(); e.stopPropagation();
    const active = window.toggleFav(id);
    e.currentTarget.classList.toggle("active", active);
  });

  card.querySelector(".like-btn").addEventListener("click", (e) => {
    e.preventDefault(); e.stopPropagation();
    const res = window.toggleLike(id);
    e.currentTarget.classList.toggle("active", res.liked);
    const likesEl = card.querySelector(".desc b");
    if (likesEl) likesEl.textContent = String(res.count);
  });
}

function renderRowSections(products) {
  const holder = document.getElementById("shop-sections");
  const grid = document.getElementById("shop-grid");
  if (!holder || !grid) return;

  grid.style.display = "none";
  holder.style.display = "block";

  const categories = Array.from(new Set(products.map(p => p.category)));
  holder.innerHTML = categories.map(cat => {
    const items = products.filter(p => p.category === cat).slice(0, 12);
    if (items.length === 0) return "";
    return `
      <section class="section">
        <div class="sectionHead">
          <h2>${cat}</h2>
          <a class="chip active" href="shop.html?category=${encodeURIComponent(cat)}">Ver todo →</a>
        </div>
        <div class="hr"></div>
        <div class="rowScroll">
          ${items.map(productCardHTML).join("")}
        </div>
      </section>
    `;
  }).join("");

  holder.querySelectorAll(".card").forEach(bindCard);
}

function renderGridView(products, titleText) {
  const holder = document.getElementById("shop-sections");
  const grid = document.getElementById("shop-grid");
  const title = document.getElementById("shop-title");
  if (!holder || !grid) return;

  holder.style.display = "none";
  grid.style.display = "grid";
  if (title) title.textContent = titleText || "Todos los productos";

  grid.innerHTML = products.map(productCardHTML).join("");
  grid.querySelectorAll(".card").forEach(bindCard);
}

document.addEventListener("DOMContentLoaded", () => {
  if (window.updateCartCount) window.updateCartCount();

  const products = window.allProducts || [];

  const category = qs("category");
  const gender = qs("gender");
  const view = qs("view");

  // Favorites view
  if (view === "favorites") {
    const favs = window.getFavs ? window.getFavs() : [];
    const favProducts = products.filter(p => favs.includes(Number(p.id)));
    renderGridView(favProducts, "Tus Favoritos (Guardados)");
    return;
  }

  // Filter view
  if (category || gender) {
    let list = products.slice();
    if (category) list = list.filter(p => p.category === category);
    if (gender) list = list.filter(p => p.gender === gender);
    renderGridView(list, "Resultados");
    return;
  }

  // Default: template sections (horizontal)
  renderRowSections(products);
});

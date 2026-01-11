/* home.js
   - Mantiene hero (texto está en HTML)
   - Renderiza Best Sellers debajo del botón Shop Now
   - Renderiza secciones por categoría (sin fragrance/apparel fijo)
*/

function pickBestProducts(products, limit = 4) {
  const best = products.filter(p => p.bestseller || p.featured);
  if (best.length > 0) return best.slice(0, limit);
  return products.slice(0, limit);
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
        <div class="desc">${p.gender} · ${p.category}</div>

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

function bindCardEvents(container) {
  container.querySelectorAll(".card").forEach(card => {
    const id = Number(card.dataset.id);

    card.addEventListener("click", () => {
      window.location.href = `product.html?id=${id}`;
    });

    card.querySelector(".add-btn").addEventListener("click", (e) => {
      e.preventDefault(); e.stopPropagation();
      window.addToCart(id, 1);
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
  });
}

function renderBest() {
  const grid = document.getElementById("best-grid");
  if (!grid) return;

  const products = window.allProducts || [];
  const list = pickBestProducts(products, 4);

  grid.innerHTML = list.map(productCardHTML).join("");
  bindCardEvents(grid);
}

function renderCategoryRows() {
  const holder = document.getElementById("category-rows");
  if (!holder) return;

  const products = window.allProducts || [];
  const categories = Array.from(new Set(products.map(p => p.category))).slice(0, 6);

  holder.innerHTML = categories.map(cat => {
    const items = products.filter(p => p.category === cat).slice(0, 10);
    if (items.length === 0) return "";
    return `
      <section class="section">
        <div class="sectionHead">
          <h2>${cat}</h2>
          <a class="chip active" href="shop.html?category=${encodeURIComponent(cat)}">Ver todo →</a>
        </div>
        <div class="hr"></div>
        <div class="rowScroll" data-row="${cat}">
          ${items.map(productCardHTML).join("")}
        </div>
      </section>
    `;
  }).join("");

  holder.querySelectorAll(".rowScroll").forEach(row => bindCardEvents(row));
}

document.addEventListener("DOMContentLoaded", () => {
  // Asegura contador
  if (window.updateCartCount) window.updateCartCount();

  renderBest();
  renderCategoryRows();
});

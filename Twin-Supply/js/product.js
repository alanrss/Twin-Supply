/* product.js
   - Muestra producto
   - Add to cart + qty
   - Guardar (favoritos) + like
   - Sugerencias automáticas
   - Comentarios por producto (local)
*/

function qs(name) {
  return new URLSearchParams(window.location.search).get(name);
}
function money(n){ return `$${Number(n||0).toFixed(2)}`; }

function renderSuggestions(current) {
  const box = document.getElementById("suggestions");
  if (!box) return;

  const products = window.allProducts || [];
  let list = products
    .filter(p => p.id !== current.id)
    .filter(p => p.category === current.category || p.gender === current.gender);

  // fallback si no hay suficientes
  if (list.length < 4) {
    const extra = products.filter(p => p.id !== current.id);
    list = Array.from(new Set([...list, ...extra])).slice(0, 4);
  } else list = list.slice(0, 4);

  box.innerHTML = list.map(p => `
    <article class="card" data-id="${p.id}">
      <div class="thumb"><img src="${p.image}" alt="${p.name}"></div>
      <div class="cardBody">
        <div class="cardRow"><div class="name">${p.name}</div><div class="price">${money(p.price)}</div></div>
        <div class="desc">${p.gender} · ${p.category}</div>
        <div class="cardActions">
          <button class="actionBtn add-btn">Add to Cart</button>
          <button class="iconBtn go-btn" title="Ver">→</button>
        </div>
      </div>
    </article>
  `).join("");

  box.querySelectorAll(".card").forEach(card => {
    const id = Number(card.dataset.id);
    card.addEventListener("click", () => window.location.href = `product.html?id=${id}`);
    card.querySelector(".add-btn").addEventListener("click", (e) => {
      e.preventDefault(); e.stopPropagation();
      window.addToCart(id, 1);
    });
    card.querySelector(".go-btn").addEventListener("click", (e) => {
      e.preventDefault(); e.stopPropagation();
      window.location.href = `product.html?id=${id}`;
    });
  });
}

function renderComments(productId) {
  const listEl = document.getElementById("comments-list");
  if (!listEl) return;

  const list = window.getComments ? window.getComments(productId) : [];
  if (list.length === 0) {
    listEl.innerHTML = `<div class="commentItem"><b>Sin comentarios aún</b><span>Se el primero en dejar uno.</span></div>`;
    return;
  }

  listEl.innerHTML = list.map(c => {
    const d = new Date(Number(c.ts || Date.now()));
    return `
      <div class="commentItem">
        <b>${c.name} <span style="color:var(--muted);font-weight:800;font-size:12px">· ${d.toLocaleString()}</span></b>
        <span>${c.text}</span>
      </div>
    `;
  }).join("");
}

document.addEventListener("DOMContentLoaded", () => {
  if (window.updateCartCount) window.updateCartCount();

  const id = qs("id");
  const product = window.getProductById ? window.getProductById(id) : null;

  if (!product) {
    document.body.innerHTML = `<div class="wrap" style="padding-top:40px">
      <div class="panel"><div class="panelInner">
        <div class="kicker">Error</div>
        <div class="h1" style="margin:10px 0 0">Product not found</div>
        <p class="sub">Regresa al shop.</p>
        <div style="margin-top:14px"><a class="btn btnPrimary" href="shop.html">Ir al shop</a></div>
      </div></div>
    </div>`;
    return;
  }

  // Fill UI
  const img = document.getElementById("p-image");
  const title = document.getElementById("p-title");
  const meta = document.getElementById("p-meta");
  const price = document.getElementById("p-price");
  const desc = document.getElementById("p-desc");

  if (img) img.src = product.image;
  if (title) title.textContent = product.name;
  if (meta) meta.textContent = `${product.gender} · ${product.category} · Stock: ${product.stock}`;
  if (price) price.textContent = money(product.price);
  if (desc) desc.textContent = product.description || "";

  // Buttons
  const qtyInput = document.getElementById("p-qty");
  const minus = document.getElementById("p-minus");
  const plus = document.getElementById("p-plus");
  const addBtn = document.getElementById("p-add");
  const saveBtn = document.getElementById("p-save");
  const likeBtn = document.getElementById("p-like");
  const likeCount = document.getElementById("p-likecount");

  const setSavedState = () => {
    const saved = window.isFav ? window.isFav(product.id) : false;
    if (saveBtn) saveBtn.classList.toggle("active", saved);
  };
  const setLikeState = () => {
    const liked = window.hasLiked ? window.hasLiked(product.id) : false;
    const cnt = window.getLikeCount ? window.getLikeCount(product.id) : 0;
    if (likeBtn) likeBtn.classList.toggle("active", liked);
    if (likeCount) likeCount.textContent = String(cnt);
  };

  setSavedState();
  setLikeState();

  if (minus && qtyInput) minus.addEventListener("click", () => qtyInput.value = String(Math.max(1, Number(qtyInput.value||1)-1)));
  if (plus && qtyInput) plus.addEventListener("click", () => qtyInput.value = String(Math.max(1, Number(qtyInput.value||1)+1)));

  if (addBtn) addBtn.addEventListener("click", () => {
    const q = Math.max(1, Number(qtyInput?.value || 1));
    window.addToCart(product.id, q);
  });

  if (saveBtn) saveBtn.addEventListener("click", () => {
    window.toggleFav(product.id);
    setSavedState();
  });

  if (likeBtn) likeBtn.addEventListener("click", () => {
    window.toggleLike(product.id);
    setLikeState();
  });

  // Suggestions + comments
  renderSuggestions(product);

  renderComments(product.id);
  const cName = document.getElementById("c-name");
  const cText = document.getElementById("c-text");
  const cBtn = document.getElementById("c-add");

  if (cBtn) cBtn.addEventListener("click", () => {
    const name = (cName?.value || "").trim() || "Anon";
    const text = (cText?.value || "").trim();
    if (!text) return;
    window.addComment(product.id, name, text);
    if (cText) cText.value = "";
    renderComments(product.id);
  });
});

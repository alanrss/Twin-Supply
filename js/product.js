(() => {
  "use strict";

  function qs(name) {
    return new URLSearchParams(location.search).get(name);
  }

  function money(n) {
    const val = Number(n || 0);
    return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(val);
  }

  function goWithTransition(url) {
    document.body.classList.add("pageExit");
    setTimeout(() => (window.location.href = url), 170);
  }

  function renderSuggestions(current) {
    const box = document.getElementById("suggestions");
    if (!box) return;

    const products = window.allProducts || [];
    let list = products
      .filter((p) => p.id !== current.id)
      .filter((p) => p.department === current.department || p.category === current.category);

    if (list.length < 4) {
      const extra = products.filter((p) => p.id !== current.id);
      const seen = new Set();
      list = [...list, ...extra].filter((p) => (seen.has(p.id) ? false : (seen.add(p.id), true)));
    }
    list = list.slice(0, 4);

    box.innerHTML = list.map((p) => `
      <article class="card" data-id="${p.id}">
        <div class="thumb"><img src="${p.image}" alt="${p.name}"></div>
        <div class="cardBody">
          <div class="cardRow">
            <div class="name">${p.name}</div>
            <div class="price">${money(p.price)}</div>
          </div>
          <div class="desc">${[p.department, p.gender, p.category].filter(Boolean).join(" · ")}</div>
          <div style="margin-top:12px;display:flex;gap:10px">
            <button class="btn btnGhost go-btn" type="button" style="flex:1">View</button>
            <button class="btn btnPrimary add-btn" type="button" style="flex:1">Add</button>
          </div>
        </div>
      </article>
    `).join("");

    box.querySelectorAll(".card").forEach((card) => {
      const id = Number(card.dataset.id);

      card.addEventListener("click", () => goWithTransition(`product.html?id=${id}`));

      card.querySelector(".go-btn").addEventListener("click", (e) => {
        e.preventDefault(); e.stopPropagation();
        goWithTransition(`product.html?id=${id}`);
      });

      card.querySelector(".add-btn").addEventListener("click", (e) => {
        e.preventDefault(); e.stopPropagation();
        if (window.addToCart) window.addToCart(id, 1);
      });
    });
  }

  document.addEventListener("DOMContentLoaded", async () => {
    // ✅ Esperar sync products.json antes de buscar el producto por id
    await (window.productsReady || Promise.resolve());

    const id = Number(qs("id"));
    const p = window.getProductById ? window.getProductById(id) : null;

    if (!p) {
      const title = document.getElementById("p-title");
      if (title) title.textContent = "Product not found.";
      return;
    }

    const img = document.getElementById("p-image");
    const title = document.getElementById("p-title");
    const meta = document.getElementById("p-meta");
    const price = document.getElementById("p-price");
    const desc = document.getElementById("p-desc");
    const stockEl = document.getElementById("p-stock");

    if (img) img.src = p.image;
    if (title) title.textContent = p.name;
    if (meta) meta.textContent = [p.department, p.gender, p.category].filter(Boolean).join(" · ");
    if (price) price.textContent = money(p.price);
    if (desc) desc.textContent = p.description || "";

    const qtyMinus = document.getElementById("qty-minus");
    const qtyPlus = document.getElementById("qty-plus");
    const qtyInput = document.getElementById("qty-input");
    const addBtn = document.getElementById("add-btn");

    const maxStock = Number(p.stock ?? 0);

    function clampQty(v) {
      let x = Math.max(1, Number(v || 1));
      if (maxStock > 0) x = Math.min(maxStock, x);
      return x;
    }

    if (qtyInput) qtyInput.value = String(clampQty(1));

    qtyMinus?.addEventListener("click", () => {
      if (!qtyInput) return;
      qtyInput.value = String(clampQty(Number(qtyInput.value || 1) - 1));
    });

    qtyPlus?.addEventListener("click", () => {
      if (!qtyInput) return;
      qtyInput.value = String(clampQty(Number(qtyInput.value || 1) + 1));
    });

    addBtn?.addEventListener("click", () => {
      if (!window.addToCart) return;
      const qty = clampQty(qtyInput?.value || 1);
      if (maxStock <= 0) return;
      window.addToCart(p.id, qty);
    });

    if (stockEl) {
      if (maxStock <= 0) {
        stockEl.textContent = "Out of stock";
        if (addBtn) addBtn.disabled = true;
      } else {
        stockEl.textContent = `${maxStock} in stock`;
      }
    }

    renderSuggestions(p);
  });
})();

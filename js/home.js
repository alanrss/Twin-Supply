(() => {
  "use strict";

  const $ = (sel) => document.querySelector(sel);

  function money(n) {
    const val = Number(n || 0);
    return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(val);
  }

  function goWithTransition(url) {
    document.body.classList.add("pageExit");
    setTimeout(() => (window.location.href = url), 170);
  }

  function cardHTML(p) {
    const dept = p.department || "Clothing";
    const meta = [dept, p.gender, p.category].filter(Boolean).join(" · ");
    return `
      <article class="card" data-id="${p.id}">
        <div class="thumb"><img src="${p.image}" alt="${p.name}"></div>
        <div class="cardBody">
          <div class="cardRow">
            <div class="name">${p.name}</div>
            <div class="price">${money(p.price)}</div>
          </div>
          <div class="desc">${meta}</div>
          <div class="cardRow" style="margin-top:12px;gap:10px">
            <div class="qty">
              <button class="qminus" type="button" aria-label="Decrease">−</button>
              <input class="qinput" type="number" min="1" value="1" aria-label="Quantity"/>
              <button class="qplus" type="button" aria-label="Increase">+</button>
            </div>
            <button class="btn btnPrimary add-btn" type="button" style="flex:1">Add to Cart</button>
          </div>
        </div>
      </article>
    `;
  }

  function attachCard(card) {
    const id = Number(card.dataset.id);
    const q = card.querySelector(".qinput");

    card.addEventListener("click", () => {
      goWithTransition(`product.html?id=${id}`);
    });

    card.querySelector(".qminus").addEventListener("click", (e) => {
      e.preventDefault(); e.stopPropagation();
      q.value = String(Math.max(1, Number(q.value || 1) - 1));
    });
    card.querySelector(".qplus").addEventListener("click", (e) => {
      e.preventDefault(); e.stopPropagation();
      q.value = String(Math.max(1, Number(q.value || 1) + 1));
    });
    q.addEventListener("click", (e) => e.stopPropagation());

    card.querySelector(".add-btn").addEventListener("click", (e) => {
      e.preventDefault(); e.stopPropagation();
      if (window.addToCart) window.addToCart(id, Number(q.value || 1));
    });
  }

  function renderHomeGrid() {
    const grid = document.getElementById("home-grid");
    if (!grid) return;

    const products = window.allProducts || [];
    grid.innerHTML = products.map(cardHTML).join("");

    grid.querySelectorAll(".card").forEach((c) => attachCard(c));
  }

  function setupCategoryCards() {
    document.querySelectorAll(".catCard").forEach((card) => {
      const dept = card.getAttribute("data-dept") || "Clothing";

      const buttons = card.querySelectorAll(".seg button");
      function setActive(btn) {
        buttons.forEach((b) => b.classList.toggle("active", b === btn));
      }
      function currentGender() {
        const active = card.querySelector(".seg button.active");
        return (active?.getAttribute("data-gender") || "All");
      }

      buttons.forEach((btn) => {
        btn.addEventListener("click", (e) => {
          e.preventDefault(); e.stopPropagation();
          setActive(btn);
          const gender = currentGender();
          goWithTransition(`shop.html?dept=${encodeURIComponent(dept)}&gender=${encodeURIComponent(gender)}`);
        });
      });

      card.addEventListener("click", () => {
        const gender = currentGender();
        goWithTransition(`shop.html?dept=${encodeURIComponent(dept)}&gender=${encodeURIComponent(gender)}`);
      });
    });
  }

  document.addEventListener("DOMContentLoaded", () => {
    renderHomeGrid();
    setupCategoryCards();
  });
})();

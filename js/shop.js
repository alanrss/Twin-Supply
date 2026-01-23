(() => {
  "use strict";

  function param(name) {
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

  function normalizeDept(v) {
    const x = String(v || "All").trim().toLowerCase();
    if (x === "perfumes" || x === "perfume") return "Perfumes";
    if (x === "clothing" || x === "apparel" || x === "ropa") return "Clothing";
    return "All";
  }

  function normalizeGender(v) {
    const x = String(v || "All").trim().toLowerCase();
    if (["men","man","male","hombre"].includes(x)) return "Men";
    if (["women","woman","female","mujer"].includes(x)) return "Women";
    return "All";
  }

  function setActive(groupEl, attr, value) {
    groupEl?.querySelectorAll("button").forEach((b) => {
      b.classList.toggle("active", String(b.getAttribute(attr)) === String(value));
    });
  }

  function cardHTML(p) {
    const meta = [p.department, p.gender, p.category].filter(Boolean).join(" · ");
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
document.addEventListener("DOMContentLoaded", async () => {
  await (window.productsReady || Promise.resolve());
  // ... tu código normal de render
});

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

  function render(dept, gender) {
    const grid = document.getElementById("shop-grid");
    const notice = document.getElementById("shop-notice");
    const subtitle = document.getElementById("shop-subtitle");
    const products = window.allProducts || [];

    let list = products.slice();

    if (dept !== "All") list = list.filter((p) => String(p.department) === dept);
    if (gender !== "All") list = list.filter((p) => String(p.gender) === gender);

    if (subtitle) {
      const parts = [];
      if (dept !== "All") parts.push(dept);
      if (gender !== "All") parts.push(gender);
      subtitle.textContent = parts.length ? parts.join(" · ") : "All products";
    }

    if (!list.length) {
      if (notice) {
        notice.style.display = "block";
        notice.textContent = "No products found for this filter. Try switching to All.";
      }
      if (grid) grid.innerHTML = "";
      return;
    } else if (notice) {
      notice.style.display = "none";
      notice.textContent = "";
    }

    if (grid) {
      grid.innerHTML = list.map(cardHTML).join("");
      grid.querySelectorAll(".card").forEach(attachCard);
    }
  }

  function updateURL(dept, gender) {
    const url = new URL(location.href);
    if (dept && dept !== "All") url.searchParams.set("dept", dept); else url.searchParams.delete("dept");
    if (gender && gender !== "All") url.searchParams.set("gender", gender); else url.searchParams.delete("gender");
    history.replaceState({}, "", url.toString());
  }

  document.addEventListener("DOMContentLoaded", () => {
    const deptSeg = document.getElementById("dept-seg");
    const genderSeg = document.getElementById("gender-seg");

    let dept = normalizeDept(param("dept"));
    let gender = normalizeGender(param("gender"));

    setActive(deptSeg, "data-dept", dept);
    setActive(genderSeg, "data-gender", gender);
    render(dept, gender);

    deptSeg?.querySelectorAll("button").forEach((btn) => {
      btn.addEventListener("click", () => {
        dept = normalizeDept(btn.getAttribute("data-dept"));
        setActive(deptSeg, "data-dept", dept);
        updateURL(dept, gender);
        render(dept, gender);
      });
    });

    genderSeg?.querySelectorAll("button").forEach((btn) => {
      btn.addEventListener("click", () => {
        gender = normalizeGender(btn.getAttribute("data-gender"));
        setActive(genderSeg, "data-gender", gender);
        updateURL(dept, gender);
        render(dept, gender);
      });
    });
  });
})();

/* admin.js
   - Simple local login
   - Product CRUD (saved to localStorage)
   - Department + Gender helpers
*/

(() => {
  "use strict";

  const ADMIN_PASSWORD = "1234"; // Change this if you want
  const ADMIN_SESSION_KEY = "adminLogged";

  const $ = (id) => document.getElementById(id);

  const CATEGORY_SUGGESTIONS = {
    Clothing: ["Hoodies", "T-Shirts", "Sneakers", "Accessories", "Jackets", "Pants", "Shorts", "Hats", "Bags"],
    Perfumes: ["Perfume", "Cologne", "Fragrance", "Oud", "Attar", "Body Spray", "Oil", "Gift Set"]
  };

  function requireLogin() {
    const logged = localStorage.getItem(ADMIN_SESSION_KEY) === "true";
    const loginBox = $("login-box");
    const adminBox = $("admin-box");

    if (loginBox) loginBox.style.display = logged ? "none" : "block";
    if (adminBox) adminBox.style.display = logged ? "block" : "none";

    if (logged) {
      renderCategoryDatalist($("p-dept")?.value || "Clothing");
      renderList();
    }
  }

  function renderCategoryDatalist(dept) {
    const list = document.getElementById("category-list");
    if (!list) return;
    const d = (dept === "Perfumes") ? "Perfumes" : "Clothing";
    const items = CATEGORY_SUGGESTIONS[d] || [];
    list.innerHTML = items.map((c) => `<option value="${c}"></option>`).join("");
  }

  function readForm() {
    return {
      id: $("p-id").value ? Number($("p-id").value) : null,
      name: String($("p-name").value || "").trim(),
      price: Number($("p-price").value || 0),
      image: String($("p-image").value || "").trim() || "assets/placeholder.jpg",
      department: String($("p-dept")?.value || "Clothing").trim(),
      gender: String($("p-gender").value || "Unisex").trim(),
      category: String($("p-category").value || "").trim(),
      stock: Number($("p-stock").value || 0),
      description: String($("p-desc").value || "").trim(),
      featured: Boolean($("p-featured").checked),
      bestseller: Boolean($("p-bestseller").checked)
    };
  }

  function fillForm(p) {
    $("p-id").value = String(p.id);
    $("p-name").value = p.name || "";
    $("p-price").value = String(Number(p.price || 0));
    $("p-image").value = p.image || "";
    $("p-dept").value = p.department || "Clothing";
    $("p-gender").value = p.gender || "Unisex";
    $("p-category").value = p.category || "";
    $("p-stock").value = String(Number(p.stock ?? 0));
    $("p-desc").value = p.description || "";
    $("p-featured").checked = Boolean(p.featured);
    $("p-bestseller").checked = Boolean(p.bestseller);

    renderCategoryDatalist($("p-dept")?.value || "Clothing");
  }

  function clearForm() {
    $("p-id").value = "";
    $("p-name").value = "";
    $("p-price").value = "";
    $("p-image").value = "";
    $("p-dept").value = "Clothing";
    $("p-gender").value = "Unisex";
    $("p-category").value = "";
    $("p-stock").value = "0";
    $("p-desc").value = "";
    $("p-featured").checked = false;
    $("p-bestseller").checked = false;

    renderCategoryDatalist("Clothing");
  }

  function upsertProduct() {
    const data = readForm();

    if (!data.name || !data.category) {
      alert("Please fill in Name and Category.");
      return;
    }

    let products = (window.allProducts || []).slice();

    if (!data.id) {
      const maxId = products.reduce((m, p) => Math.max(m, Number(p.id) || 0), 0);
      data.id = maxId + 1;
      products.unshift(data);
    } else {
      const idx = products.findIndex((p) => Number(p.id) === Number(data.id));
      if (idx >= 0) products[idx] = data;
      else products.unshift(data);
    }

    // saveProducts normalizes fields (gender mapping, etc.)
    window.saveProducts(products);
    renderList(data.id);
    clearForm();
  }

  function deleteProduct(id) {
    const pid = Number(id);
    if (!confirm("Delete this product?")) return;

    const products = (window.allProducts || []).filter((p) => Number(p.id) !== pid);
    window.saveProducts(products);
    renderList();
  }

  function resetProducts() {
    if (!confirm("Reset products to default and clear the cart?")) return;

    localStorage.setItem(window.PRODUCTS_KEY, JSON.stringify(window.baseProducts || []));
    localStorage.setItem("cart", "[]");
    window.allProducts = (window.baseProducts || []).slice();
    renderList();
    alert("Products reset. Cart cleared.");
  }

  function money(n) {
    const val = Number(n || 0);
    return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(val);
  }

  function renderList(focusId) {
    const list = $("products-list");
    if (!list) return;

    const products = window.allProducts || [];

    const groups = { Perfumes: [], Clothing: [] };
    products.forEach((p) => {
      const d = (p.department === "Perfumes") ? "Perfumes" : "Clothing";
      groups[d].push(p);
    });

    function groupHTML(title, items) {
      return `
        <div style="margin-bottom:14px">
          <div class="kicker" style="margin-bottom:8px">${title}</div>
          ${items.length ? items.map((p) => `
            <div class="listItem" data-id="${p.id}">
              <img src="${p.image}" alt="${p.name}">
              <div style="flex:1;min-width:0">
                <div style="font-weight:950;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${p.name}</div>
                <div style="color:var(--muted);font-weight:850;font-size:13px;margin-top:4px">
                  ${p.gender} · ${p.category} · Stock: ${Number(p.stock ?? 0)}
                </div>
                <div style="margin-top:8px;display:flex;gap:8px;flex-wrap:wrap">
                  ${p.featured ? `<span class="pillTag hot">Featured</span>` : `<span class="pillTag">Featured</span>`}
                  ${p.bestseller ? `<span class="pillTag hot">Best Seller</span>` : `<span class="pillTag">Best Seller</span>`}
                  <span class="pillTag">${money(p.price)}</span>
                </div>
              </div>
              <div style="display:flex;gap:8px;flex-wrap:wrap;justify-content:flex-end">
                <button class="btn edit-btn" type="button">Edit</button>
                <button class="btn btnDanger del-btn" type="button">Delete</button>
              </div>
            </div>
          `).join("") : `<div class="notice">No products in this department yet.</div>`}
        </div>
      `;
    }

    list.innerHTML = groupHTML("Perfumes", groups.Perfumes) + groupHTML("Clothing", groups.Clothing);

    list.querySelectorAll(".listItem").forEach((row) => {
      const id = Number(row.getAttribute("data-id"));
      const product = products.find((p) => Number(p.id) === id);

      row.querySelector(".edit-btn")?.addEventListener("click", () => fillForm(product));
      row.querySelector(".del-btn")?.addEventListener("click", () => deleteProduct(id));
    });

    if (focusId) {
      const el = list.querySelector(`.listItem[data-id="${focusId}"]`);
      if (el) {
        el.classList.add("flash");
        el.scrollIntoView({ behavior: "smooth", block: "center" });
        setTimeout(() => el.classList.remove("flash"), 900);
      }
    }
  }

  // ===== Events =====
  document.addEventListener("DOMContentLoaded", () => {
    requireLogin();

    $("login-btn")?.addEventListener("click", () => {
      const pass = String($("admin-pass")?.value || "");
      if (pass === ADMIN_PASSWORD) {
        localStorage.setItem(ADMIN_SESSION_KEY, "true");
        requireLogin();
      } else {
        alert("Wrong password.");
      }
    });

    $("logout-btn")?.addEventListener("click", () => {
      localStorage.removeItem(ADMIN_SESSION_KEY);
      requireLogin();
    });

    $("p-dept")?.addEventListener("change", (e) => {
      renderCategoryDatalist(e.target.value);
    });

    $("save-btn")?.addEventListener("click", upsertProduct);
    $("clear-btn")?.addEventListener("click", clearForm);
    $("reset-btn")?.addEventListener("click", resetProducts);
  });
})();

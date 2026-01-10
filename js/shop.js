const container = document.getElementById("products-container");

if (!container) {
  console.error("No se encontró #products-container");
}

products.forEach(product => {
  const card = document.createElement("div");
  card.className = "product-card";

  card.innerHTML = `
    <img src="${product.image}" alt="${product.name}">
    <h3>${product.name}</h3>
    <p>$${product.price}</p>
    <button onclick="addToCart(${product.id})">
      Add to Cart
    </button>
  `;

  container.appendChild(card);
});

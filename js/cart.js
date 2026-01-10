// Obtener carrito o crear uno nuevo
function getCart() {
  return JSON.parse(localStorage.getItem('cart')) || [];
}

// Guardar carrito
function saveCart(cart) {
  localStorage.setItem('cart', JSON.stringify(cart));
}

// Agregar producto
function addToCart(product) {
  const cart = getCart();

  const existing = cart.find(item => item.id === product.id);

  if (existing) {
    existing.qty += 1;
  } else {
    cart.push({ ...product, qty: 1 });
  }

  saveCart(cart);
  alert('Product added to cart');
}

// Eliminar producto
function removeFromCart(id) {
  let cart = getCart();
  cart = cart.filter(item => item.id !== id);
  saveCart(cart);
  renderCart();
}

// Renderizar carrito
function renderCart() {
  const cartItems = document.getElementById('cart-items');
  const cartTotal = document.getElementById('cart-total');

  if (!cartItems) return;

  const cart = getCart();
  cartItems.innerHTML = '';

  let total = 0;

  cart.forEach(item => {
    total += item.price * item.qty;

    cartItems.innerHTML += `
      <div class="cart-item">
        <img src="${item.image}" alt="${item.name}">
        <div>
          <h4>${item.name}</h4>
          <p>$${item.price} x ${item.qty}</p>
          <button onclick="removeFromCart('${item.id}')">Remove</button>
        </div>
      </div>
    `;
  });

  cartTotal.innerText = `$${total.toFixed(2)}`;
}

// Cargar carrito al abrir cart.html
document.addEventListener('DOMContentLoaded', renderCart);
async function checkout() {
  const cart = getCart();

  const response = await fetch('http://localhost:4242/create-checkout-session', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ items: cart })
  });

  const data = await response.json();
  window.location.href = data.url;
}
let cart = JSON.parse(localStorage.getItem("cart")) || [];

function addToCart(id) {
  const product = products.find(p => p.id === id);
  if (!product) return;

  cart.push(product);
  localStorage.setItem("cart", JSON.stringify(cart));
  alert("Product added to cart");
}

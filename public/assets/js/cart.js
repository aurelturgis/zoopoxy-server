/* =========================================================
   CART.JS — SEAGULLAIRWAYS / ÉPOXY — PIÈCES UNIQUES
   ========================================================= */

// ------------------------------
// CONFIG
// ------------------------------
const STOCK_URL = "assets/data/stock.json";

// ------------------------------
// ÉTAT
// ------------------------------
let stockCache = null;
let cart = JSON.parse(localStorage.getItem("cart")) || [];

// ------------------------------
// UTILITAIRES
// ------------------------------
function saveCart() {
  localStorage.setItem("cart", JSON.stringify(cart));
}

function formatPriceCents(cents) {
  const euros = cents / 100;
  return euros.toFixed(2).replace(".", ",") + " €";
}

function showToastUnique() {
  const toast = document.getElementById("toast-unique");
  if (!toast) return;
  toast.classList.add("visible");
  setTimeout(() => toast.classList.remove("visible"), 2500);
}

// ------------------------------
// STOCK
// ------------------------------
async function loadStock() {
  if (stockCache) return stockCache;
  try {
    const res = await fetch(STOCK_URL, { cache: "no-cache" });
    stockCache = await res.json();
    return stockCache;
  } catch (e) {
    console.error("Erreur chargement stock.json", e);
    return [];
  }
}

async function getStockItem(id) {
  const stock = await loadStock();
  return stock.find(p => p.id === id) || null;
}

async function isProductAvailable(id) {
  const item = await getStockItem(id);
  if (!item) return false;
  return item.stock > 0 && !item.sold;
}

// ------------------------------
// MISE À JOUR DES BOUTONS PRODUITS (VENDU)
// ------------------------------
async function refreshProductButtons() {
  const stock = await loadStock();
  document.querySelectorAll(".btn-add-cart").forEach(btn => {
    const id = btn.getAttribute("data-id");
    if (!id) return;
    const item = stock.find(p => p.id === id);
    if (!item) return;

    if (item.stock <= 0 || item.sold) {
      btn.disabled = true;
      btn.classList.add("sold-out");
      btn.textContent = "VENDU";
    }
  });
}

// ------------------------------
// PANIER
// ------------------------------
function getCartCount() {
  return cart.length; // pièces uniques : 1 entrée = 1 pièce
}

function updateCartCountUI() {
  const countEl = document.querySelector(".cart-count");
  if (countEl) countEl.textContent = getCartCount();
}

async function updateCartUI() {
  const container = document.getElementById("cartItems");
  const totalEl = document.getElementById("cartTotal");
  if (!container) return;

  container.innerHTML = "";
  let total = 0;

  for (const item of cart) {
    const stockItem = await getStockItem(item.id);
    const image = stockItem ? stockItem.image : item.image;
    const name = stockItem ? stockItem.name : item.name;
    const price = stockItem ? stockItem.price : item.price;

    total += price;

    const div = document.createElement("div");
    div.classList.add("cart-item");
    div.innerHTML = `
      <img src="${image}" class="cart-thumb" alt="${name}">
      <div class="cart-info">
        <h4>${name}</h4>
        <p>${formatPriceCents(price)}</p>
        <p class="cart-qty">Pièce unique</p>
      </div>
      <button class="cart-remove" data-remove-id="${item.id}">×</button>
    `;
    container.appendChild(div);
  }

  if (totalEl) totalEl.textContent = formatPriceCents(total);
  updateCartCountUI();

  // Bind remove buttons
  container.querySelectorAll("[data-remove-id]").forEach(btn => {
    btn.addEventListener("click", () => {
      const id = btn.getAttribute("data-remove-id");
      removeFromCart(id);
    });
  });
}

function removeFromCart(id) {
  cart = cart.filter(item => item.id !== id);
  saveCart();
  updateCartUI();
}

// ------------------------------
// AJOUT AU PANIER
// ------------------------------
async function handleAddToCartClick(btn) {
  const id = btn.getAttribute("data-id");
  if (!id) return;

  // déjà dans le panier ?
  const existing = cart.find(i => i.id === id);
  if (existing) {
    showToastUnique();
    return;
  }

  const available = await isProductAvailable(id);
  if (!available) {
    alert("Cette création est déjà vendue ou en cours d'achat.");
    return;
  }

  // récupérer infos depuis le HTML
  const article = btn.closest(".product-single, .product-single2");
  if (!article) return;

  const name = article.getAttribute("data-name") || id;
  const priceAttr = article.getAttribute("data-price");
  const imgAttr = article.getAttribute("data-img");

  const price = priceAttr ? parseInt(priceAttr, 10) : 0;
  const image = imgAttr || "";

  cart.push({ id, name, price, image });
  saveCart();
  updateCartUI();
  openCartDrawer();
}

// ------------------------------
// DRAWER PANIER
// ------------------------------
function openCartDrawer() {
  const drawer = document.getElementById("cartDrawer");
  if (!drawer) return;
  drawer.classList.add("open");
}

function closeCartDrawer() {
  const drawer = document.getElementById("cartDrawer");
  if (!drawer) return;
  drawer.classList.remove("open");
}

// ------------------------------
// CHECKOUT (Stripe côté backend)
// ------------------------------
async function handleCheckout() {
  if (cart.length === 0) {
    alert("Votre panier est vide.");
    return;
  }

  try {
    const res = await fetch("/create-checkout-session", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ items: cart })
    });

    if (!res.ok) {
      console.error("Erreur création session Stripe", await res.text());
      alert("Une erreur est survenue lors de la création du paiement.");
      return;
    }

    const data = await res.json();
    if (data.url) {
      window.location.href = data.url;
    } else {
      alert("Réponse inattendue du serveur de paiement.");
    }
  } catch (e) {
    console.error("Erreur checkout", e);
    alert("Impossible de lancer le paiement pour le moment.");
  }
}

// ------------------------------
// INIT
// ------------------------------
document.addEventListener("DOMContentLoaded", () => {
  // Boutons "Ajouter au panier"
  document.querySelectorAll(".btn-add-cart").forEach(btn => {
    btn.addEventListener("click", () => handleAddToCartClick(btn));
  });

  // Icône panier dans le header
  const cartIcon = document.querySelector(".cart-container");
  if (cartIcon) {
    cartIcon.addEventListener("click", openCartDrawer);
  }

  // Bouton fermer panier
  const cartClose = document.getElementById("cartClose");
  if (cartClose) {
    cartClose.addEventListener("click", closeCartDrawer);
  }

  // Bouton "Continuer mes achats"
  const continueBtn = document.getElementById("continueBtn");
  if (continueBtn) {
    continueBtn.addEventListener("click", closeCartDrawer);
  }

  // Bouton "Commander"
  const checkoutBtn = document.getElementById("checkoutBtn");
  if (checkoutBtn) {
    checkoutBtn.addEventListener("click", handleCheckout);
  }

  // Init UI
  updateCartUI();
  refreshProductButtons();
});

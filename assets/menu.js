// === IMPORTACIONES PRINCIPALES ===
import { fetchAll } from './supabaseClient.js';
import { mountChrome, initFloatingCart, formatMoney } from './ui.js';
import { cart, cartTotal } from './cart.js';

// === HORARIO DE ATENCIÓN ===
const HORARIO = { apertura: 9, cierre: 18 }; // 9:00 a 18:00 (6 pm)

function estaDentroDelHorario() {
  const ahora = new Date();
  const hora = ahora.getHours() + ahora.getMinutes() / 60;
  return hora >= HORARIO.apertura && hora < HORARIO.cierre;
}

function mostrarAvisoFueraHorario() {
  const container = document.createElement("div");
  container.className = "toast central-warning";
  container.innerHTML = `
    <div class="toast-content">
      <strong>⚠️ Fuera de horario</strong>
      <p>El restaurante atiende desde las 10:00 a.m. hasta las 6:00 p.m.</p>
      <button id="avisoAceptarBtn" class="btn primary" style="margin-top:10px">Aceptar</button>
    </div>
  `;
  Object.assign(container.style, {
    position: "fixed",
    top: "50%",
    left: "50%",
    transform: "translate(-50%, -50%)",
    zIndex: "5000",
    background: "white",
    color: "#222",
    padding: "20px",
    borderRadius: "12px",
    boxShadow: "0 4px 16px rgba(0,0,0,0.25)",
    textAlign: "center",
    maxWidth: "300px",
  });
  document.body.appendChild(container);
  document.getElementById("avisoAceptarBtn").addEventListener("click", () => container.remove());
}

function deshabilitarFueraHorario() {
  document.querySelectorAll('[data-add]').forEach(btn => {
    btn.disabled = true;
    btn.classList.add('disabled');
  });

  const botones = [
    document.getElementById('checkoutBtn'),
    document.getElementById('clearCart'),
    document.getElementById('floatingCart')
  ];

  botones.forEach(btn => {
    if (btn) {
      btn.disabled = true;
      btn.classList.add('disabled');
    }
  });
}

function habilitarSiAbierto() {
  document.querySelectorAll('[data-add]').forEach(btn => {
    btn.disabled = false;
    btn.classList.remove('disabled');
  });

  const botones = [
    document.getElementById('checkoutBtn'),
    document.getElementById('clearCart'),
    document.getElementById('floatingCart')
  ];

  botones.forEach(btn => {
    if (btn) {
      btn.disabled = false;
      btn.classList.remove('disabled');
    }
  });
}

// === VARIABLES GLOBALES ===
let PRODUCTS = [];

const grid = document.getElementById('menuGrid');
const search = document.getElementById('search');
const categoria = document.getElementById('categoria');
const cartList = document.getElementById('cartList');
const cartTotalEl = document.getElementById('cartTotal');
const clearBtn = document.getElementById('clearCart');
const checkoutBtn = document.getElementById('checkoutBtn');

const WHATSAPP_NUMBER = "51986556773";

// === CARRUSEL ===
function ensureInitCarousel(container) {
  if (!container) return;

  if (typeof window.initCarousel === 'function') {
    try { window.initCarousel(container); } 
    catch (e) { console.warn('initCarousel falló:', e); }
    return;
  }

  if (!document.querySelector('script[data-carousel-loader]')) {
    const s = document.createElement('script');
    s.src = 'carousel.js';
    s.dataset.carouselLoader = '1';
    s.onload = () => {
      if (typeof window.initCarousel === 'function') {
        try { window.initCarousel(container); } 
        catch (e) { console.warn('initCarousel post-load falló:', e); }
      }
    };
    s.onerror = () => console.warn('No se pudo cargar carousel.js');
    document.head.appendChild(s);
  }
}

// === RENDERIZADO DE PRODUCTOS ===
function renderProducts(list) {
  grid.innerHTML = "";

  const grouped = {};
  list.forEach(p => {
    const cat = p.categoria || "Otros";
    if (!grouped[cat]) grouped[cat] = [];
    grouped[cat].push(p);
  });

  Object.keys(grouped).forEach(cat => {
    const products = grouped[cat];
    const section = document.createElement('section');
    section.classList.add('category-section');
    section.innerHTML = `
      <h2 style="text-align:center; margin:20px 0">${cat}</h2>
      <div class="carousel-container">
        <button class="carousel-btn prev">&#8249;</button>
        <div class="carousel-track">
          ${products.map(p => `
            <div class="carousel-item">
              <article class="card">
                <img src="${p.imagen_url}" alt="${p.nombre}">
                <div class="body">
                  <div class="title">${p.nombre}</div>
                  <div class="muted">${p.categoria || ''}</div>
                  <div class="row" style="display:flex;align-items:center;justify-content:space-between">
                    <div class="price">${formatMoney(p.precio)}</div>
                    <button class="btn primary" data-add="${p.id}">Agregar</button>
                  </div>
                </div>
              </article>
            </div>
          `).join('')}
        </div>
        <button class="carousel-btn next">&#8250;</button>
      </div>
    `;
    grid.appendChild(section);
    ensureInitCarousel(section.querySelector('.carousel-container'));
  });

  grid.querySelectorAll('[data-add]').forEach(btn => {
    btn.addEventListener('click', () => {
      if (!estaDentroDelHorario()) {
        showToast("⚠️ El restaurante abre a las 10:00 a.m.", "error");
        return;
      }

      const id = btn.getAttribute('data-add');
      const product = PRODUCTS.find(x => x.id === id);
      if (product) {
        cart.add({
          id: product.id,
          nombre: product.nombre,
          precio: product.precio,
          imagen_url: product.imagen_url,
          qty: 1
        });
        showToast(`🛒 ${product.nombre} agregado al carrito`, "success");
        window.dispatchEvent(new Event('cart:change'));
      } else {
        showToast("⚠️ Producto no encontrado", "error");
      }
    });
  });
}

// === FILTRADO DE PRODUCTOS ===
function filterProducts() {
  const q = (search.value || '').toLowerCase().trim();
  const cat = categoria.value;
  let list = PRODUCTS.slice();

  if (cat) list = list.filter(p => (p.categoria || '') === cat);
  if (q) list = list.filter(p =>
    (p.nombre || '').toLowerCase().includes(q) ||
    (p.descripcion || '').toLowerCase().includes(q)
  );

  renderProducts(list);
}

// === RENDER DEL CARRITO ===
function renderCart() {
  const items = cart.items;
  cartList.innerHTML = items.length
    ? items.map(i => `
        <div class="row">
          <div style="display:flex;align-items:center;gap:10px">
            ${i.imagen_url ? `<img src="${i.imagen_url}" style="width:48px;height:48px;object-fit:cover;border-radius:10px;border:1px solid #eadcc7">` : ''}
            <div>
              <div style="font-weight:700">${i.nombre}</div>
              <small class="muted">${formatMoney(i.precio)}</small>
            </div>
          </div>
          <div style="display:flex;align-items:center;gap:6px">
            <button class="btn" data-dec="${i.id}">-</button>
            <div>${i.qty}</div>
            <button class="btn" data-inc="${i.id}">+</button>
            <button class="btn ghost" data-del="${i.id}">✕</button>
          </div>
        </div>
      `).join('')
    : '<p class="muted">Tu carrito está vacío.</p>';

  cartTotalEl.textContent = 'Total: ' + formatMoney(cartTotal());
  cartList.querySelectorAll('[data-inc]').forEach(b => b.addEventListener('click', () => changeQty(b.getAttribute('data-inc'), +1)));
  cartList.querySelectorAll('[data-dec]').forEach(b => b.addEventListener('click', () => changeQty(b.getAttribute('data-dec'), -1)));
  cartList.querySelectorAll('[data-del]').forEach(b => b.addEventListener('click', () => removeItem(b.getAttribute('data-del'))));

  checkoutBtn.href = buildWhatsAppURL(items);
}

// === CAMBIO DE CANTIDAD ===
function changeQty(id, delta) {
  const item = cart.items.find(x => x.id === id);
  if (!item) return;
  const next = Math.max(1, item.qty + delta);
  cart.setQty(id, next);
  showToast(`🔁 ${item.nombre}: cantidad actual ${next}`, "info");
}

// === ELIMINAR ITEM ===
function removeItem(id) {
  const item = cart.items.find(x => x.id === id);
  if (!item) return;
  cart.remove(id);
  showToast(`❌ ${item.nombre} eliminado del carrito`, "error");
}

// === URL DE WHATSAPP ===
function buildWhatsAppURL(items) {
  if (!items.length) return '#';
  let text = 'Hola, quiero hacer un pedido:%0A';
  for (const i of items) {
    text += `• ${i.nombre} x${i.qty} - ${formatMoney(i.precio * i.qty)}%0A`;
  }
  text += `%0ATotal: ${formatMoney(cartTotal())}`;
  return `https://wa.me/${WHATSAPP_NUMBER}?text=${text}`;
}

// === FUNCIÓN PRINCIPAL ===
async function main() {
  try {
    await mountChrome();
    initFloatingCart();

    const stored = JSON.parse(localStorage.getItem('camaron_cart_v1') || '[]');
    if (!stored.length) cart.clear(); 

    window.addEventListener('cart:change', renderCart);

    clearBtn.addEventListener('click', () => {
      if (!cart.items.length) {
        showToast("⚠️ Tu carrito ya está vacío", "info");
        return;
      }
      localStorage.removeItem('camaron_cart_v1');
      cart.clear();
      renderCart();
      showToast("🧹 Carrito vaciado correctamente", "success");
    });

    PRODUCTS = await fetchAll('productos_web', '*', { order: { col: 'created_at', asc: false } });
    window.PRODUCTS = PRODUCTS;
    window.cart = cart;

    renderProducts(PRODUCTS);

    const abierto = estaDentroDelHorario();
    if (!abierto) {
      mostrarAvisoFueraHorario();
      deshabilitarFueraHorario();
    }

    renderCart();
    search.addEventListener('input', filterProducts);
    categoria.addEventListener('change', filterProducts);

    // 🧾 Redirección segura a pago.html
    checkoutBtn.addEventListener('click', (e) => {
      e.preventDefault();
      if (!cart.items.length) {
        showToast("⚠️ Tu carrito está vacío", "error");
        return;
      }
      localStorage.setItem('camaron_cart_v1', JSON.stringify(cart.items));
      showToast("✅ Redirigiendo al pago...", "success");
      setTimeout(() => (window.location.href = './pago.html'), 600);
    });

    // 🔁 Verificación automática cada minuto
    setInterval(() => {
      if (estaDentroDelHorario()) {
        habilitarSiAbierto();
      } else {
        deshabilitarFueraHorario();
      }
    }, 60000);

  } catch (err) {
    console.error("Error en el menú:", err);
    showToast("❌ Error al cargar el menú", "error");
  }
}

// 🚀 Ejecutar
main();

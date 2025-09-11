import { fetchAll } from './supabaseClient.js';
import { mountChrome, initFloatingCart, formatMoney } from './ui.js';
import { cart, cartTotal } from './cart.js';

let PRODUCTS = [];

const grid = document.getElementById('menuGrid');
const search = document.getElementById('search');
const categoria = document.getElementById('categoria');
const cartList = document.getElementById('cartList');
const cartTotalEl = document.getElementById('cartTotal');
const clearBtn = document.getElementById('clearCart');
const checkoutBtn = document.getElementById('checkoutBtn');

// Helper robusto para inicializar el carrusel (evita ReferenceError si no está aún cargado)
function ensureInitCarousel(container) {
  if (!container) return;

  // Si la función ya está disponible globalmente, usarla
  if (typeof window.initCarousel === 'function') {
    try { window.initCarousel(container); } catch (e) { console.warn('initCarousel falló:', e); }
    return;
  }

  // Si no existe, intentar cargar carousel.js dinámicamente (solo una vez)
  if (!document.querySelector('script[data-carousel-loader]')) {
    const s = document.createElement('script');
    s.src = 'carousel.js';
    s.dataset.carouselLoader = '1';
    s.onload = () => {
      if (typeof window.initCarousel === 'function') {
        try { window.initCarousel(container); } catch (e) { console.warn('initCarousel after load falló:', e); }
      }
    };
    s.onerror = () => console.warn('No se pudo cargar carousel.js dinámicamente');
    document.head.appendChild(s);
    return;
  }

  // Si ya existe el loader, esperar brevemente a que esté disponible
  const maxWait = 3000;
  const interval = 100;
  let waited = 0;
  const t = setInterval(() => {
    if (typeof window.initCarousel === 'function') {
      clearInterval(t);
      window.initCarousel(container);
    }
    waited += interval;
    if (waited >= maxWait) clearInterval(t);
  }, interval);
}

// === Renderizar productos en carruseles por categoría ===
function renderProducts(list) {
  grid.innerHTML = "";

  // Agrupar productos por categoría
  const grouped = {};
  list.forEach(p => {
    const cat = p.categoria || "Otros";
    if (!grouped[cat]) grouped[cat] = [];
    grouped[cat].push(p);
  });

  // Crear un carrusel por categoría
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

    // Inicializar el carrusel de forma robusta
    ensureInitCarousel(section.querySelector('.carousel-container'));
  });

  // Bind botones "Agregar"
  grid.querySelectorAll('[data-add]').forEach(btn => {
    btn.addEventListener('click', () => {
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
        // disparar evento para actualizar UI del carrito
        window.dispatchEvent(new Event('cart:change'));
      }
    });
  });
}

// === Filtrar productos ===
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

// === Renderizar carrito ===
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

  // Bind qty actions
  cartList.querySelectorAll('[data-inc]').forEach(b =>
    b.addEventListener('click', () => changeQty(b.getAttribute('data-inc'), +1))
  );
  cartList.querySelectorAll('[data-dec]').forEach(b =>
    b.addEventListener('click', () => changeQty(b.getAttribute('data-dec'), -1))
  );
  cartList.querySelectorAll('[data-del]').forEach(b =>
    b.addEventListener('click', () => removeItem(b.getAttribute('data-del')))
  );

  checkoutBtn.href = buildWhatsAppURL(items);
}

function changeQty(id, delta) {
  const item = cart.items.find(x => x.id === id);
  if (!item) return;
  const next = Math.max(1, item.qty + delta);
  cart.setQty(id, next);
}

function removeItem(id) {
  cart.remove(id);
}

function buildWhatsAppURL(items) {
  if (!items.length) return '#';
  let text = 'Hola, quiero hacer un pedido:%0A';
  for (const i of items) {
    text += `• ${i.nombre} x${i.qty} - ${formatMoney(i.precio * i.qty)}%0A`;
  }
  text += `%0ATotal: ${formatMoney(cartTotal())}`;
  return `https://wa.me/51986556773?text=${text}`;
}

// === MAIN ===
async function main() {
  await mountChrome();
  initFloatingCart();

  window.addEventListener('cart:change', renderCart);

  clearBtn.addEventListener('click', () => {
    localStorage.removeItem('camaron_cart_v1');
    window.dispatchEvent(new Event('cart:change'));
    renderCart();
  });

  PRODUCTS = await fetchAll('productos_web', '*', {
    order: { col: 'created_at', asc: false }
  });

  renderProducts(PRODUCTS);
  renderCart();

  search.addEventListener('input', filterProducts);
  categoria.addEventListener('change', filterProducts);
}

main();

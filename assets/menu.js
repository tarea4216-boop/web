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

function renderProducts(list){
  grid.innerHTML = list.map(p => `
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
  `).join('');

  // Bind add buttons
  grid.querySelectorAll('[data-add]').forEach(btn => {
    btn.addEventListener('click', () => {
      const id = btn.getAttribute('data-add');
      const product = PRODUCTS.find(x => x.id === id);
      if(product) {
        cart.add({ id:product.id, nombre:product.nombre, precio:product.precio, imagen_url:product.imagen_url, qty:1 });
      }
    });
  });
}

function filterProducts(){
  const q = (search.value||'').toLowerCase().trim();
  const cat = categoria.value;
  let list = PRODUCTS.slice();
  if(cat) list = list.filter(p => (p.categoria||'') === cat);
  if(q) list = list.filter(p => (p.nombre||'').toLowerCase().includes(q) || (p.descripcion||'').toLowerCase().includes(q));
  renderProducts(list);
}

function renderCart(){
  const items = cart.items;
  cartList.innerHTML = items.length ? items.map(i => `
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
  `).join('') : '<p class="muted">Tu carrito está vacío.</p>';
  cartTotalEl.textContent = 'Total: ' + formatMoney(cartTotal());

  // Bind qty actions
  cartList.querySelectorAll('[data-inc]').forEach(b => b.addEventListener('click', () => changeQty(b.getAttribute('data-inc'), +1)));
  cartList.querySelectorAll('[data-dec]').forEach(b => b.addEventListener('click', () => changeQty(b.getAttribute('data-dec'), -1)));
  cartList.querySelectorAll('[data-del]').forEach(b => b.addEventListener('click', () => removeItem(b.getAttribute('data-del'))));

  // Build WhatsApp link (if empresa.whatsapp exists, fallback to blank)
  checkoutBtn.href = buildWhatsAppURL(items);
}

function changeQty(id, delta){
  const item = cart.items.find(x => x.id===id);
  if(!item) return;
  const next = Math.max(1, item.qty + delta);
  cart.setQty(id, next);
}
function removeItem(id){ cart.remove(id); }

function buildWhatsAppURL(items){
  if(!items.length) return '#';
  let text = 'Hola, quiero hacer un pedido:%0A';
  for(const i of items){
    text += `• ${i.nombre} x${i.qty} - ${formatMoney(i.precio*i.qty)}%0A`;
  }
  text += `%0ATotal: ${formatMoney(cartTotal())}`;
  return `https://wa.me/?text=${text}`;
}

async function main(){
  await mountChrome();
  initFloatingCart();
  window.addEventListener('cart:change', renderCart);
  clearBtn.addEventListener('click', () => { localStorage.removeItem('camaron_cart_v1'); window.dispatchEvent(new Event('cart:change')); renderCart(); });

  PRODUCTS = await fetchAll('productos_web', '*', { order:{ col:'created_at', asc:false } });
  renderProducts(PRODUCTS);
  renderCart();
  search.addEventListener('input', filterProducts);
  categoria.addEventListener('change', filterProducts);
}
main();

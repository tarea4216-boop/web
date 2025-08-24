// assets/cart.js
const STORAGE_KEY = 'camaron_cart_v1';
function load(){ try { return JSON.parse(localStorage.getItem(STORAGE_KEY)||'[]'); } catch { return []; } }
function save(items){ localStorage.setItem(STORAGE_KEY, JSON.stringify(items)); window.dispatchEvent(new Event('cart:change')); }
export const cart = {
  get items(){ return load(); },
  add(p){
    const items = load();
    const idx = items.findIndex(x => x.id === p.id);
    if(idx>=0){ items[idx].qty += (p.qty||1); } else { items.push({ id:p.id, nombre:p.nombre, precio:p.precio, imagen_url:p.imagen_url, qty:p.qty||1 }); }
    save(items);
  },
  setQty(id, qty){
    let items = load().map(x => x.id===id?{...x, qty:Math.max(1, qty|0)}:x);
    save(items);
  },
  remove(id){ save(load().filter(x=>x.id!==id)); },
  clear(){ save([]); }
};
export function cartCount(){ return load().reduce((a,b)=>a+b.qty,0); }
export function cartTotal(){ return load().reduce((a,b)=>a+(Number(b.precio)||0)*b.qty,0); }
export function formatMoney(n){ return 'S/ ' + (Number(n||0)).toFixed(2); }

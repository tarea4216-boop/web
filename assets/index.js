// assets/index.js
import { fetchAll } from './supabaseClient.js';
import { mountChrome, formatMoney } from './ui.js';

async function loadHome(){
  await mountChrome();

  // Productos destacados (simple: tomar 6 más recientes)
  try{
    const productos = await fetchAll('productos_web', '*', { order:{ col:'created_at', asc:false } });
    const grid = document.getElementById('destGrid');
    grid.innerHTML = productos.slice(0,6).map(p => `
      <article class="card">
        <img src="${p.imagen_url}" alt="${p.nombre}">
        <div class="body">
          <div class="title">${p.nombre}</div>
          <div class="muted">${p.descripcion||''}</div>
          <div class="price">${formatMoney(p.precio)}</div>
        </div>
      </article>
    `).join('');
  }catch(e){ console.error(e); }

  // Promos (3)
  try{
    const promos = await fetchAll('promociones', '*', { order:{ col:'created_at', asc:false } });
    const grid = document.getElementById('promoGrid');
    grid.innerHTML = promos.slice(0,3).map(p => `
      <article class="card">
        ${p.foto_url ? `<img src="${p.foto_url}" alt="${p.nombre}">` : ''}
        <div class="body">
          <div class="title">${p.nombre}</div>
          <div class="price">${formatMoney(p.precio)}</div>
          ${p.fecha_vigencia ? `<div class="badge">Vigente hasta ${p.fecha_vigencia}</div>`:''}
        </div>
      </article>
    `).join('');
  }catch(e){ console.error(e); }

  // Testimonios (4)
  try{
    const testis = await fetchAll('testimonios', '*', { order:{ col:'created_at', asc:false } });
    const grid = document.getElementById('testiGrid');
    grid.innerHTML = testis.slice(0,4).map(t => `
      <article class="card">
        <div class="body">
          <div class="title">${'★'.repeat(Math.max(1, Math.min(5, t.estrellas||5)))} <span class="muted">${t.nombre}</span></div>
          <div>${t.opinion||''}</div>
        </div>
      </article>
    `).join('');
  }catch(e){ console.error(e); }
}
loadHome();

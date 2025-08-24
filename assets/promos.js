import { fetchAll } from './supabaseClient.js';
import { mountChrome, formatMoney } from './ui.js';
async function main(){
  await mountChrome();
  const grid = document.getElementById('promoGrid');
  try{
    const rows = await fetchAll('promociones','*',{ order:{col:'created_at', asc:false} });
    grid.innerHTML = rows.map(p => `
      <article class="card">
        ${p.foto_url ? `<img src="${p.foto_url}" alt="${p.nombre}">` : ''}
        <div class="body">
          <div class="title">${p.nombre}</div>
          <div class="price">${formatMoney(p.precio)}</div>
          ${p.fecha_vigencia? `<div class="badge">Hasta ${p.fecha_vigencia}</div>`:''}
        </div>
      </article>
    `).join('');
  }catch(e){ grid.innerHTML = '<p class="muted">No fue posible cargar promociones.</p>'; }
}
main();

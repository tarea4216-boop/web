import { fetchAll } from './supabaseClient.js';
import { mountChrome } from './ui.js';
async function main(){
  await mountChrome();
  const grid = document.getElementById('teamGrid');
  try{
    const rows = await fetchAll('equipo','*',{ order:{col:'created_at', asc:false} });
    grid.innerHTML = rows.map(m => `
      <article class="card center">
        ${m.foto_url ? `<img src="${m.foto_url}" alt="${m.nombre}" style="width:100%;height:220px;object-fit:cover">` : ''}
        <div class="body">
          <div class="title">${m.nombre}</div>
          <div class="muted">${m.puesto||''}</div>
          <div>${m.descripcion||''}</div>
        </div>
      </article>
    `).join('');
  }catch(e){ grid.innerHTML = '<p class="muted">No fue posible cargar el equipo.</p>'; }
}
main();

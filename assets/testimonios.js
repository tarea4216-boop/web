import { fetchAll } from './supabaseClient.js';
import { mountChrome } from './ui.js';
async function main(){
  await mountChrome();
  const grid = document.getElementById('testiGrid');
  try{
    const rows = await fetchAll('testimonios','*',{ order:{col:'created_at', asc:false} });
    grid.innerHTML = rows.map(t => `
      <article class="card">
        <div class="body">
          <div class="title">${'★'.repeat(Math.max(1, Math.min(5, t.estrellas||5)))} <span class="muted">${t.nombre}</span></div>
          <div>${t.opinion||''}</div>
        </div>
      </article>
    `).join('');
  }catch(e){ grid.innerHTML = '<p class="muted">No fue posible cargar testimonios.</p>'; }
}
main();

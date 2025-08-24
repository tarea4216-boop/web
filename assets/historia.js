import { fetchAll } from './supabaseClient.js';
import { mountChrome } from './ui.js';
async function main(){
  await mountChrome();
  const wrap = document.getElementById('histWrap');
  try{
    const rows = await fetchAll('historia','*',{ order:{col:'created_at', asc:false} });
    wrap.innerHTML = rows.map(h => `
      <article class="card">
        ${h.imagen_url ? `<img src="${h.imagen_url}" alt="${h.titulo}">` : ''}
        <div class="body">
          <div class="title">${h.titulo}</div>
          <div>${h.texto||''}</div>
        </div>
      </article>
    `).join('');
  }catch(e){ wrap.innerHTML = '<p class="muted">No fue posible cargar la historia.</p>'; }
}
main();

import { fetchAll } from './supabaseClient.js';
import { mountChrome } from './ui.js';
async function main(){
  await mountChrome();
  const grid = document.getElementById('newsGrid');
  try{
    // Usamos tabla 'galeria' como noticias/blog
    const rows = await fetchAll('galeria','*',{ order:{col:'created_at', asc:false} });
    grid.innerHTML = rows.map(n => `
      <article class="card">
        ${n.imagen_url ? `<img src="${n.imagen_url}" alt="${n.titulo}">` : ''}
        <div class="body">
          <div class="title">${n.titulo}</div>
          <div class="muted">${n.fecha || ''} ${n.autor? ' · ' + n.autor : ''}</div>
          <div>${n.contenido || ''}</div>
        </div>
      </article>
    `).join('');
  }catch(e){ grid.innerHTML = '<p class="muted">No fue posible cargar noticias.</p>'; }
}
main();

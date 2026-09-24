import { fetchAll } from './supabaseClient.js';
import { mountChrome } from './ui.js';

async function main() {
  await mountChrome();

  const grid = document.getElementById('newsGrid');

  try {
    // Usamos la tabla 'galeria' como noticias/blog
    const rows = await fetchAll('galeria', '*', {
      order: { col: 'created_at', asc: false }
    });

    if (!rows || rows.length === 0) {
      grid.innerHTML = `
        <div class="news-empty">
          No hay noticias disponibles por el momento.
        </div>
      `;
      return;
    }

    grid.innerHTML = rows.map(n => {
      const hasImage = !!n.imagen_url;

      return `
        <article class="news-card ${hasImage ? '' : 'no-image'}">

          ${hasImage ? `
            <div class="news-image">
              <img
                src="${n.imagen_url}"
                alt="${n.titulo || 'Noticia de El Camarón de Oro'}"
                loading="lazy"
              >

              <span class="news-label">
                Noticias
              </span>
            </div>
          ` : ''}

          <div class="news-body">

            ${(n.fecha || n.autor) ? `
              <div class="news-meta">
                ${n.fecha ? `<span>${n.fecha}</span>` : ''}
                ${n.fecha && n.autor ? `<span class="separator">·</span>` : ''}
                ${n.autor ? `<span>${n.autor}</span>` : ''}
              </div>
            ` : ''}

            <h3 class="news-title">
              ${n.titulo || 'Sin título'}
            </h3>

            <div class="news-divider"></div>

            <div class="news-content">
              ${n.contenido || ''}
            </div>

          </div>

        </article>
      `;
    }).join('');

  } catch (e) {
    console.error('Error al cargar noticias:', e);

    grid.innerHTML = `
      <div class="news-empty">
        No fue posible cargar las noticias.
      </div>
    `;
  }
}

main();

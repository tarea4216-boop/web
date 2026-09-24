import { fetchAll } from './supabaseClient.js';
import { mountChrome } from './ui.js';

async function main() {
  await mountChrome();

  const wrap = document.getElementById('histWrap');

  try {
    const rows = await fetchAll('historia', '*', {
      order: {
        col: 'created_at',
        asc: false
      }
    });

    wrap.innerHTML = rows.map(h => {

      const hasImage = !!h.imagen_url;

      return `
        <article class="history-item ${hasImage ? '' : 'no-image'}">

          ${hasImage ? `
            <div class="history-image">
              <img
                src="${h.imagen_url}"
                alt="${h.titulo}"
                loading="lazy"
              >
            </div>
          ` : ''}

          <div class="history-content">

            <h3 class="history-title">
              ${h.titulo}
            </h3>

            <div class="history-text">
              ${h.texto || ''}
            </div>

          </div>

          ${hasImage ? `
            <span class="history-dot" aria-hidden="true"></span>
          ` : ''}

        </article>
      `;
    }).join('');

  } catch (e) {
    wrap.innerHTML = `
      <p class="muted">
        No fue posible cargar la historia.
      </p>
    `;
  }
}

main();

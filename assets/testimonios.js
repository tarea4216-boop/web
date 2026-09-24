import { fetchAll } from './supabaseClient.js';
import { mountChrome } from './ui.js';

async function main() {
  await mountChrome();

  const grid = document.getElementById('testiGrid');

  try {
    const rows = await fetchAll('testimonios', '*', {
      order: {
        col: 'created_at',
        asc: false
      }
    });

    grid.innerHTML = rows.map(t => {

      const stars = Math.max(
        1,
        Math.min(5, t.estrellas || 5)
      );

      return `
        <article class="testimonial-card">

          <span class="quote-mark" aria-hidden="true">
            “
          </span>

          <div class="testimonial-body">

            <div class="testimonial-rating" aria-label="${stars} de 5 estrellas">
              ${'★'.repeat(stars)}
              <span class="rating-number">
                ${stars}/5
              </span>
            </div>

            <div class="testimonial-opinion">
              ${t.opinion || ''}
            </div>

            <div class="testimonial-divider"></div>

            <div class="testimonial-name">
              ${t.nombre || 'Cliente'}
            </div>

          </div>

        </article>
      `;
    }).join('');

  } catch (e) {
    grid.innerHTML = `
      <p class="muted">
        No fue posible cargar testimonios.
      </p>
    `;
  }
}

main();

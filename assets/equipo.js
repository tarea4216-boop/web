import { fetchAll } from './supabaseClient.js';
import { mountChrome } from './ui.js';

async function main() {
  await mountChrome();

  const grid = document.getElementById('teamGrid');

  try {
    const rows = await fetchAll('equipo', '*', {
      order: {
        col: 'created_at',
        asc: false
      }
    });

    grid.innerHTML = rows.map(m => {

      const hasPhoto = !!m.foto_url;

      return `
        <article class="team-card ${hasPhoto ? '' : 'no-photo'}">

          ${hasPhoto ? `
            <div class="team-photo">

              <img
                src="${m.foto_url}"
                alt="${m.nombre}"
                loading="lazy"
              >

              <span class="team-label">
                Nuestro equipo
              </span>

            </div>
          ` : ''}

          <div class="team-body">

            <h3 class="team-name">
              ${m.nombre}
            </h3>

            ${m.puesto ? `
              <div class="team-position">
                ${m.puesto}
              </div>
            ` : ''}

            <div class="team-divider"></div>

            <div class="team-description">
              ${m.descripcion || ''}
            </div>

          </div>

        </article>
      `;
    }).join('');

  } catch (e) {
    grid.innerHTML = `
      <p class="muted">
        No fue posible cargar el equipo.
      </p>
    `;
  }
}

main();

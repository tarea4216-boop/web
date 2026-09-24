import { fetchSingle } from './supabaseClient.js';
import { mountChrome } from './ui.js';

async function main() {
  await mountChrome();

  const box = document.getElementById('contactInfo');
  const ubicacionSection = document.getElementById('ubicacionSection');
  const mapContainer = document.getElementById('mapContainer');

  try {
    const e = await fetchSingle('empresa');

    if (!e) {
      box.innerHTML = `
        <div class="contact-error">
          No fue posible encontrar la información de contacto.
        </div>
      `;
      return;
    }

    box.innerHTML = `
      <div class="contact-brand">

        ${e.logo_url ? `
          <img
            class="contact-logo"
            src="${e.logo_url}"
            alt="${e.nombre_comercial || 'El Camarón de Oro'}"
          >
        ` : ''}

        <div>
          <h3 class="contact-brand-name">
            ${e.nombre_comercial || 'El Camarón de Oro'}
          </h3>

          <div class="contact-brand-subtitle">
            Restaurante
          </div>
        </div>

      </div>

      <div class="contact-details">

        ${e.direccion ? `
          <div class="contact-detail">
            <div class="contact-icon">⌖</div>

            <div class="contact-detail-text">
              <div class="contact-detail-label">
                Dirección
              </div>

              <div class="contact-detail-value">
                ${e.direccion}
              </div>
            </div>
          </div>
        ` : ''}

        ${e.horarios ? `
          <div class="contact-detail">
            <div class="contact-icon">◷</div>

            <div class="contact-detail-text">
              <div class="contact-detail-label">
                Horarios
              </div>

              <div class="contact-detail-value">
                ${e.horarios}
              </div>
            </div>
          </div>
        ` : ''}

        ${e.telefono ? `
          <div class="contact-detail">
            <div class="contact-icon">☎</div>

            <div class="contact-detail-text">
              <div class="contact-detail-label">
                Teléfono
              </div>

              <div class="contact-detail-value">
                ${e.telefono}
              </div>
            </div>
          </div>
        ` : ''}

        ${e.email ? `
          <div class="contact-detail">
            <div class="contact-icon">✉</div>

            <div class="contact-detail-text">
              <div class="contact-detail-label">
                Correo electrónico
              </div>

              <div class="contact-detail-value">
                ${e.email}
              </div>
            </div>
          </div>
        ` : ''}

      </div>

      <div class="contact-actions">

        ${e.telefono ? `
          <a
            class="contact-action"
            href="tel:${e.telefono}"
          >
            ☎ Llamar
          </a>
        ` : ''}

        ${e.whatsapp ? `
          <a
            class="contact-action primary"
            href="https://wa.me/${e.whatsapp}"
            target="_blank"
            rel="noopener"
          >
            WhatsApp
          </a>
        ` : ''}

        ${e.email ? `
          <a
            class="contact-action"
            href="mailto:${e.email}"
          >
            ✉ Email
          </a>
        ` : ''}

        ${e.facebook ? `
          <a
            class="contact-action"
            href="${e.facebook}"
            target="_blank"
            rel="noopener"
          >
            Facebook
          </a>
        ` : ''}

        ${e.instagram ? `
          <a
            class="contact-action"
            href="${e.instagram}"
            target="_blank"
            rel="noopener"
          >
            Instagram
          </a>
        ` : ''}

        ${e.tiktok ? `
          <a
            class="contact-action"
            href="${e.tiktok}"
            target="_blank"
            rel="noopener"
          >
            TikTok
          </a>
        ` : ''}

      </div>
    `;

    /* =========================================================
       UBICACIÓN / MAPA
       ========================================================= */

    if (e.maps_url) {
      ubicacionSection.style.display = 'block';

      mapContainer.innerHTML = `
        <iframe
          src="${e.maps_url}"
          allowfullscreen
          loading="lazy"
          referrerpolicy="no-referrer-when-downgrade"
          title="Ubicación de El Camarón de Oro"
        ></iframe>
      `;
    } else {
      ubicacionSection.style.display = 'none';
    }

  } catch (err) {

    console.error('⚠️ Error cargando empresa:', err);

    box.innerHTML = `
      <div class="contact-error">
        No fue posible cargar la información de contacto.
      </div>
    `;

    ubicacionSection.style.display = 'none';
  }
}

main();

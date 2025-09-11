import { fetchSingle } from './supabaseClient.js';
import { mountChrome } from './ui.js';

async function main(){
  await mountChrome();
  const box = document.getElementById('contactInfo');
  try{
    const e = await fetchSingle('empresa');
    box.innerHTML = `
      <div class="row">
        ${e?.logo_url ? `<img src="${e.logo_url}" alt="logo">` : ''}
        <div>
          <div class="title">${e?.nombre_comercial || 'El Camarón de Oro'}</div>
          <div class="muted">${e?.direccion || ''}</div>
          <div class="muted">${e?.horarios || ''}</div>
        </div>
      </div>

      <div class="actions" style="margin-top:12px;display:flex;gap:10px;flex-wrap:wrap">
        ${e?.telefono ? `<a class="btn" href="tel:${e.telefono}">Llamar</a>`:''}
        ${e?.whatsapp ? `<a class="btn primary" href="https://wa.me/${e.whatsapp}" target="_blank" rel="noopener">WhatsApp</a>`:''}
        ${e?.email ? `<a class="btn ghost" href="mailto:${e.email}">Email</a>`:''}
        ${e?.facebook ? `<a class="btn ghost" href="${e.facebook}" target="_blank" rel="noopener">Facebook</a>`:''}
        ${e?.instagram ? `<a class="btn ghost" href="${e.instagram}" target="_blank" rel="noopener">Instagram</a>`:''}
        ${e?.tiktok ? `<a class="btn ghost" href="${e.tiktok}" target="_blank" rel="noopener">TikTok</a>`:''}
      </div>

      ${
        e?.maps_url 
          ? `<div class="map-wrapper">
              <iframe src="${e.maps_url}" allowfullscreen="" loading="lazy"></iframe>
            </div>`
          : ''
      }
    `;
  }catch(err){ 
    console.error("⚠️ Error cargando empresa:", err);
    box.innerHTML = '<p class="muted">No fue posible cargar la información de contacto.</p>'; 
  }
}
main();

// assets/ui.js
import { supabase, fetchSingle } from './supabaseClient.js';
import { cart, cartCount, formatMoney } from './cart.js';

/** Build header nav and footer from DB (empresa + configuraciones) */
export async function mountChrome(){
  const header = document.querySelector('.header');
  const footer = document.querySelector('.footer');
  let empresa = null, conf = null;
  try{
    [empresa, conf] = await Promise.all([
      fetchSingle('empresa'),
      fetchSingle('configuraciones')
    ]);
  }catch(e){ console.warn('No se pudieron leer datos de empresa/config', e); }

  // Theming
  if(conf?.color_primario){ document.documentElement.style.setProperty('--crema-500', conf.color_primario); }
  if(conf?.color_secundario){ document.documentElement.style.setProperty('--crema-700', conf.color_secundario); }

  // Header con botón hamburguesa
  header.innerHTML = `
    <div class="topbar container">
      <div class="brand">
        ${empresa?.logo_url ? `<img src="${empresa.logo_url}" alt="logo">` : ''}
        <div>
          <div>${empresa?.nombre_comercial || 'El Camarón de Oro'}</div>
          ${empresa?.horarios ? `<small class="muted">${empresa.horarios}</small>`:''}
        </div>
      </div>

      <!-- Botón hamburguesa -->
      <button class="menu-toggle" aria-label="Abrir menú">☰</button>

      <!-- Menú de navegación -->
      <nav class="menu">
        <a href="index.html">Inicio</a>
        <a href="menu.html">Menú</a>
        <a href="promos.html">Promos</a>
        <a href="historia.html">Historia</a>
        <a href="equipo.html">Equipo</a>
        <a href="testimonios.html">Testimonios</a>
        <a href="noticias.html">Noticias</a>
        <a href="contacto.html">Contacto</a>
      </nav>
    </div>
  `;

  // Lógica para abrir/cerrar menú en móvil
  const toggle = header.querySelector('.menu-toggle');
  const nav = header.querySelector('.menu');
  if(toggle && nav){
    toggle.addEventListener('click', ()=> nav.classList.toggle('open'));
  }

  // Footer
  footer.innerHTML = `
    <div class="wrap container">
      <div>
        <strong>${empresa?.nombre_comercial || 'El Camarón de Oro'}</strong><br>
        ${empresa?.direccion ? `<small class="muted">${empresa.direccion}</small>`:''}
      </div>
      <div class="muted">
        <small>${conf?.texto_footer || '© ' + new Date().getFullYear() + ' El Camarón de Oro'}</small>
      </div>
    </div>
  `;
}

/** Floating cart button (only render if #floatingCart exists on page) */
export function initFloatingCart(){
  const btn = document.getElementById('floatingCart');
  if(!btn) return;
  const badge = btn.querySelector('.count');
  const sync = ()=>{ badge.textContent = cartCount(); btn.style.display = cartCount()>0 ? 'flex' : 'flex'; };
  sync();
  window.addEventListener('cart:change', sync);
  btn.addEventListener('click', ()=>{
    document.getElementById('cartDrawer').classList.add('open');
  });
}

/** Simple toast */
export function toast(msg){
  alert(msg);
}

export { formatMoney };

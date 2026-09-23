// assets/ui.js

import { supabase, fetchSingle } from './supabaseClient.js';
import { cart, cartCount, formatMoney } from './cart.js';

/**
 * Construye el header y footer desde la información
 * almacenada en Supabase.
 */
export async function mountChrome() {

  // =========================================================
  // BUSCAR HEADER Y FOOTER
  // =========================================================
  // Se admiten ambas formas:
  // <header class="header">
  // <header>
  //
  // y:
  // <footer class="footer">
  // <footer>

  const header = document.querySelector('.header, header');
  const footer = document.querySelector('.footer, footer');

  // Evitar errores si alguna página no tiene header/footer
  if (!header) {
    console.warn('mountChrome: no se encontró el elemento <header>.');
  }

  if (!footer) {
    console.warn('mountChrome: no se encontró el elemento <footer>.');
  }

  // =========================================================
  // OBTENER INFORMACIÓN DE SUPABASE
  // =========================================================

  let empresa = null;
  let conf = null;

  try {

    [empresa, conf] = await Promise.all([
      fetchSingle('empresa'),
      fetchSingle('configuraciones')
    ]);

  } catch (e) {

    console.warn(
      'No se pudieron leer datos de empresa/config',
      e
    );

  }

  // =========================================================
  // THEME
  // =========================================================

  if (conf?.color_primario) {
    document.documentElement.style.setProperty(
      '--crema-500',
      conf.color_primario
    );
  }

  if (conf?.color_secundario) {
    document.documentElement.style.setProperty(
      '--crema-700',
      conf.color_secundario
    );
  }

  // =========================================================
  // HEADER
  // =========================================================

  if (header) {

    header.innerHTML = `

      <div class="topbar container">

        <div class="brand">

          ${
            empresa?.logo_url
              ? `
                <img
                  src="${empresa.logo_url}"
                  alt="${empresa?.nombre_comercial || 'Logo'}"
                >
              `
              : ''
          }

          <div>

            <div>
              ${empresa?.nombre_comercial || 'El Camarón de Oro'}
            </div>

            ${
              empresa?.horarios
                ? `
                  <small class="muted">
                    ${empresa.horarios}
                  </small>
                `
                : ''
            }

          </div>

        </div>

        <!-- Botón hamburguesa -->

        <button
          class="menu-toggle"
          aria-label="Abrir menú"
          type="button"
        >
          ☰
        </button>

        <!-- Menú de navegación -->

        <nav class="menu">

          <a href="index.html">
            Inicio
          </a>

          <a href="menu.html">
            Menú
          </a>

          <a href="promos.html">
            Promos
          </a>

          <a href="historia.html">
            Historia
          </a>

          <a href="equipo.html">
            Equipo
          </a>

          <a href="testimonios.html">
            Testimonios
          </a>

          <a href="noticias.html">
            Noticias
          </a>

          <a href="contacto.html">
            Contacto
          </a>

        </nav>

      </div>

    `;

    // =======================================================
    // MENÚ MÓVIL
    // =======================================================

    const toggle = header.querySelector('.menu-toggle');
    const nav = header.querySelector('.menu');

    if (toggle && nav) {

      toggle.addEventListener('click', () => {

        nav.classList.toggle('open');

        const abierto = nav.classList.contains('open');

        toggle.setAttribute(
          'aria-expanded',
          abierto ? 'true' : 'false'
        );

      });

    }

  }

  // =========================================================
  // FOOTER
  // =========================================================

  if (footer) {

    footer.innerHTML = `

      <div class="wrap container">

        <div>

          <strong>
            ${empresa?.nombre_comercial || 'El Camarón de Oro'}
          </strong>

          <br>

          ${
            empresa?.direccion
              ? `
                <small class="muted">
                  ${empresa.direccion}
                </small>
              `
              : ''
          }

        </div>

        <div class="muted">

          <small>
            ${
              conf?.texto_footer ||
              '© ' +
              new Date().getFullYear() +
              ' El Camarón de Oro'
            }
          </small>

        </div>

      </div>

    `;

  }

}


/**
 * Inicializa el botón flotante del carrito.
 */
export function initFloatingCart() {

  const btn = document.getElementById('floatingCart');

  // Si esta página no tiene carrito, no hacemos nada.
  if (!btn) return;

  const badge = btn.querySelector('.count');

  const sync = () => {

    const cantidad = cartCount();

    // Actualizar contador solamente si existe
    if (badge) {
      badge.textContent = cantidad;
    }

    // Se mantiene visible cuando existe
    btn.style.display = 'flex';

  };

  sync();

  window.addEventListener('cart:change', sync);

  btn.addEventListener('click', () => {

    const drawer = document.getElementById('cartDrawer');

    if (drawer) {
      drawer.classList.add('open');
    }

  });

}


/**
 * Simple toast.
 */
export function toast(msg) {
  alert(msg);
}


// Mantener exportación de formatMoney
export { formatMoney };

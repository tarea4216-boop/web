
/* assets/index.js */

import { fetchAll, supabase } from './supabaseClient.js';
import { mountChrome, formatMoney } from './ui.js';

// ======================================================
// NOTIFICACIONES
// ======================================================

function showToast(message, type = 'info') {
  // Si toast.js expone window.showToast, lo utilizamos.
  if (typeof window.showToast === 'function') {
    window.showToast(message, type);
    return;
  }

  // Respaldo para que la página no falle si no existe.
  console[type === 'error' ? 'error' : 'info'](message);
}


// ======================================================
// LOGO DE LA EMPRESA (SUPABASE)
// ======================================================

async function cargarLogoEmpresa() {
  const imagenesLogo = document.querySelectorAll(
    '.home-brand img, .footer-brand img'
  );

  if (!imagenesLogo.length) {
    console.warn('No se encontraron imágenes del logo en el HTML.');
    return;
  }

  try {
    const { data, error } = await supabase
      .from('empresa')
      .select('logo_url')
      .limit(1)
      .maybeSingle();

    if (error) throw error;

    if (!data?.logo_url) {
      console.warn('No hay logo_url guardado en la tabla empresa.');
      return;
    }

    imagenesLogo.forEach(img => {
      img.src = data.logo_url;
    });

    console.log('✅ Logo cargado desde Supabase:', data.logo_url);

  } catch (error) {
    console.error('❌ Error al cargar el logo de empresa:', error);

    showToast(
      'No se pudo cargar el logo de la empresa',
      'error'
    );
  }
}

// ======================================================
// PRODUCTOS MÁS VENDIDOS
// ======================================================

async function renderMasVendidos() {
  const grid = document.getElementById('destGrid');

  if (!grid) return;

  try {
    grid.innerHTML =
      "<p class='muted'>Cargando productos destacados...</p>";

    // 1. Obtener las ventas
    const { data: ventas, error: ventasError } = await supabase
      .from('ventas')
      .select('productos');

    if (ventasError) throw ventasError;

    // 2. Contabilizar ventas por ID o nombre
    const contador = new Map();

    (ventas || []).forEach(venta => {
      const items = Array.isArray(venta.productos)
        ? venta.productos
        : [];

      items.forEach(item => {
        const clave = item.id || item.nombre || 'Desconocido';
        const cantidad = Number(item.qty) || 1;

        contador.set(
          clave,
          (contador.get(clave) || 0) + cantidad
        );
      });
    });

    // 3. Obtener catálogo
    const productos = await fetchAll('productos_web');

    // 4. Asociar conteo y ordenar
    const productosOrdenados = (productos || [])
      .map(producto => ({
        ...producto,
        ventas:
          contador.get(producto.id) ||
          contador.get(producto.nombre) ||
          0
      }))
      .sort((a, b) => b.ventas - a.ventas)
      .slice(0, 6);

    // 5. Mostrar resultados
    if (!productosOrdenados.length) {
      grid.innerHTML =
        "<p class='muted'>No hay productos disponibles.</p>";
      return;
    }

    grid.innerHTML = productosOrdenados.map(producto => `
      <article class="card fadeIn">
        ${
          producto.imagen_url
            ? `<img
                 src="${producto.imagen_url}"
                 alt="${producto.nombre || 'Producto'}"
                 loading="lazy"
               >`
            : ''
        }

        <div class="body">
          <div class="title">
            ${producto.nombre || ''}
          </div>

          <div class="muted">
            ${producto.descripcion || ''}
          </div>

          <div class="price">
            ${formatMoney(producto.precio)}
          </div>

          <div class="badge">
            ${producto.ventas}
            ${producto.ventas === 1 ? 'venta' : 'ventas'}
          </div>
        </div>
      </article>
    `).join('');

    console.log(
      '✅ Productos destacados actualizados:',
      productosOrdenados
    );

  } catch (error) {
    console.error(
      '❌ Error al cargar los productos más vendidos:',
      error
    );

    grid.innerHTML =
      "<p class='muted'>No se pudieron cargar los productos.</p>";

    showToast(
      'Error al cargar productos destacados',
      'error'
    );
  }
}

// ======================================================
// ACTUALIZACIÓN EN TIEMPO REAL
// ======================================================

function suscribirVentasRealtime() {
  const canal = supabase
    .channel('ventas-realtime')
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'ventas'
      },
      async payload => {
        console.log(
          "🆕 Cambio detectado en 'ventas':",
          payload
        );

        await renderMasVendidos();
      }
    )
    .subscribe();

  console.log(
    "👂 Suscripción en tiempo real a 'ventas' activa"
  );

  return canal;
}

// ======================================================
// PROMOCIONES
// ======================================================

async function renderPromociones() {
  const grid = document.getElementById('promoGrid');

  if (!grid) return;

  try {
    const promos = await fetchAll(
      'promociones',
      '*',
      {
        order: {
          col: 'created_at',
          asc: false
        }
      }
    );

    if (!promos || promos.length === 0) {
      grid.innerHTML =
        "<p class='muted'>No hay promociones vigentes.</p>";
      return;
    }

    grid.innerHTML = promos.slice(0, 3).map(promo => `
      <article class="card">
        ${
          promo.foto_url
            ? `<img
                 src="${promo.foto_url}"
                 alt="${promo.nombre || 'Promoción'}"
                 loading="lazy"
               >`
            : ''
        }

        <div class="body">
          <div class="title">
            ${promo.nombre || ''}
          </div>

          <div class="price">
            ${formatMoney(promo.precio)}
          </div>

          ${
            promo.fecha_vigencia
              ? `<div class="badge">
                   Vigente hasta ${promo.fecha_vigencia}
                 </div>`
              : ''
          }
        </div>
      </article>
    `).join('');

  } catch (error) {
    console.error(
      'Error cargando promociones:',
      error
    );

    grid.innerHTML =
      "<p class='muted'>No se pudieron cargar las promociones.</p>";

    showToast(
      'Error al cargar promociones',
      'error'
    );
  }
}

// ======================================================
// TESTIMONIOS
// ======================================================

async function renderTestimonios() {
  const grid = document.getElementById('testiGrid');

  if (!grid) return;

  try {
    const testimonios = await fetchAll(
      'testimonios',
      '*',
      {
        order: {
          col: 'created_at',
          asc: false
        }
      }
    );

    if (!testimonios || testimonios.length === 0) {
      grid.innerHTML =
        "<p class='muted'>Aún no hay testimonios disponibles.</p>";
      return;
    }

    grid.innerHTML = testimonios.slice(0, 4).map(testimonio => {
      const estrellas = Math.max(
        1,
        Math.min(5, Number(testimonio.estrellas) || 5)
      );

      return `
        <article class="card">
          <div class="body">
            <div class="title">
              ${'★'.repeat(estrellas)}
              <span class="muted">
                ${testimonio.nombre || 'Visitante'}
              </span>
            </div>

            <div>
              ${testimonio.opinion || ''}
            </div>
          </div>
        </article>
      `;
    }).join('');

  } catch (error) {
    console.error(
      'Error cargando testimonios:',
      error
    );

    grid.innerHTML =
      "<p class='muted'>No se pudieron cargar los testimonios.</p>";

    showToast(
      'Error al cargar testimonios',
      'error'
    );
  }
}

// ======================================================
// CARGA INICIAL
// ======================================================

async function loadHome() {
  /*
   * En index.html el header y el footer ya están escritos
   * en el HTML. Por eso no ejecutamos mountChrome()
   * en home-page: ui.js reemplazaría su contenido.
   */

  if (!document.body.classList.contains('home-page')) {
    await mountChrome();
  }

// Cargar el logo y las secciones.
await cargarLogoEmpresa();
await renderMasVendidos();
await renderPromociones();
await renderTestimonios();

  // Activar Realtime después de la carga inicial.
  suscribirVentasRealtime();
}

loadHome();

// ======================================================
// REVEAL DE SECCIONES
// ======================================================

const sections = document.querySelectorAll(
  '.home-section, .home-testimonials, ' +
  '.home-manifesto, .home-experience, .home-final-cta'
);

if ('IntersectionObserver' in window) {
  const observer = new IntersectionObserver(
    entries => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add('visible');
          observer.unobserve(entry.target);
        }
      });
    },
    {
      threshold: 0.12
    }
  );

  sections.forEach(section => {
    observer.observe(section);
  });

} else {
  sections.forEach(section => {
    section.classList.add('visible');
  });
}

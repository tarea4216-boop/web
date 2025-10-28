// assets/index.js
import { fetchAll, supabase } from './supabaseClient.js';
import { mountChrome, formatMoney } from './ui.js';
import Swiper from 'https://cdn.jsdelivr.net/npm/swiper@11/swiper-bundle.min.mjs';

// === 🔁 Función para calcular y renderizar los más vendidos ===
async function renderMasVendidos() {
  const grid = document.getElementById('destGrid');
  try {
    const { data: ventas, error: ventasError } = await supabase.from('ventas').select('productos');

    if (ventasError) throw ventasError;

    const contador = new Map();

    // Recorre todas las ventas y acumula las cantidades por nombre de producto
    ventas?.forEach(v => {
      (v.productos || []).forEach(item => {
        const nombre = item.nombre || "Sin nombre";
        const cantidad = (contador.get(nombre) || 0) + (item.qty || 1);
        contador.set(nombre, cantidad);
      });
    });

    // Carga todos los productos del catálogo
    const productos = await fetchAll('productos_web');

    // Asocia las ventas acumuladas con los productos
    const productosOrdenados = productos
      .map(p => ({
        ...p,
        ventas: contador.get(p.nombre) || 0
      }))
      .sort((a, b) => b.ventas - a.ventas) // orden descendente
      .slice(0, 6);

    if (!productosOrdenados.length) {
      grid.innerHTML = "<p class='muted'>No hay productos para mostrar.</p>";
      showToast("⚠️ No hay productos disponibles todavía", "info");
      return;
    }

    grid.innerHTML = productosOrdenados.map(p => `
      <article class="card fadeIn">
        <img src="${p.imagen_url}" alt="${p.nombre}">
        <div class="body">
          <div class="title">${p.nombre}</div>
          <div class="muted">${p.descripcion || ''}</div>
          <div class="price">${formatMoney(p.precio)}</div>
          <div class="badge">${p.ventas} ${p.ventas === 1 ? 'venta' : 'ventas'}</div>
        </div>
      </article>
    `).join('');

    showToast("✅ Productos más vendidos actualizados", "success");
  } catch (e) {
    console.error("Error al cargar los productos más vendidos:", e);
    showToast("❌ Error al cargar productos más vendidos", "error");
  }
}

// === 🔔 Escucha en tiempo real los cambios en la tabla 'ventas' ===
function suscribirVentasRealtime() {
  const canal = supabase
    .channel('ventas-realtime')
    .on(
      'postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'ventas' },
      async payload => {
        console.log("🆕 Nueva venta detectada:", payload.new);
        showToast("🆕 Nueva venta registrada, actualizando ranking...", "info");
        await renderMasVendidos(); // Recarga los más vendidos
      }
    )
    .subscribe();

  console.log("👂 Suscripción Realtime a 'ventas' activa");
}

// === 🧩 Carga inicial de toda la página ===
async function loadHome() {
  await mountChrome();

  // 🦐 Render inicial de los más vendidos
  await renderMasVendidos();

  // 🔄 Suscripción para actualización en tiempo real
  suscribirVentasRealtime();

  // === 🎁 Promociones ===
  try {
    const promos = await fetchAll('promociones', '*', { order: { col: 'created_at', asc: false } });
    const grid = document.getElementById('promoGrid');

    if (!promos.length) {
      grid.innerHTML = "<p class='muted'>No hay promociones vigentes.</p>";
      showToast("ℹ️ No hay promociones disponibles en este momento", "info");
      return;
    }

    grid.innerHTML = promos.slice(0, 3).map(p => `
      <article class="card">
        ${p.foto_url ? `<img src="${p.foto_url}" alt="${p.nombre}">` : ''}
        <div class="body">
          <div class="title">${p.nombre}</div>
          <div class="price">${formatMoney(p.precio)}</div>
          ${p.fecha_vigencia ? `<div class="badge">Vigente hasta ${p.fecha_vigencia}</div>` : ''}
        </div>
      </article>
    `).join('');
  } catch (e) {
    console.error("Error cargando promociones:", e);
    showToast("❌ Error al cargar promociones", "error");
  }

  // === ⭐ Testimonios ===
  try {
    const testis = await fetchAll('testimonios', '*', { order: { col: 'created_at', asc: false } });
    const grid = document.getElementById('testiGrid');

    if (!testis.length) {
      grid.innerHTML = "<p class='muted'>No hay testimonios disponibles.</p>";
      showToast("⚠️ Aún no hay testimonios registrados", "info");
      return;
    }

    grid.innerHTML = testis.slice(0, 4).map(t => `
      <article class="card">
        <div class="body">
          <div class="title">
            ${'★'.repeat(Math.max(1, Math.min(5, t.estrellas || 5)))} 
            <span class="muted">${t.nombre}</span>
          </div>
          <div>${t.opinion || ''}</div>
        </div>
      </article>
    `).join('');
  } catch (e) {
    console.error("Error cargando testimonios:", e);
    showToast("❌ Error al cargar testimonios", "error");
  }
}

loadHome();

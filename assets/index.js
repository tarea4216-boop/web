// assets/index.js
import { fetchAll, supabase } from './supabaseClient.js';
import { mountChrome, formatMoney } from './ui.js';
import Swiper from 'https://cdn.jsdelivr.net/npm/swiper@11/swiper-bundle.min.mjs';

// === 🔁 Función para calcular y renderizar los más vendidos ===
async function renderMasVendidos() {
  const grid = document.getElementById('destGrid');
  try {
    grid.innerHTML = "<p class='muted'>Cargando productos destacados...</p>";

    // 1️⃣ Traer todas las ventas registradas
    const { data: ventas, error: ventasError } = await supabase
      .from('ventas')
      .select('productos');

    if (ventasError) throw ventasError;

    // 2️⃣ Crear un mapa de conteo por ID o nombre del producto
    const contador = new Map();
    ventas?.forEach(v => {
      (v.productos || []).forEach(item => {
        const clave = item.id || item.nombre || "Desconocido";
        const cantidad = (contador.get(clave) || 0) + (item.qty || 1);
        contador.set(clave, cantidad);
      });
    });

    // 3️⃣ Cargar todos los productos del catálogo
    const productos = await fetchAll('productos_web');

    // 4️⃣ Vincular ventas acumuladas con productos
    const productosOrdenados = productos
      .map(p => ({
        ...p,
        ventas: contador.get(p.id) || contador.get(p.nombre) || 0
      }))
      .sort((a, b) => b.ventas - a.ventas)
      .slice(0, 6);

    // 5️⃣ Renderizado dinámico
    if (!productosOrdenados.length) {
      grid.innerHTML = "<p class='muted'>No hay productos disponibles.</p>";
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

    console.log("✅ Productos destacados actualizados:", productosOrdenados);
  } catch (e) {
    console.error("❌ Error al cargar los productos más vendidos:", e);
    showToast("❌ Error al cargar productos destacados", "error");
  }
}

// === 🔔 SUSCRIPCIÓN EN TIEMPO REAL (corrigida) ===
function suscribirVentasRealtime() {
  const canal = supabase
    .channel('ventas-realtime')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'ventas' }, async payload => {
      console.log("🆕 Cambio detectado en 'ventas':", payload);
      showToast("🔄 Actualizando productos más vendidos...", "info");
      await renderMasVendidos();
    })
    .subscribe();

  console.log("👂 Suscripción en tiempo real a 'ventas' activa");
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

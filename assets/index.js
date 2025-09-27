// assets/index.js
import { fetchAll } from './supabaseClient.js';
import { mountChrome, formatMoney } from './ui.js';
import Swiper from 'https://cdn.jsdelivr.net/npm/swiper@11/swiper-bundle.min.mjs';

async function loadHome() {
  await mountChrome();

  // Productos destacados (carrusel con Swiper)
  try {
    const productos = await fetchAll('productos_web', '*', { order: { col: 'created_at', asc: false } });
    const grid = document.getElementById('destGrid');
    grid.innerHTML = productos.slice(0, 6).map(p => `
      <div class="swiper-slide">
        <article class="card">
          <img src="${p.imagen_url}" alt="${p.nombre}">
          <div class="body">
            <div class="title">${p.nombre}</div>
            <div class="muted">${p.descripcion || ''}</div>
            <div class="price">${formatMoney(p.precio)}</div>
          </div>
        </article>
      </div>
    `).join('');

    new Swiper(".destSwiper", {
      slidesPerView: 1,
      spaceBetween: 20,
      loop: true,
      navigation: {
        nextEl: ".dest-next",
        prevEl: ".dest-prev",
      },
      pagination: {
        el: ".dest-pagination",
        clickable: true,
      },
      breakpoints: {
        768: { slidesPerView: 2 },
        1024: { slidesPerView: 3 },
      }
    });
  } catch (e) { console.error(e); }

  // Promos (carrusel de 3)
  try {
    const promos = await fetchAll('promociones', '*', { order: { col: 'created_at', asc: false } });
    const grid = document.getElementById('promoGrid');
    grid.innerHTML = promos.slice(0, 3).map(p => `
      <div class="swiper-slide">
        <article class="card">
          ${p.foto_url ? `<img src="${p.foto_url}" alt="${p.nombre}">` : ''}
          <div class="body">
            <div class="title">${p.nombre}</div>
            <div class="price">${formatMoney(p.precio)}</div>
            ${p.fecha_vigencia ? `<div class="badge">Vigente hasta ${p.fecha_vigencia}</div>` : ''}
          </div>
        </article>
      </div>
    `).join('');

    new Swiper(".promoSwiper", {
      slidesPerView: 1,
      spaceBetween: 20,
      loop: true,
      navigation: {
        nextEl: ".promo-next",
        prevEl: ".promo-prev",
      },
      pagination: {
        el: ".promo-pagination",
        clickable: true,
      },
      breakpoints: {
        768: { slidesPerView: 2 },
        1024: { slidesPerView: 3 },
      }
    });
  } catch (e) { console.error(e); }

  // Testimonios (auto-play)
  try {
    const testis = await fetchAll('testimonios', '*', { order: { col: 'created_at', asc: false } });
    const grid = document.getElementById('testiGrid');
    grid.innerHTML = testis.slice(0, 4).map(t => `
      <div class="swiper-slide">
        <article class="card">
          <div class="body">
            <div class="title">${'★'.repeat(Math.max(1, Math.min(5, t.estrellas || 5)))} <span class="muted">${t.nombre}</span></div>
            <div>${t.opinion || ''}</div>
          </div>
        </article>
      </div>
    `).join('');

    new Swiper(".testiSwiper", {
      slidesPerView: 1,
      spaceBetween: 20,
      autoplay: {
        delay: 4000,
        disableOnInteraction: false,
      },
      loop: true,
      pagination: {
        el: ".testi-pagination",
        clickable: true,
      },
      breakpoints: {
        768: { slidesPerView: 2 },
        1024: { slidesPerView: 3 },
      }
    });
  } catch (e) { console.error(e); }
}

loadHome();

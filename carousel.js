(function () {
  function initCarousel(container) {
    if (!container) return;
    const track = container.querySelector('.carousel-track');
    if (!track) return;
    const items = Array.from(track.children);
    if (!items.length) return;

    const prevBtn = container.querySelector('.carousel-btn.prev');
    const nextBtn = container.querySelector('.carousel-btn.next');

    let index = 0;
    const gap = parseInt(getComputedStyle(track).gap) || 0;

    function visibleCount() {
      const w = container.offsetWidth;
      const iw = items[0].offsetWidth + gap;
      return Math.max(1, Math.floor(w / iw));
    }

    function itemWidth() {
      return items[0].offsetWidth + gap;
    }

    function updateCarousel() {
      const v = visibleCount();
      index = Math.max(0, Math.min(index, Math.max(0, items.length - v)));
      const offset = index * itemWidth();
      track.style.transform = `translateX(-${offset}px)`;
      items.forEach((it, i) => {
        it.classList.toggle('active', i >= index && i < index + v);
      });
    }

    prevBtn && prevBtn.addEventListener('click', () => {
      index = Math.max(index - visibleCount(), 0);
      updateCarousel();
    });

    nextBtn && nextBtn.addEventListener('click', () => {
      index = Math.min(index + visibleCount(), Math.max(0, items.length - visibleCount()));
      updateCarousel();
    });

    window.addEventListener('resize', () => {
      updateCarousel();
    });

    updateCarousel();
  }

  // Exponer la función global
  window.initCarousel = initCarousel;
})();

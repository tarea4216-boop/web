(function () {
  function initCarousel(container) {
    if (!container) return;
    const track = container.querySelector('.carousel-track');
    if (!track) return;

    // helpers
    const gap = () => parseInt(getComputedStyle(track).gap) || 0;
    const easing = 'cubic-bezier(0.25, 0.8, 0.5, 1)';

    function cleanClones() {
      Array.from(track.children).forEach(ch => {
        if (ch.dataset && ch.dataset.clone === 'true') ch.remove();
      });
    }

    function childrenArray() {
      return Array.from(track.querySelectorAll('.carousel-item'));
    }

    function visibleCount() {
      const w = container.offsetWidth;
      const it = childrenArray().find(it => it.dataset.clone !== 'true');
      if (!it) return 1;
      const iw = it.offsetWidth + gap();
      return Math.max(1, Math.floor(w / iw));
    }

    function itemWidth() {
      const it = childrenArray().find(it => it.dataset.clone !== 'true');
      return (it ? it.offsetWidth : 0) + gap();
    }

    function countLeadingClones() {
      const children = Array.from(track.children);
      let cnt = 0;
      for (let i = 0; i < children.length; i++) {
        if (children[i].dataset && children[i].dataset.clone === 'true') cnt++;
        else break;
      }
      return cnt;
    }

    function createClones(n) {
      cleanClones();
      const items = Array.from(track.querySelectorAll('.carousel-item'));
      const realItems = items.filter(it => it.dataset.clone !== 'true');

      // Solo clonar si hay más reales que visibles
      if (realItems.length <= n) return;

      const cloneCount = Math.min(Math.max(1, n), realItems.length);

      const first = realItems.slice(0, cloneCount);
      const last = realItems.slice(realItems.length - cloneCount);

      last.forEach(node => {
        const c = node.cloneNode(true);
        c.dataset.clone = 'true';
        track.insertBefore(c, track.firstChild);
      });

      first.forEach(node => {
        const c = node.cloneNode(true);
        c.dataset.clone = 'true';
        track.appendChild(c);
      });
    }

    // state
    let index = 0;
    let animating = false;
    let resizeTimeout = null;

    const prevBtn = container.querySelector('.carousel-btn.prev');
    const nextBtn = container.querySelector('.carousel-btn.next');

    function setTransition(enabled) {
      track.style.transition = enabled ? `transform 0.6s ${easing}` : 'none';
    }

    function goToIndex(i) {
      track.style.transform = `translateX(-${i * itemWidth()}px)`;
    }

    function updateCarouselInitial() {
      const v = visibleCount();
      createClones(v);

      const items = childrenArray();
      const prefix = countLeadingClones();
      const realItems = items.filter(it => it.dataset.clone !== 'true');
      const disableNav = realItems.length <= v;

      index = prefix;

      // Ocultar botones si no hay navegación posible
      if (prevBtn) prevBtn.style.display = disableNav ? 'none' : '';
      if (nextBtn) nextBtn.style.display = disableNav ? 'none' : '';

      setTransition(false);
      goToIndex(index);
      requestAnimationFrame(() => requestAnimationFrame(() => setTransition(true)));
    }

    function updateCarouselBounds() {
      const items = childrenArray();
      const v = visibleCount();
      const prefix = countLeadingClones();

      index = Math.max(index, prefix);
      index = Math.min(index, items.length - v - 1);
      goToIndex(index);
    }

    function prev() {
      if (animating) return;
      animating = true;
      index = Math.max(0, index - 1);
      goToIndex(index);
    }

    function next() {
      if (animating) return;
      animating = true;
      index = Math.min(childrenArray().length - 1, index + 1);
      goToIndex(index);
    }

    if (prevBtn) prevBtn.addEventListener("click", () => prev());
    if (nextBtn) nextBtn.addEventListener("click", () => next());

    // Mouse wheel navigation
    container.addEventListener("wheel", (e) => {
      const realItems = childrenArray().filter(it => it.dataset.clone !== 'true');
      if (realItems.length <= visibleCount()) return;

      if (window.innerWidth >= 768) {
        e.preventDefault();
        e.deltaY > 0 ? next() : prev();
      }
    }, { passive: false });

    // Touch navigation
    let startX = 0;
    container.addEventListener("touchstart", (e) => {
      startX = e.touches[0].clientX;
    }, { passive: true });

    container.addEventListener("touchend", (e) => {
      const realItems = childrenArray().filter(it => it.dataset.clone !== 'true');
      if (realItems.length <= visibleCount()) return;

      const diff = e.changedTouches[0].clientX - startX;
      if (Math.abs(diff) > 50) {
        diff < 0 ? next() : prev();
      }
    }, { passive: true });

    // Handle infinite jump for clones
    track.addEventListener('transitionend', () => {
      animating = false;
      const items = childrenArray();
      const v = visibleCount();
      const prefix = countLeadingClones();

      if (index >= items.length - v) {
        setTransition(false);
        index = prefix;
        goToIndex(index);
        requestAnimationFrame(() => requestAnimationFrame(() => setTransition(true)));
      } else if (index < prefix) {
        setTransition(false);
        index = items.length - (2 * prefix);
        if (index < prefix) index = prefix;
        goToIndex(index);
        requestAnimationFrame(() => requestAnimationFrame(() => setTransition(true)));
      }
    });

    // Resize observer
    window.addEventListener('resize', () => {
      clearTimeout(resizeTimeout);
      resizeTimeout = setTimeout(() => {
        updateCarouselInitial();
      }, 120);
    });

    // Initialize carousel
    setTimeout(() => {
      updateCarouselInitial();
    }, 80);
  }

  window.initCarousel = initCarousel;
})();

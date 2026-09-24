(function () {

  function initCarousel(container) {

    if (!container) return;

    const track = container.querySelector('.carousel-track');

    if (!track) return;

    // helpers
    const gap = () => parseInt(getComputedStyle(track).gap) || 0;

    // Solo se hace un poco más fluido
    const easing = 'cubic-bezier(0.22, 0.61, 0.36, 1)';

    function cleanClones() {

      Array.from(track.children).forEach(ch => {

        if (ch.dataset && ch.dataset.clone === 'true') {
          ch.remove();
        }

      });

    }

    function childrenArray() {

      return Array.from(
        track.querySelectorAll('.carousel-item')
      );

    }

    function visibleCount() {

      const w = container.offsetWidth;

      const it = childrenArray().find(
        it => it.dataset.clone !== 'true'
      );

      if (!it) return 1;

      const iw = it.offsetWidth + gap();

      return Math.max(
        1,
        Math.floor(w / iw)
      );

    }

    function itemWidth() {

      const it = childrenArray().find(
        it => it.dataset.clone !== 'true'
      );

      return (it ? it.offsetWidth : 0) + gap();

    }

    function countLeadingClones() {

      const children = Array.from(track.children);

      let cnt = 0;

      for (let i = 0; i < children.length; i++) {

        if (
          children[i].dataset &&
          children[i].dataset.clone === 'true'
        ) {
          cnt++;
        } else {
          break;
        }

      }

      return cnt;

    }

    function createClones(n) {

      cleanClones();

      const items = Array.from(
        track.querySelectorAll('.carousel-item')
      );

      const realItems = items.filter(
        it => it.dataset.clone !== 'true'
      );

      // Solo clonar si hay más reales que visibles
      if (realItems.length <= n) return;

      const cloneCount = Math.min(
        Math.max(1, n),
        realItems.length
      );

      const first = realItems.slice(
        0,
        cloneCount
      );

      const last = realItems.slice(
        realItems.length - cloneCount
      );

      last.forEach(node => {

        const c = node.cloneNode(true);

        c.dataset.clone = 'true';

        track.insertBefore(
          c,
          track.firstChild
        );

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

    // Evita reinicios innecesarios en móviles
    let lastCarouselWidth = container.offsetWidth;

    const prevBtn = container.querySelector(
      '.carousel-btn.prev'
    );

    const nextBtn = container.querySelector(
      '.carousel-btn.next'
    );

    function setTransition(enabled) {

      track.style.transition = enabled
        ? `transform 0.42s ${easing}`
        : 'none';

    }

    function goToIndex(i) {

      track.style.transform =
        `translateX(-${i * itemWidth()}px)`;

    }

    function updateCarouselInitial() {

      const v = visibleCount();

      createClones(v);

      const items = childrenArray();

      const prefix = countLeadingClones();

      const realItems = items.filter(
        it => it.dataset.clone !== 'true'
      );

      const disableNav =
        realItems.length <= v;

      index = prefix;

      // Ocultar botones si no hay navegación posible
      if (prevBtn) {
        prevBtn.style.display =
          disableNav ? 'none' : '';
      }

      if (nextBtn) {
        nextBtn.style.display =
          disableNav ? 'none' : '';
      }

      setTransition(false);

      goToIndex(index);

      requestAnimationFrame(() =>
        requestAnimationFrame(() =>
          setTransition(true)
        )
      );

    }

    function updateCarouselBounds() {

      const items = childrenArray();

      const v = visibleCount();

      const prefix = countLeadingClones();

      index = Math.max(
        index,
        prefix
      );

      index = Math.min(
        index,
        items.length - v - 1
      );

      goToIndex(index);

    }

    function prev() {

      if (animating) return;

      animating = true;

      index = Math.max(
        0,
        index - 1
      );

      goToIndex(index);

    }

    function next() {

      if (animating) return;

      animating = true;

      index = Math.min(
        childrenArray().length - 1,
        index + 1
      );

      goToIndex(index);

    }

    if (prevBtn) {
      prevBtn.addEventListener(
        "click",
        () => prev()
      );
    }

    if (nextBtn) {
      nextBtn.addEventListener(
        "click",
        () => next()
      );
    }

    // Mouse wheel navigation
container.addEventListener(
  "wheel",
  (e) => {

    const realItems =
      childrenArray().filter(
        it => it.dataset.clone !== 'true'
      );

    if (
      realItems.length <= visibleCount()
    ) return;

    if (
      window.matchMedia('(pointer: fine)').matches
    ) {

      e.preventDefault();

      e.deltaY > 0
        ? next()
        : prev();

    }

  },
  {
    passive: false
  }
);

    // =========================================================
    // TOUCH NAVIGATION
    // =========================================================

    let startX = 0;

    container.addEventListener(
      "touchstart",
      (e) => {

        startX = e.touches[0].clientX;

      },
      {
        passive: true
      }
    );

    container.addEventListener(
      "touchend",
      (e) => {

        const realItems =
          childrenArray().filter(
            it => it.dataset.clone !== 'true'
          );

        if (
          realItems.length <= visibleCount()
        ) return;

        const diff =
          e.changedTouches[0].clientX - startX;

        const distance =
          Math.abs(diff);

        // Mantiene el mínimo original de 50px
        if (distance <= 50) return;

        // No iniciar otro movimiento mientras
        // el anterior todavía está animándose
        if (animating) return;

        const width = itemWidth();

        if (!width) return;

        /*
         * El número de productos depende de
         * la distancia del deslizamiento.
         *
         * Deslizamiento corto -> 1 producto
         * Deslizamiento medio -> 2 productos
         * Deslizamiento fuerte -> varios productos
         */
        let steps = Math.round(
          distance / (width * 0.65)
        );

        steps = Math.max(
          1,
          steps
        );

        /*
         * No permitimos que un solo swipe
         * avance más productos que los visibles.
         * Esto mantiene intacta la lógica de clones.
         */
        steps = Math.min(
          steps,
          Math.max(1, visibleCount())
        );

        animating = true;

        if (diff < 0) {

          // Deslizar hacia la izquierda
          index += steps;

        } else {

          // Deslizar hacia la derecha
          index -= steps;

        }

        const maxIndex =
          childrenArray().length - 1;

        index = Math.max(
          0,
          Math.min(
            index,
            maxIndex
          )
        );

        goToIndex(index);

      },
      {
        passive: true
      }
    );

    // =========================================================
    // HANDLE INFINITE JUMP FOR CLONES
    // =========================================================

    track.addEventListener(
      'transitionend',
      () => {

        animating = false;

        const items =
          childrenArray();

        const v =
          visibleCount();

        const prefix =
          countLeadingClones();

        if (
          index >= items.length - v
        ) {

          setTransition(false);

          index = prefix;

          goToIndex(index);

          requestAnimationFrame(() =>
            requestAnimationFrame(() =>
              setTransition(true)
            )
          );

        } else if (
          index < prefix
        ) {

          setTransition(false);

          index =
            items.length - (2 * prefix);

          if (index < prefix) {
            index = prefix;
          }

          goToIndex(index);

          requestAnimationFrame(() =>
            requestAnimationFrame(() =>
              setTransition(true)
            )
          );

        }

      }
    );

    // =========================================================
    // RESIZE
    // =========================================================

    window.addEventListener(
      'resize',
      () => {

        clearTimeout(resizeTimeout);

        resizeTimeout = setTimeout(
          () => {

            const currentWidth =
              container.offsetWidth;

            /*
             * Si el ancho real del carrusel no cambió,
             * no hacemos nada.
             *
             * Esto evita que en móvil el navegador
             * reinicie el carrusel al cambiar su
             * barra superior/inferior.
             */
            if (
              Math.abs(
                currentWidth - lastCarouselWidth
              ) < 2
            ) {
              return;
            }

            lastCarouselWidth =
              currentWidth;

            updateCarouselInitial();

          },
          120
        );

      }
    );

    // Initialize carousel
    setTimeout(
      () => {

        lastCarouselWidth =
          container.offsetWidth;

        updateCarouselInitial();

      },
      80
    );

  }

  window.initCarousel = initCarousel;

})();

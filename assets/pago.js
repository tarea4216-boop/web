<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Inicio | El Camarón de Oro</title>

  <!-- Estilos principales -->
  <link rel="stylesheet" href="assets/styles.css" />
  <link rel="stylesheet" href="assets/index.css" />

  <!-- Swiper CSS -->
  <link rel="stylesheet"
        href="https://cdn.jsdelivr.net/npm/swiper@11/swiper-bundle.min.css" />

  <!-- Tipografía -->
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700;800&display=swap" rel="stylesheet" />

  <!-- Sistema de notificaciones -->
  <link rel="stylesheet" href="assets/toast/toast.css" />
</head>

<body class="preload">
  <!-- ENCABEZADO GLASS -->
  <header class="header glass-header">
    <div class="container nav-container">
      <div class="brand">
        <img src="https://i.ibb.co/dKnPMDb/camaron-logo.png" alt="Logo El Camarón de Oro" />
        <div>
          <h3>El Camarón de Oro</h3>
          <small>Gastronomía campestre</small>
        </div>
      </div>
      <nav class="nav-links">
        <a href="index.html" class="active">Inicio</a>
        <a href="menu.html">Menú</a>
        <a href="promos.html">Promociones</a>
        <a href="contacto.html">Contacto</a>
      </nav>
    </div>
  </header>

  <!-- HERO PRINCIPAL -->
  <section class="hero">
    <div class="hero-overlay"></div>
    <div class="hero-content container">
      <div class="hero-text">
        <h1>Sabores que conquistan, tradición que perdura</h1>
        <p>
          En <strong>El Camarón de Oro</strong> fusionamos lo mejor de la gastronomía campestre con 15 años de experiencia culinaria.
        </p>
        <div class="hero-buttons">
          <a class="btn primary large" href="menu.html">Ver Menú</a>
          <a class="btn ghost large" href="promos.html">Ver Promociones</a>
        </div>
      </div>
      <div class="hero-image">
        <img src="https://images.unsplash.com/photo-1603133872878-684f208fb84b?q=80&w=1200&auto=format&fit=crop"
             alt="Plato gourmet de camarones" />
      </div>
    </div>
  </section>

  <!-- CONTENIDO PRINCIPAL -->
  <main class="container">
    <!-- 🦐 Productos destacados -->
    <section class="section" id="destacados">
      <h2>Platos destacados</h2>
      <div class="grid cols-3" id="destGrid"></div>
    </section>

    <!-- 🎁 Promociones -->
    <section class="section" id="promos">
      <h2>Promociones</h2>
      <div class="grid cols-3" id="promoGrid"></div>
    </section>

    <!-- ⭐ Testimonios -->
    <section class="section" id="testimonios">
      <h2>Testimonios</h2>
      <div class="grid cols-2" id="testiGrid"></div>
    </section>
  </main>

  <!-- PIE DE PÁGINA -->
  <footer class="footer">
    <p>© 2025 El Camarón de Oro. Todos los derechos reservados.</p>
  </footer>

  <!-- CONTENEDOR DE NOTIFICACIONES -->
  <div id="toastContainer" class="toast-container"></div>

  <!-- LIBRERÍAS -->
  <script src="https://cdn.jsdelivr.net/npm/swiper@11/swiper-bundle.min.js" defer></script>
  <script src="https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js" defer></script>
  <script src="assets/toast/toast.js" defer></script>

  <!-- SCRIPT PRINCIPAL (Módulo) -->
  <script type="module" src="assets/index.js"></script>

  <!-- ANIMACIONES Y CABECERA -->
  <script>
    window.addEventListener("load", () => {
      document.body.classList.remove("preload");
      document.body.classList.add("loaded");
    });

    window.addEventListener("scroll", () => {
      const header = document.querySelector(".glass-header");
      if (window.scrollY > 60) header.classList.add("shrink");
      else header.classList.remove("shrink");
    });
  </script>
</body>
</html>

(async function () {
  const STORAGE_KEY = 'camaron_cart_v1';
  const cart = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
  const summary = document.getElementById('cart-summary');
  const qrContainer = document.getElementById('qr');
  const coverageMsg = document.getElementById('coverage-msg');

  if (!cart.length) {
    summary.innerHTML = '<p>Tu carrito está vacío.</p>';
    return;
  }

  // === Mostrar resumen del pedido ===
  let total = 0;
  const ul = document.createElement('ul');
  ul.style.listStyle = 'disc';
  ul.style.paddingLeft = '1.5rem';

  cart.forEach(it => {
    const li = document.createElement('li');
    li.textContent = `${it.nombre} x${it.qty} — S/ ${(it.precio * it.qty).toFixed(2)}`;
    ul.appendChild(li);
    total += it.precio * it.qty;
  });

  summary.appendChild(ul);
  summary.innerHTML += `<p><b>Total:</b> S/ ${total.toFixed(2)}</p>`;
  qrContainer.innerHTML = `<p style="color:#555;font-size:0.9rem;">📍 Selecciona tu ubicación en el mapa para continuar con el pago.</p>`;

  // === Configuración del mapa ===
  const restaurantLatLng = L.latLng(-12.525472, -76.557917);
  const coverageRadiusMeters = 5000;
  const map = L.map('map').setView([restaurantLatLng.lat, restaurantLatLng.lng], 15);
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '&copy; OpenStreetMap contributors'
  }).addTo(map);

  L.circle(restaurantLatLng, { radius: coverageRadiusMeters, color: '#2a9d8f', fill: false }).addTo(map);
  L.marker(restaurantLatLng).addTo(map).bindPopup('📍 Restaurante El Camarón de Oro').openPopup();

  let marker = null;
  let currentUser = null;
  let selectedLatLng = null;

  function checkCoverage(latlng) {
    return latlng.distanceTo(restaurantLatLng) <= coverageRadiusMeters;
  }

  // === Sesión anónima y rol "cliente" ===
  try {
    const cred = await firebase.auth().signInAnonymously();
    currentUser = cred.user;
    const roleRef = firebase.database().ref('roles/' + currentUser.uid);
    const snapshot = await roleRef.get();
    if (!snapshot.exists()) {
      await roleRef.set('cliente');
      console.log('✅ Rol "cliente" asignado automáticamente a', currentUser.uid);
    }
  } catch (err) {
    console.error("Error Firebase:", err);
    alert("Error al conectarse a Firebase. Reintenta más tarde.");
    return;
  }

  // === Click en el mapa ===
  map.on('click', function (e) {
    if (marker) map.removeLayer(marker);
    marker = L.marker(e.latlng).addTo(map);
    selectedLatLng = e.latlng;

    if (!checkCoverage(selectedLatLng)) {
      coverageMsg.textContent = '⚠️ Fuera de cobertura.';
      qrContainer.innerHTML = `<p style="color:#c00;">⚠️ Estás fuera del área de entrega.</p>`;
      return;
    }

    coverageMsg.textContent = '✅ Dentro de cobertura. Puedes proceder al pago.';

    // Mostrar QR e información del pedido
    qrContainer.innerHTML = `
      <h4>Resumen de tu pedido</h4>
      <p><b>ID Pedido:</b> ${currentUser.uid}</p>
      <p><b>Total:</b> S/ ${total.toFixed(2)}</p>
      <p>Escanea este código QR con Yape o BCP para realizar el pago.</p>
      <img src="yape.png" alt="QR de Yape" style="max-width:220px;margin-top:10px;">
      <p style="color:#555;font-size:0.9rem;margin-top:5px;">
        Luego sube la captura del comprobante para verificarlo automáticamente.
      </p>
    `;

    // Guardar datos para pago_verificar.js
    qrContainer.dataset.total = total;
    qrContainer.dataset.cart = JSON.stringify(cart);
    qrContainer.dataset.lat = selectedLatLng.lat;
    qrContainer.dataset.lng = selectedLatLng.lng;
    qrContainer.dataset.uid = currentUser.uid;

    // Cargar verificador OCR dinámicamente
    const script = document.createElement('script');
    script.src = 'assets/pago_verificar.js';
    document.body.appendChild(script);

    // Limpiar carrito local
    localStorage.removeItem(STORAGE_KEY);
  });
})();

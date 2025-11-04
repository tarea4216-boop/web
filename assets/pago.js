(async function () {
  const STORAGE_KEY = 'camaron_cart_v1';
  const cart = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
  const summary = document.getElementById('cart-summary');
  const qrContainer = document.getElementById('qr');
  const coverageMsg = document.getElementById('coverage-msg');

  if (!cart.length) {
    summary.innerHTML = '<p>Tu carrito está vacío.</p>';
    showToast("⚠️ Tu carrito está vacío", "error");
    return;
  }

  // === Mostrar resumen del pedido con campo de comentario ===
  let total = 0;
  const ul = document.createElement('ul');
  ul.style.listStyle = 'none';
  ul.style.paddingLeft = '0';

  cart.forEach((it, index) => {
    const li = document.createElement('li');
    li.style.marginBottom = '1rem';
    li.innerHTML = `
      <p><b>${it.nombre}</b> x${it.qty} — S/ ${(it.precio * it.qty).toFixed(2)}</p>
      <textarea id="comentario-${index}" placeholder="Comentario adicional (opcional)" rows="1" style="width:100%;resize:none;border-radius:6px;padding:5px;"></textarea>
    `;
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
  let pagoConfirmado = false;

  function checkCoverage(latlng) {
    return latlng.distanceTo(restaurantLatLng) <= coverageRadiusMeters;
  }

  // === Sesión anónima ===
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
    showToast("❌ Error al conectarse a Firebase. Reintenta más tarde.", "error");
    return;
  }

  // === Click en el mapa ===
map.on('click', function (e) {
  if (pagoConfirmado) {
    showToast("✅ El pago ya fue confirmado. No puedes cambiar la ubicación.", "info");
    return;
  }

  if (marker) map.removeLayer(marker);
  marker = L.marker(e.latlng).addTo(map);
  selectedLatLng = e.latlng;

  if (!checkCoverage(selectedLatLng)) {
    coverageMsg.textContent = '⚠️ Fuera de cobertura.';
    qrContainer.innerHTML = `<p style="color:#c00;">⚠️ Estás fuera del área de entrega.</p>`;
    showToast("⚠️ Estás fuera del área de entrega.", "error");
    return;
  }

  coverageMsg.textContent = '✅ Dentro de cobertura. Completa tus datos para continuar.';
  showToast("✅ Ubicación dentro del área de entrega", "success");

  // === Formulario de datos personales ===
  qrContainer.innerHTML = `
    <h4>Datos para la entrega</h4>
    <div style="display:flex;flex-direction:column;gap:10px;max-width:400px;">
      <input type="text" id="cliente-nombre" placeholder="👤 Nombre completo" style="padding:10px;border-radius:6px;border:1px solid #ccc;">
      <input type="tel" id="cliente-celular" placeholder="📱 Número de celular" maxlength="9" style="padding:10px;border-radius:6px;border:1px solid #ccc;">
      <textarea id="cliente-referencia" placeholder="🏠 Referencias del lugar (ej. casa verde frente al parque)" rows="2" style="padding:10px;border-radius:6px;border:1px solid #ccc;"></textarea>
      <button id="continuar-pago" class="btn primary">Continuar al pago</button>
    </div>
  `;

  // Guardar ubicación
  qrContainer.dataset.lat = selectedLatLng.lat;
  qrContainer.dataset.lng = selectedLatLng.lng;
  qrContainer.dataset.total = total;
  qrContainer.dataset.uid = currentUser.uid;

  // Botón continuar
  document.getElementById('continuar-pago').addEventListener('click', () => {
    const nombre = document.getElementById('cliente-nombre').value.trim();
    const celular = document.getElementById('cliente-celular').value.trim();
    const referencia = document.getElementById('cliente-referencia').value.trim();

    if (!nombre || !celular) {
      showToast("⚠️ Ingresa tu nombre y número de celular.", "error");
      return;
    }
    if (celular.length < 9 || !/^[0-9]+$/.test(celular)) {
      showToast("⚠️ El número de celular no es válido.", "error");
      return;
    }

    // Actualizar dataset con los datos del cliente
    qrContainer.dataset.nombre = nombre;
    qrContainer.dataset.celular = celular;
    qrContainer.dataset.referencia = referencia;

    // Actualizar comentarios de los productos
    const cartWithComments = cart.map((it, index) => {
      const textarea = document.getElementById(`comentario-${index}`);
      return { ...it, comentario: textarea?.value?.trim() || "" };
    });
    qrContainer.dataset.cart = JSON.stringify(cartWithComments);

    // === Mostrar QR de pago ===
    qrContainer.innerHTML = `
      <h4>Resumen de tu pedido</h4>
      <p><b>Cliente:</b> ${nombre}</p>
      <p><b>Celular:</b> ${celular}</p>
      <p><b>Total:</b> S/ ${total.toFixed(2)}</p>
      <p>Escanea este código QR con Yape o BCP para realizar el pago.</p>
      <img src="yape.png" alt="QR de Yape" style="max-width:220px;margin-top:10px;">
      <p style="color:#555;font-size:0.9rem;margin-top:5px;">
        Luego sube la captura del comprobante para verificarlo automáticamente.
      </p>
    `;

    if (!document.getElementById("verificadorScript")) {
      const script = document.createElement('script');
      script.id = "verificadorScript";
      script.type = "module";
      script.src = 'assets/pago_verificar.js';
      script.onload = () => console.log("✅ pago_verificar.js cargado correctamente");
      document.body.appendChild(script);
    } else {
      if (window.initPagoVerificar) window.initPagoVerificar();
    }

    localStorage.removeItem(STORAGE_KEY);
  });
});


  if (window.opener && window.opener.cart) {
    window.opener.cart.clear?.();
  }

  window.bloquearMapaPago = function () {
    pagoConfirmado = true;
    map.dragging.disable();
    map.touchZoom.disable();
    map.doubleClickZoom.disable();
    map.scrollWheelZoom.disable();
    map.boxZoom.disable();
    map.keyboard.disable();
  };
})();

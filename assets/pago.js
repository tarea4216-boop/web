(async function() {
  const STORAGE_KEY = 'camaron_cart_v1';
  const cart = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
  const summary = document.getElementById('cart-summary');
  const qrContainer = document.getElementById('qr');
  const coverageMsg = document.getElementById('coverage-msg');

  // === Si el carrito está vacío ===
  if (!cart.length) {
    summary.innerHTML = '<p>Tu carrito está vacío.</p>';
    return;
  }

  // === Mostrar resumen del pedido (sin QR aún) ===
  let total = 0;
  const ul = document.createElement('ul');
  ul.style.listStyle = 'disc';
  ul.style.paddingLeft = '1.5rem';

  cart.forEach(it => {
    const li = document.createElement('li');
    const name = it.nombre || it.name;
    const price = it.precio || it.price;
    li.textContent = `${name} x${it.qty} — S/ ${(price * it.qty).toFixed(2)}`;
    ul.appendChild(li);
    total += price * it.qty;
  });

  summary.appendChild(ul);
  const totalLine = document.createElement('p');
  totalLine.innerHTML = `<b>Total:</b> S/ ${total.toFixed(2)}`;
  summary.appendChild(totalLine);

  // Mensaje inicial
  qrContainer.innerHTML = `
    <p style="color:#555;font-size:0.9rem;">
      📍 Selecciona tu ubicación en el mapa para continuar con el pago.
    </p>
  `;

  // === Configuración del mapa ===
  const restaurantLatLng = L.latLng(-12.525472, -76.557917);
  const coverageRadiusMeters = 5000;

  const map = L.map('map').setView([restaurantLatLng.lat, restaurantLatLng.lng], 15);
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '&copy; OpenStreetMap contributors'
  }).addTo(map);

  // Mostrar zona de cobertura
  L.circle(restaurantLatLng, { radius: coverageRadiusMeters, color: '#2a9d8f', fill: false }).addTo(map);
  L.marker(restaurantLatLng)
    .addTo(map)
    .bindPopup('📍 Restaurante El Camarón de Oro')
    .openPopup();

  let marker = null;
  let pedidoId = null;
  let currentUser = null;

  // Verifica si la ubicación seleccionada está dentro de cobertura
  function checkCoverage(latlng) {
    return latlng.distanceTo(restaurantLatLng) <= coverageRadiusMeters;
  }

  // === Inicio de sesión anónima + asignación de rol "cliente" ===
  try {
    const cred = await firebase.auth().signInAnonymously();
    currentUser = cred.user;

    // 👇 Crear rol "cliente" si no existe en la base de datos
    const roleRef = firebase.database().ref('roles/' + currentUser.uid);
    const snap = await roleRef.get();
    if (!snap.exists()) {
      await roleRef.set('cliente');
      console.log('✅ Rol "cliente" asignado automáticamente a', currentUser.uid);
    } else {
      console.log('ℹ️ Rol existente para', currentUser.uid, ':', snap.val());
    }

  } catch (err) {
    console.error("Error Firebase:", err);
    alert("Error al conectarse a Firebase. Reintenta más tarde.");
    return;
  }

  // === Evento al hacer clic en el mapa ===
  map.on('click', async function(e) {
    if (marker) map.removeLayer(marker);
    marker = L.marker(e.latlng).addTo(map);
    const selectedLatLng = e.latlng;

    // Verificar cobertura
    if (!checkCoverage(selectedLatLng)) {
      coverageMsg.textContent = '⚠️ Fuera de cobertura. No se puede generar pago.';
      qrContainer.innerHTML = `
        <p style="color:#c00;">⚠️ Estás fuera del área de entrega. No se puede continuar con el pago.</p>
      `;
      return;
    }

    coverageMsg.textContent = '✅ Dentro de cobertura. Registrando pedido...';

    try {
      const uid = currentUser ? currentUser.uid : null;
      const pedidoRef = firebase.database().ref('pedidos').push();
      pedidoId = pedidoRef.key;

      const pedidoData = {
        ubicacion: { lat: selectedLatLng.lat, lng: selectedLatLng.lng },
        items: cart,
        total: total,
        fecha: new Date().toISOString(),
        estado: "pendiente",
        uid: uid
      };

      // Guardar pedido en Firebase
      await pedidoRef.set(pedidoData);

      // === Mostrar QR y permitir verificación de pago ===
      qrContainer.innerHTML = `
        <h4>✅ Pedido registrado con éxito</h4>
        <p><b>Total:</b> S/ ${total.toFixed(2)}</p>
        <p>Escanea este código QR con Yape o BCP para realizar el pago.</p>
        <img src="yape.png" alt="QR de Yape" style="max-width:220px; margin-top:10px;">
        <p style="color:#555;font-size:0.9rem; margin-top:5px;">
          Luego sube la captura del comprobante para verificarlo automáticamente.
        </p>
        <p>ID de pedido: <b>${pedidoId}</b></p>
      `;

      // Guardar datos para pago_verificar.js
      qrContainer.dataset.pedidoId = pedidoId;
      qrContainer.dataset.total = total;

      // 🔹 Cargar dinámicamente el script de verificación
      const script = document.createElement('script');
      script.src = 'assets/pago_verificar.js';
      document.body.appendChild(script);

      // Limpiar carrito
      localStorage.removeItem(STORAGE_KEY);
      coverageMsg.textContent = '';

    } catch (err) {
      console.error("Error al guardar pedido:", err);
      alert('Error al guardar pedido o generar QR: ' + err.message);
    }
  });
})();

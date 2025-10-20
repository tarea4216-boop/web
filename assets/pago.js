(async function() {
  const STORAGE_KEY = 'camaron_cart_v1';
  const cart = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
  const summary = document.getElementById('cart-summary');
  const qrContainer = document.getElementById('qr');
  const coverageMsg = document.getElementById('coverage-msg');

  if (!cart.length) {
    summary.innerHTML = '<p>Tu carrito está vacío.</p>';
    return;
  }

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

  const restaurantLatLng = L.latLng(-12.525472, -76.557917);
  const coverageRadiusMeters = 5000;
  const map = L.map('map').setView([restaurantLatLng.lat, restaurantLatLng.lng], 15);
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '&copy; OpenStreetMap contributors'
  }).addTo(map);

  L.circle(restaurantLatLng, { radius: coverageRadiusMeters, color: '#2a9d8f', fill: false }).addTo(map);
  L.marker(restaurantLatLng).addTo(map).bindPopup('📍 Restaurante El Camarón de Oro').openPopup();

  let marker = null;
  let pedidoId = null;
  let currentUser = null;

  function checkCoverage(latlng) {
    return latlng.distanceTo(restaurantLatLng) <= coverageRadiusMeters;
  }

  // === Sesión anónima y creación segura del rol ===
  try {
    const cred = await firebase.auth().signInAnonymously();
    currentUser = cred.user;
    const roleRef = firebase.database().ref('roles/' + currentUser.uid);

    // 🔹 Asignar rol si no existe
    const snap = await roleRef.get();
    if (!snap.exists()) {
      await roleRef.set('cliente');
      console.log('✅ Rol "cliente" creado para', currentUser.uid);

      // 🕑 Esperar a que Firebase sincronice las reglas (pequeño retraso)
      await new Promise(res => setTimeout(res, 1200));
    } else {
      console.log('ℹ️ Rol existente:', snap.val());
    }

  } catch (err) {
    console.error("Error Firebase:", err);
    alert("Error al conectarse a Firebase. Reintenta más tarde.");
    return;
  }

  // === Al hacer clic en el mapa ===
  map.on('click', async function(e) {
    if (marker) map.removeLayer(marker);
    marker = L.marker(e.latlng).addTo(map);
    const selectedLatLng = e.latlng;

    if (!checkCoverage(selectedLatLng)) {
      coverageMsg.textContent = '⚠️ Fuera de cobertura. No se puede generar pago.';
      qrContainer.innerHTML = `<p style="color:#c00;">⚠️ Estás fuera del área de entrega.</p>`;
      return;
    }

    coverageMsg.textContent = '✅ Dentro de cobertura. Registrando pedido...';

    try {
      const uid = currentUser.uid;
      const pedidoRef = firebase.database().ref('pedidos').push();
      pedidoId = pedidoRef.key;

      const pedidoData = {
        uid,
        ubicacion: { lat: selectedLatLng.lat, lng: selectedLatLng.lng },
        items: cart,
        total,
        fecha: new Date().toISOString(),
        estado: "pendiente"
      };

      // 🔹 Intentar escribir, reintentar una vez si da error
      try {
        await pedidoRef.set(pedidoData);
      } catch (err) {
        console.warn("Primer intento falló, esperando 1s y reintentando...");
        await new Promise(res => setTimeout(res, 1000));
        await pedidoRef.set(pedidoData);
      }

      qrContainer.innerHTML = `
        <h4>✅ Pedido registrado con éxito</h4>
        <p><b>Total:</b> S/ ${total.toFixed(2)}</p>
        <p>Escanea este código QR con Yape o BCP para realizar el pago.</p>
        <img src="yape.png" alt="QR de Yape" style="max-width:220px;margin-top:10px;">
        <p style="color:#555;font-size:0.9rem;margin-top:5px;">
          Luego sube la captura del comprobante para verificarlo automáticamente.
        </p>
        <p>ID de pedido: <b>${pedidoId}</b></p>
      `;

      const script = document.createElement('script');
      script.src = 'assets/pago_verificar.js';
      document.body.appendChild(script);

      localStorage.removeItem(STORAGE_KEY);
      coverageMsg.textContent = '';

    } catch (err) {
      console.error("Error al guardar pedido:", err);
      alert('Error al guardar pedido o generar QR: ' + err.message);
    }
  });
})();

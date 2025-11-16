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

  // === Mostrar resumen ===
  let total = 0;
  const ul = document.createElement('ul');
  ul.style.listStyle = 'none';
  ul.style.paddingLeft = '0';

  cart.forEach((it, index) => {
    const li = document.createElement('li');
    li.style.marginBottom = '1rem';
    li.innerHTML = `
      <p><b>${it.nombre}</b> x${it.qty} — S/ ${(it.precio * it.qty).toFixed(2)}</p>
      <textarea id="comentario-${index}" placeholder="Comentario adicional (opcional)" rows="1"
        style="width:100%;resize:none;border-radius:6px;padding:5px;"></textarea>
    `;
    ul.appendChild(li);
    total += it.precio * it.qty;
  });

  summary.appendChild(ul);
  summary.innerHTML += `<p><b>Total:</b> S/ ${total.toFixed(2)}</p>`;

  qrContainer.innerHTML = `<p style="color:#555;font-size:0.9rem;">📍 Selecciona tu ubicación en el mapa para continuar con el pago.</p>`;

// === Mapa ===
const restaurantLatLng = L.latLng(-12.525472, -76.557917);
const map = L.map('map').setView([restaurantLatLng.lat, restaurantLatLng.lng], 15);

L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
  attribution: '&copy; OpenStreetMap contributors'
}).addTo(map);

L.marker(restaurantLatLng)
  .addTo(map)
  .bindPopup('📍 Restaurante El Camarón de Oro')
  .openPopup();


// === ZONA DE COBERTURA EXACTA (ÁREA ROJA) ===
const zonaCoberturaCoords = [
  [-12.533400, -76.571900],  // Correviento izquierda
  [-12.532000, -76.569500],
  [-12.531000, -76.567300],
  [-12.529300, -76.564500],
  [-12.528000, -76.562200],
  [-12.526800, -76.560100],
  [-12.525800, -76.558300],  // Cerca restaurante

  // 🟥 ZONA ENSANCHADA (curva hacia el río)
  [-12.525200, -76.557000],
  [-12.524200, -76.556000],
  [-12.523000, -76.554800],
  [-12.521500, -76.553500],

  // === Entrada a Calango ===
  [-12.520200, -76.552000],
  [-12.519000, -76.550300],

  // 🟥 ZONA AMPLIA DERECHA (Mallqui)
  [-12.518000, -76.549000],
  [-12.517000, -76.547300],
  [-12.516500, -76.546000],
  [-12.516000, -76.544500],
  [-12.515500, -76.543000],
  [-12.515200, -76.541500],
  [-12.514500, -76.540000],
  [-12.514200, -76.538500],

  // Cierre derecha
  [-12.515800, -76.537000],
  [-12.517800, -76.536500],
  [-12.519800, -76.537700],
  [-12.521800, -76.539000],
  [-12.523500, -76.540500],
  [-12.525000, -76.542000],

  // Cierre general del polígono
  [-12.526500, -76.544000],
  [-12.529000, -76.548000],
  [-12.531000, -76.552000],
  [-12.533200, -76.555000],
  [-12.533400, -76.571900]
];


// === Dibujar ZONA DE COBERTURA (diseño premium) ===
const zonaCobertura = L.polygon(zonaCoberturaCoords, {
  color: "#E63946",
  weight: 2,
  fillColor: "#FF6B6B",
  fillOpacity: 0.35,
  smoothFactor: 2
}).addTo(map);


// === Validación SÚPER PRECISA (Turf.js point-in-polygon) ===
function checkCoverage(latlng) {
  const pt = turf.point([latlng.lng, latlng.lat]);
  const poly = turf.polygon([zonaCoberturaCoords.map(c => [c[1], c[0]])]);
  return turf.booleanPointInPolygon(pt, poly);
}




  // === Sesión anónima ===
  try {
    const cred = await firebase.auth().signInAnonymously();
    currentUser = cred.user;
    const roleRef = firebase.database().ref('roles/' + currentUser.uid);
    const snapshot = await roleRef.get();
    if (!snapshot.exists()) await roleRef.set('cliente');
  } catch (err) {
    console.error("Error Firebase:", err);
    showToast("❌ Error al conectarse a Firebase.", "error");
    return;
  }

  // === Click en el mapa ===
  map.on('click', function (e) {
    if (pagoConfirmado) {
      showToast("✅ El pago ya fue confirmado.", "info");
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

    coverageMsg.textContent = '✅ Dentro de cobertura.';
    showToast("✅ Ubicación válida", "success");

    qrContainer.innerHTML = `
      <h4>Datos para la entrega</h4>
      <div style="display:flex;flex-direction:column;gap:10px;max-width:400px;">
        <input type="text" id="cliente-nombre" placeholder="👤 Nombre completo" style="padding:10px;border-radius:6px;border:1px solid #ccc;">
        <input type="tel" id="cliente-celular" placeholder="📱 Número de celular" maxlength="9" style="padding:10px;border-radius:6px;border:1px solid #ccc;">
        <textarea id="cliente-referencia" placeholder="🏠 Referencia del lugar" rows="2" style="padding:10px;border-radius:6px;border:1px solid #ccc;"></textarea>
        <button id="continuar-pago" class="btn primary">Continuar al pago</button>
      </div>
    `;

    qrContainer.dataset.lat = selectedLatLng.lat;
    qrContainer.dataset.lng = selectedLatLng.lng;
    qrContainer.dataset.total = total;
    qrContainer.dataset.uid = currentUser.uid;
    qrContainer.dataset.pedidoId = `pedido-${Date.now()}`;

    document.getElementById('continuar-pago').addEventListener('click', () => {
      const nombre = document.getElementById('cliente-nombre').value.trim();
      const celular = document.getElementById('cliente-celular').value.trim();
      const referencia = document.getElementById('cliente-referencia').value.trim();

      if (!nombre || !celular) {
        showToast("⚠️ Ingresa tu nombre y número de celular.", "error");
        return;
      }

      const cartWithComments = cart.map((it, index) => {
        const textarea = document.getElementById(`comentario-${index}`);
        return { ...it, comentario: textarea?.value?.trim() || "" };
      });

      Object.assign(qrContainer.dataset, {
        nombre, celular, referencia,
        cart: JSON.stringify(cartWithComments)
      });

      qrContainer.innerHTML = `
        <h4>Resumen de tu pedido</h4>
        <p><b>Cliente:</b> ${nombre}</p>
        <p><b>Celular:</b> ${celular}</p>
        <p><b>Total:</b> S/ ${total.toFixed(2)}</p>
        <img src="yape.png" alt="QR de Yape" style="max-width:220px;margin-top:10px;">
        <p style="font-size:0.9rem;">Sube la captura del pago para verificar.</p>
      `;

      const script = document.createElement('script');
      script.id = "verificadorScript";
      script.type = "module";
      script.src = 'assets/pago_verificar.js';
      document.body.appendChild(script);

      localStorage.removeItem(STORAGE_KEY);
    });
  });

  if (window.opener && window.opener.cart) {
    window.opener.cart.clear?.();
  }

  window.bloquearMapaPago = function () {
    pagoConfirmado = true;
    map.dragging.disable();
  };
})();

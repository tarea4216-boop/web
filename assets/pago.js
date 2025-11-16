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
// === ZONA DE COBERTURA CORREGIDA ===
// (Forma fiel al mapa que enviaste)
const zonaCoberturaCoords = [
  // Lado izquierdo (Correviento)
  [-12.533500, -76.571900],
  [-12.533000, -76.570900],
  [-12.532400, -76.569700],
  [-12.531500, -76.568300],

  // Centro cerca del restaurante
  [-12.530300, -76.566700],
  [-12.529200, -76.565200],
  [-12.528300, -76.563900],
  [-12.527400, -76.562500],
  [-12.526600, -76.561300],
  [-12.525900, -76.560300],
  [-12.525300, -76.559500],
  [-12.524700, -76.558800],

  // Entrada Calango (lado derecho)
  [-12.523900, -76.557800],
  [-12.523200, -76.556900],
  [-12.522400, -76.555800],
  [-12.521700, -76.554800],
  [-12.521200, -76.553900],

  // Cierre del polígono por abajo (regresa)
  [-12.521800, -76.554900],
  [-12.522500, -76.555900],
  [-12.523300, -76.557000],
  [-12.524100, -76.558000],
  [-12.524900, -76.559100],
  [-12.525600, -76.560000],
  [-12.526400, -76.561200],
  [-12.527200, -76.562400],
  [-12.528100, -76.563700],
  [-12.529100, -76.564900],
  [-12.530200, -76.566300],
  [-12.531100, -76.567700],
  [-12.532000, -76.569200],
  [-12.533000, -76.570800],
  [-12.533500, -76.571900]
];



// === Dibujar ZONA DE COBERTURA (diseño premium) ===
const zonaCobertura = L.polygon(zonaCoberturaCoords, {
  color: "#E63946",
  weight: 2,
  fillColor: "#FF6B6B",
  fillOpacity: 0.35,
  smoothFactor: 1.5
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

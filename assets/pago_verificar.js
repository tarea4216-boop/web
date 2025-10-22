(async () => {
  const qrContainer = document.getElementById('qr');
  if (!qrContainer) return;

  // 🔹 Usar Firebase ya inicializado en pago.html
  const db = firebase.database();
  const auth = firebase.auth();

  // === Elementos visuales ===
  const uploadContainer = document.createElement('div');
  uploadContainer.innerHTML = `
    <h4>📸 Subir comprobante de pago</h4>
    <p>Por favor, sube la captura de pantalla del pago realizado en Yape.</p>
    <p style="font-size: 0.9rem; color: #555;">
      Asegúrate de que se vean claramente el <b>monto</b>, la <b>fecha</b> y la <b>hora</b> del pago.
    </p>
    <input type="file" id="capture-input" accept="image/*" />
    <button id="verify-btn" class="btn primary" style="margin-top: 10px;">Verificar pago</button>
    <div id="verify-status" style="margin-top: 1rem; font-weight:bold;"></div>
  `;
  qrContainer.appendChild(uploadContainer);

  const inputFile = document.getElementById('capture-input');
  const verifyBtn = document.getElementById('verify-btn');
  const statusDiv = document.getElementById('verify-status');

  let selectedFile = null;
  let usuarioActual = null;

  const pedidoId = qrContainer.dataset.uid;
  const totalPedido = parseFloat(qrContainer.dataset.total || "0");
  const carrito = JSON.parse(qrContainer.dataset.cart || "[]");
  const lat = parseFloat(qrContainer.dataset.lat);
  const lng = parseFloat(qrContainer.dataset.lng);

  inputFile.addEventListener('change', (e) => {
    selectedFile = e.target.files[0];
  });

  auth.onAuthStateChanged(user => {
    usuarioActual = user;
  });

  // === Verificar comprobante ===
  verifyBtn.addEventListener('click', async () => {
    if (!selectedFile) {
      alert("Selecciona una imagen del comprobante.");
      return;
    }

    statusDiv.textContent = "⏳ Analizando imagen...";
    verifyBtn.disabled = true;

    try {
      // Procesar OCR con Tesseract.js
      const result = await Tesseract.recognize(selectedFile, 'spa');
      const text = result.data.text.toLowerCase();
      console.log("📄 Texto detectado:", text);

      const montoMatch = text.match(/s\/\s*([\d,.]+)/);
      const montoPagado = montoMatch ? parseFloat(montoMatch[1].replace(',', '.')) : null;

      if (!montoPagado) throw new Error("No se detectó monto en la imagen.");
      if (montoPagado < totalPedido) throw new Error("Monto pagado menor al total del pedido.");

      // Crear registro en pedidosOnline
      const refNuevo = db.ref("pedidosOnline").push();
      await refNuevo.set({
        idTemporal: pedidoId,
        total: totalPedido,
        estado: "confirmado",
        cliente: usuarioActual?.uid || "anónimo",
        creadoEn: Date.now(),
        ubicacion: { lat, lng },
        items: carrito,
        verificacion: {
          monto: montoPagado,
          fecha: new Date().toLocaleDateString(),
          hora: new Date().toLocaleTimeString(),
          verificado_en: new Date().toISOString()
        }
      });

      statusDiv.innerHTML = `
        ✅ Pago verificado con éxito.<br>
        💾 Pedido guardado en <b>pedidosOnline</b> y enviado a cocina.
      `;
    } catch (err) {
      console.error(err);
      statusDiv.textContent = "❌ Error: " + err.message;
    }

    verifyBtn.disabled = false;
  });
})();

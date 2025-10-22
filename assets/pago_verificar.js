(async () => {
  const qrContainer = document.getElementById('qr');
  if (!qrContainer) return;

  const db = firebase.database();
  const auth = firebase.auth();

  // === Crear contenedor de subida ===
  const uploadContainer = document.createElement('div');
  uploadContainer.innerHTML = `
    <h4>📸 Subir comprobante de pago</h4>
    <p>Por favor, sube la captura del pago realizado en Yape o BCP.</p>
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
      // OCR con Tesseract.js
      const result = await Tesseract.recognize(selectedFile, 'spa');
      const text = result.data.text.toLowerCase();
      console.log("📄 Texto detectado:", text);

      const montoMatch = text.match(/s\/\s*([\d,.]+)/);
      const montoPagado = montoMatch ? parseFloat(montoMatch[1].replace(',', '.')) : null;

      if (!montoPagado) throw new Error("No se detectó monto en la imagen.");
      if (montoPagado < totalPedido) throw new Error("Monto pagado menor al total del pedido.");

      // === Guardar pedido en Firebase ===
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

      // ✅ Bloquear mapa
      if (window.bloquearMapaPago) window.bloquearMapaPago();

      // === Descargar PDF del pedido ===
      const { jsPDF } = window.jspdf;
      const doc = new jsPDF();
      doc.setFontSize(14);
      doc.text("Comprobante de Pedido - El Camarón de Oro", 15, 20);
      doc.setFontSize(11);
      doc.text(`ID Pedido: ${pedidoId}`, 15, 35);
      doc.text(`Fecha: ${new Date().toLocaleString()}`, 15, 45);
      doc.text(`Monto total: S/ ${totalPedido.toFixed(2)}`, 15, 55);
      doc.text(`Estado: Confirmado`, 15, 65);
      doc.text("Items:", 15, 80);

      let y = 90;
      carrito.forEach(it => {
        doc.text(`- ${it.nombre} x${it.qty} — S/ ${(it.precio * it.qty).toFixed(2)}`, 20, y);
        y += 8;
      });

      doc.text("Gracias por tu compra ❤️", 15, y + 10);
      doc.save(`Pedido_${pedidoId}.pdf`);

      // === Mostrar confirmación visual ===
      qrContainer.innerHTML = `
        <h3>🎉 Pago confirmado con éxito</h3>
        <p>Tu pedido fue guardado y enviado a cocina.</p>
        <p>Se ha descargado un comprobante en formato PDF.</p>
      `;

    } catch (err) {
      console.error(err);
      statusDiv.textContent = "❌ Error: " + err.message;
      verifyBtn.disabled = false;
    }
  });
})();

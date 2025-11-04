import { supabase } from './supabaseClient.js';

window.initPagoVerificar = async function () {

  const qrContainer = document.getElementById('qr');
  if (!qrContainer) return;

  const db = firebase.database();
  const auth = firebase.auth();

  // === Zona de carga del comprobante ===
  const uploadContainer = document.createElement('div');
  uploadContainer.innerHTML = `
    <h4>📸 Subir comprobante de pago</h4>
    <p>Por favor, sube la captura del pago realizado en Yape o BCP.</p>
    <input type="file" id="capture-input" accept="image/*" style="margin-top:8px;">
    <button id="verify-btn" class="btn primary" style="margin-top:10px;">Verificar pago</button>
    <div id="verify-status" style="margin-top:1rem; font-weight:bold;"></div>
  `;
  qrContainer.appendChild(uploadContainer);

  // === Referencias ===
  const inputFile = document.getElementById('capture-input');
  const verifyBtn = document.getElementById('verify-btn');
  const statusDiv = document.getElementById('verify-status');

  let selectedFile = null;
  let usuarioActual = null;

  // === Datos del pedido recibidos desde pago.js ===
  const pedidoId = qrContainer.dataset.uid;
  const totalPedido = parseFloat(qrContainer.dataset.total || "0");
  const carrito = JSON.parse(qrContainer.dataset.cart || "[]");
  const lat = parseFloat(qrContainer.dataset.lat);
  const lng = parseFloat(qrContainer.dataset.lng);
  const clienteNombre = qrContainer.dataset.nombre || "Sin nombre";
  const clienteCelular = qrContainer.dataset.celular || "Sin celular";
  const clienteReferencia = qrContainer.dataset.referencia || "";

  inputFile.addEventListener('change', (e) => {
    selectedFile = e.target.files[0];
  });

  auth.onAuthStateChanged(user => {
    usuarioActual = user;
  });

  // === Botón verificar pago ===
  verifyBtn.addEventListener('click', async () => {
    if (!selectedFile) {
      showToast("⚠️ Selecciona una imagen del comprobante.", "info");
      return;
    }

    statusDiv.textContent = "⏳ Analizando imagen...";
    verifyBtn.disabled = true;

    try {
      // === OCR con Tesseract ===
      const result = await Tesseract.recognize(selectedFile, 'spa');
      const text = result.data.text.toLowerCase();
      console.log("📄 Texto detectado:", text);

      const montoMatch = text.match(/s\/\s*([\d,.]+)/);
      const montoPagado = montoMatch ? parseFloat(montoMatch[1].replace(',', '.')) : null;

      if (!montoPagado) throw new Error("No se detectó monto en la imagen.");
      if (montoPagado < totalPedido) throw new Error("Monto pagado menor al total del pedido.");

      // === 1️⃣ Guardar pedido en Firebase con datos del cliente ===
      const refNuevo = db.ref("pedidosOnline").push();
      await refNuevo.set({
        idTemporal: pedidoId,
        total: totalPedido,
        estado: "confirmado",
        tipo_pedido: "online",
        cliente: {
          uid: usuarioActual?.uid || "anónimo",
          nombre: clienteNombre,
          celular: clienteCelular,
          referencia: clienteReferencia
        },
        creadoEn: Date.now(),
        ubicacion: { lat, lng },
        items: carrito,
        metodo_pago: "Yape/BCP",
        verificacion: {
          monto: montoPagado,
          fecha: new Date().toLocaleDateString(),
          hora: new Date().toLocaleTimeString(),
          verificado_en: new Date().toISOString()
        }
      });

      // === 2️⃣ Registrar venta en SUPABASE ===
      const { error: insertError } = await supabase.from('ventas').insert([{
        id_pedido: pedidoId,
        nombre_cliente: clienteNombre,
        celular_cliente: clienteCelular,
        referencia: clienteReferencia,
        total: totalPedido,
        tipo_pedido: "online",
        metodo_pago: "Yape/BCP",
        productos: carrito
      }]);

      if (insertError) console.error("⚠️ Error al guardar en Supabase:", insertError);
      else console.log("✅ Venta registrada correctamente en Supabase");

      // Bloquear interacción con el mapa
      if (window.bloquearMapaPago) window.bloquearMapaPago();

      // === 3️⃣ Generar PDF de comprobante ===
      const { jsPDF } = window.jspdf;
      const doc = new jsPDF();
      doc.setFontSize(14);
      doc.text("Comprobante de Pedido - El Camarón de Oro", 15, 20);
      doc.setFontSize(11);
      doc.text(`ID Pedido: ${pedidoId}`, 15, 35);
      doc.text(`Fecha: ${new Date().toLocaleString()}`, 15, 45);
      doc.text(`Cliente: ${clienteNombre}`, 15, 55);
      doc.text(`Celular: ${clienteCelular}`, 15, 63);
      if (clienteReferencia) doc.text(`Referencia: ${clienteReferencia}`, 15, 71);
      doc.text(`Monto total: S/ ${totalPedido.toFixed(2)}`, 15, 81);
      doc.text(`Estado: Confirmado`, 15, 91);
      doc.text("Items:", 15, 105);

      let y = 115;
      carrito.forEach(it => {
        const line = `- ${it.nombre} x${it.qty} — S/ ${(it.precio * it.qty).toFixed(2)}`;
        doc.text(line, 20, y);
        y += 8;
      });

      doc.text("Gracias por tu compra ❤️", 15, y + 10);
      doc.save(`Pedido_${pedidoId}.pdf`);

      // === 4️⃣ Mensaje final ===
      showToast("🎉 Pago confirmado con éxito. Comprobante descargado.", "success");
      qrContainer.innerHTML = `
        <h3>🎉 Pago confirmado con éxito</h3>
        <p>Tu pedido fue guardado y enviado a cocina.</p>
        <p>Se ha descargado un comprobante en formato PDF.</p>
        <p><b>Cliente:</b> ${clienteNombre}<br>
           <b>Celular:</b> ${clienteCelular}<br>
           <b>Referencia:</b> ${clienteReferencia || "—"}</p>
      `;

    } catch (err) {
      console.error("❌ Error en verificación:", err);
      statusDiv.textContent = "❌ Error: " + err.message;
      showToast("❌ " + err.message, "error");
      verifyBtn.disabled = false;
    }
  });
};

// Inicializar automáticamente
window.initPagoVerificar();

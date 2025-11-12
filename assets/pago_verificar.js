import { supabase } from './supabaseClient.js';

window.initPagoVerificar = async function () {
  const qrContainer = document.getElementById('qr');
  if (!qrContainer) return;

  const db = firebase.database();
  const auth = firebase.auth();

  // === UI de carga ===
  const uploadContainer = document.createElement('div');
  uploadContainer.innerHTML = `
    <h4>📸 Subir comprobante de pago</h4>
    <p>Por favor, sube la captura del pago realizado en Yape o BCP.</p>
    <input type="file" id="capture-input" accept="image/*" style="margin-top:8px;">
    <button id="verify-btn" class="btn primary" style="margin-top:10px;">Verificar pago</button>
    <div id="verify-status" style="margin-top:1rem;font-weight:bold;"></div>
  `;
  qrContainer.appendChild(uploadContainer);

  // === Referencias ===
  const inputFile = document.getElementById('capture-input');
  const verifyBtn = document.getElementById('verify-btn');
  const statusDiv = document.getElementById('verify-status');

  let selectedFile = null;
  let intentosFallidos = 0;
  inputFile.addEventListener('change', e => selectedFile = e.target.files[0]);

  const pedidoId = qrContainer.dataset.pedidoId || `pedido-${Date.now()}`;
  const totalPedido = parseFloat(qrContainer.dataset.total || "0");
  const carrito = JSON.parse(qrContainer.dataset.cart || "[]");
  const lat = parseFloat(qrContainer.dataset.lat);
  const lng = parseFloat(qrContainer.dataset.lng);
  const clienteNombre = qrContainer.dataset.nombre || "Sin nombre";
  const clienteCelular = qrContainer.dataset.celular || "Sin celular";
  const clienteReferencia = qrContainer.dataset.referencia || "";
  const clienteUid = qrContainer.dataset.uid || "anónimo";

  // === Función para guardar en Firebase cuando falla ===
  async function guardarPedidoPendiente(token) {
    const ref = db.ref("pedidosPendientesValidacion").child(`validacion-${token}`);
    await ref.set({
      token,
      idTemporal: clienteUid,
      total: totalPedido,
      estado: "esperando_admin",
      tipo_pedido: "online",
      cliente: {
        uid: clienteUid,
        nombre: clienteNombre,
        celular: clienteCelular,
        referencia: clienteReferencia
      },
      creadoEn: Date.now(),
      ubicacion: { lat, lng },
      items: carrito,
      metodo_pago: "Yape/BCP"
    });
    console.log("📦 Pedido guardado en pedidosPendientesValidacion:", token);
  }

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
      const montoMatch = text.match(/s\/\\s*([\\d,.]+)/);
      const montoPagado = montoMatch ? parseFloat(montoMatch[1].replace(',', '.')) : null;

      if (!montoPagado) throw new Error("No se detectó monto en la imagen.");
      if (montoPagado < totalPedido) throw new Error("Monto pagado menor al total.");

      // === ✅ Pedido correcto ===
      const refNuevo = db.ref("pedidosOnline").push();
      await refNuevo.set({
        idTemporal: clienteUid,
        total: totalPedido,
        estado: "confirmado",
        tipo_pedido: "online",
        cliente: {
          uid: clienteUid,
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

      console.log("✅ Pedido guardado correctamente en Firebase");

      // === Registrar venta en SUPABASE ===
      const { error: insertError } = await supabase.from('ventas').insert([{
        id_pedido: pedidoId,
        cliente: clienteNombre,
        total: totalPedido,
        productos: carrito,
        fecha: new Date().toISOString()
      }]);
      if (insertError) throw insertError;

      console.log("✅ Venta registrada correctamente en Supabase");

      // === Generar PDF ===
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

      if (window.bloquearMapaPago) window.bloquearMapaPago();

      showToast("🎉 Pago confirmado. Comprobante descargado.", "success");
      qrContainer.innerHTML = `
        <h3>🎉 Pago confirmado con éxito</h3>
        <p>Tu pedido fue guardado y enviado a cocina.</p>
        <p>Se ha descargado un comprobante PDF.</p>
        <p><b>Cliente:</b> ${clienteNombre}<br>
           <b>Celular:</b> ${clienteCelular}<br>
           <b>Referencia:</b> ${clienteReferencia || "—"}<br>
           <b>Total:</b> S/ ${totalPedido.toFixed(2)}</p>
      `;

    } catch (err) {
      intentosFallidos++;
      console.error("❌ Error en verificación:", err);
      statusDiv.textContent = "❌ " + err.message;
      showToast("❌ " + err.message, "error");
      verifyBtn.disabled = false;

      // === Después de 2 intentos fallidos ===
      if (intentosFallidos >= 2) {
        const token = Math.random().toString(36).substring(2, 10).toUpperCase();
        await guardarPedidoPendiente(token);

  const adminLink = `https://admin-validar.onrender.com/?token=${token}`;


        // Construir mensaje de WhatsApp
        const mensaje = `
Hola, quiero hacer un pedido pero no puedo validar mi comprobante de pago.

🧾 Detalles del pedido:
${carrito.map(it => `- ${it.nombre} x${it.qty} — S/ ${(it.precio * it.qty).toFixed(2)}`).join('\n')}
💰 Total: S/ ${totalPedido.toFixed(2)}
👤 Cliente: ${clienteNombre}
📱 ${clienteCelular}
🏠 ${clienteReferencia || "Sin referencia"}

Validar pedido: ${adminLink}
        `.trim();

        const whatsappURL = `https://wa.me/51986556773?text=${encodeURIComponent(mensaje)}`;

        statusDiv.innerHTML = `
          ⚠️ No se pudo validar el pago automáticamente.<br>
          <button id="btn-whatsapp" class="btn primary" style="margin-top:10px;">📱 Enviar por WhatsApp</button>
        `;

        document.getElementById("btn-whatsapp").addEventListener("click", () => {
          window.open(whatsappURL, "_blank");
        });

        verifyBtn.disabled = true;
      }
    }
  });
};

// Inicializar automáticamente
window.initPagoVerificar();




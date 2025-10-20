(function() {
  const qrContainer = document.getElementById('qr');

  // Solo agregar el formulario si existe el contenedor QR
  if (!qrContainer) return;

  // Crear contenedor para verificación de imagen
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

  // === VARIABLES GLOBALES ===
  let selectedFile = null;
  let pedidoId = null;
  let totalPedido = 0;

  // Detectar el pedido actual (ID mostrado en el QR generado)
  const pedidoText = qrContainer.querySelector("p b");
  if (pedidoText) {
    pedidoId = pedidoText.textContent.trim();
  }

  // Intentar detectar el total
  const totalText = qrContainer.querySelector("p b + p, p:nth-of-type(2)");
  if (totalText) {
    const match = totalText.textContent.match(/S\/\s*([\d.]+)/);
    if (match) totalPedido = parseFloat(match[1]);
  }

  inputFile.addEventListener('change', (e) => {
    selectedFile = e.target.files[0];
  });

  // === FUNCION PRINCIPAL DE VERIFICACIÓN ===
  verifyBtn.addEventListener('click', async () => {
    if (!selectedFile) {
      alert("Por favor selecciona una imagen del comprobante.");
      return;
    }

    statusDiv.textContent = "⏳ Procesando imagen, por favor espera...";
    verifyBtn.disabled = true;

    try {
      // Procesar OCR con Tesseract.js
      const result = await Tesseract.recognize(selectedFile, 'spa', {
        logger: info => console.log(info)
      });

      const text = result.data.text.toLowerCase();
      console.log("📄 Texto detectado:", text);

      // === Extraer monto ===
      const montoMatch = text.match(/s\/\s*([\d,.]+)/);
      const montoPagado = montoMatch ? parseFloat(montoMatch[1].replace(',', '.')) : null;

      // === Extraer fecha y hora aproximada ===
      const fechaMatch = text.match(/(\d{2}\/\d{2}\/\d{4})/);
      const horaMatch = text.match(/(\d{1,2}:\d{2})/);

      // Validaciones
      if (!montoPagado) {
        statusDiv.innerHTML = "❌ No se pudo detectar el monto en la imagen.";
        verifyBtn.disabled = false;
        return;
      }

      // Tolerancia: permitir que el monto sea igual o mayor al total del pedido
      if (montoPagado < totalPedido) {
        statusDiv.innerHTML = `⚠️ El monto pagado (S/ ${montoPagado.toFixed(2)}) es menor al total (S/ ${totalPedido.toFixed(2)}).`;
        verifyBtn.disabled = false;
        return;
      }

      // Mostrar resumen de detección
      statusDiv.innerHTML = `
        ✅ Monto detectado: S/ ${montoPagado.toFixed(2)}<br>
        📅 Fecha: ${fechaMatch ? fechaMatch[1] : "No detectada"}<br>
        🕒 Hora: ${horaMatch ? horaMatch[1] : "No detectada"}<br>
        <br>Verificando en Firebase...
      `;

      // === Actualizar pedido en Firebase ===
      if (pedidoId) {
        const pedidoRef = firebase.database().ref('pedidos/' + pedidoId);
        await pedidoRef.update({
          estado: "confirmado",
          verificacion: {
            monto: montoPagado,
            fecha: fechaMatch ? fechaMatch[1] : null,
            hora: horaMatch ? horaMatch[1] : null,
            verificado_en: new Date().toISOString()
          }
        });

        statusDiv.innerHTML += `<br><br>🎉 Pago verificado con éxito. El pedido fue enviado a cocina.`;
      } else {
        statusDiv.innerHTML += `<br><br>⚠️ No se encontró el ID del pedido para actualizar.`;
      }

    } catch (err) {
      console.error(err);
      statusDiv.textContent = "❌ Error al procesar la imagen: " + err.message;
    }

    verifyBtn.disabled = false;
  });
})();

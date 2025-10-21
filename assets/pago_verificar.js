(async () => {
  const qrContainer = document.getElementById('qr');
  if (!qrContainer) return;

  // 🔹 Importar módulos de Firebase dinámicamente
  const { initializeApp } = await import("https://www.gstatic.com/firebasejs/11.8.1/firebase-app.js");
  const { getDatabase, ref, push, set, update } = await import("https://www.gstatic.com/firebasejs/11.8.1/firebase-database.js");
  const { getAuth, onAuthStateChanged } = await import("https://www.gstatic.com/firebasejs/11.8.1/firebase-auth.js");

  // 🔧 Configuración Firebase
  const firebaseConfig = {
    apiKey: "AIzaSyAYXlV5SEgWfbRtacAEjec2Ve8x6hJtNBA",
    authDomain: "proyecto-restaurante-60eb0.firebaseapp.com",
    databaseURL: "https://proyecto-restaurante-60eb0-default-rtdb.firebaseio.com",
    projectId: "proyecto-restaurante-60eb0",
    storageBucket: "proyecto-restaurante-60eb0.appspot.com",
    messagingSenderId: "459872565031",
    appId: "1:459872565031:web:1633ecd0beb3c98a7c5b02"
  };

  const app = initializeApp(firebaseConfig);
  const db = getDatabase(app);
  const auth = getAuth(app);

  // ==================== ELEMENTOS DEL DOM ====================
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
  let pedidoId = null;
  let totalPedido = 0;
  let usuarioActual = null;

  // ==================== DETECTAR INFO DEL PEDIDO ====================
  const pedidoText = qrContainer.querySelector("p b");
  if (pedidoText) pedidoId = pedidoText.textContent.trim();

  const totalText = qrContainer.querySelector("p:nth-of-type(2)");
  if (totalText) {
    const match = totalText.textContent.match(/S\/\s*([\d.]+)/);
    if (match) totalPedido = parseFloat(match[1]);
  }

  inputFile.addEventListener('change', (e) => {
    selectedFile = e.target.files[0];
  });

  // ==================== VERIFICAR AUTENTICACIÓN ====================
  onAuthStateChanged(auth, (user) => {
    usuarioActual = user;
    if (!user) console.warn("⚠️ No hay usuario autenticado. El rol de cliente debe iniciar sesión.");
  });

  // ==================== PROCESO PRINCIPAL ====================
  verifyBtn.addEventListener('click', async () => {
    if (!selectedFile) {
      alert("Por favor selecciona una imagen del comprobante.");
      return;
    }

    statusDiv.textContent = "⏳ Procesando imagen, por favor espera...";
    verifyBtn.disabled = true;

    try {
      // OCR con Tesseract
      const result = await Tesseract.recognize(selectedFile, 'spa', {
        logger: info => console.log(info)
      });

      const text = result.data.text.toLowerCase();
      console.log("📄 Texto detectado:", text);

      // === Extraer datos ===
      const montoMatch = text.match(/s\/\s*([\d,.]+)/);
      const montoPagado = montoMatch ? parseFloat(montoMatch[1].replace(',', '.')) : null;
      const fechaMatch = text.match(/(\d{2}\/\d{2}\/\d{4})/);
      const horaMatch = text.match(/(\d{1,2}:\d{2})/);

      if (!montoPagado) {
        statusDiv.innerHTML = "❌ No se pudo detectar el monto en la imagen.";
        verifyBtn.disabled = false;
        return;
      }

      if (montoPagado < totalPedido) {
        statusDiv.innerHTML = `⚠️ El monto pagado (S/ ${montoPagado.toFixed(2)}) es menor al total (S/ ${totalPedido.toFixed(2)}).`;
        verifyBtn.disabled = false;
        return;
      }

      statusDiv.innerHTML = `
        ✅ Monto detectado: S/ ${montoPagado.toFixed(2)}<br>
        📅 Fecha: ${fechaMatch ? fechaMatch[1] : "No detectada"}<br>
        🕒 Hora: ${horaMatch ? horaMatch[1] : "No detectada"}<br>
        <br>Verificando en Firebase...
      `;

      // ==================== GUARDAR PEDIDO CONFIRMADO ====================
      if (usuarioActual) {
        const nuevoPedidoRef = push(ref(db, "pedidosOnline"));
        await set(nuevoPedidoRef, {
          idTemporal: pedidoId,
          total: totalPedido,
          estado: "confirmado",
          cliente: usuarioActual.email || "anónimo",
          creadoEn: Date.now(),
          items: [
            // Si tienes los productos del carrito, aquí podrías insertarlos dinámicamente
            { nombre: "Pedido Yape", cantidad: 1, precio: totalPedido, categoria: "plato" }
          ],
          verificacion: {
            monto: montoPagado,
            fecha: fechaMatch ? fechaMatch[1] : null,
            hora: horaMatch ? horaMatch[1] : null,
            verificado_en: new Date().toISOString()
          }
        });

        statusDiv.innerHTML += `
          <br><br>🎉 Pago verificado con éxito.<br>
          ✅ El pedido fue guardado en <b>pedidosOnline</b> y enviado a cocina.
        `;
      } else {
        statusDiv.innerHTML += `<br><br>⚠️ No hay usuario autenticado para registrar el pedido.`;
      }

    } catch (err) {
      console.error(err);
      statusDiv.textContent = "❌ Error al procesar la imagen: " + err.message;
    }

    verifyBtn.disabled = false;
  });
})();

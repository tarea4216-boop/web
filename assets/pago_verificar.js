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
let text = result.data.text.toLowerCase();

// Limpieza básica del OCR
text = text
  .replace(/§/g, "s")
  .replace(/sl/g, "s")
  .replace(/5\//g, "s/")
  .replace(/\$/g, "s")
  .replace(/s\s+\/?/g, "s/")
  .replace(/\s+/g, " ")
  .trim();

console.log("📝 Texto OCR procesado:", text);

// ===============================
// === VERIFICACIÓN DESTINATARIO ROBUSTA (YAPE 2026)
// ===============================

const normalizar = (str) =>
  str
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

const textoNormalizado = normalizar(text);

// 🔎 Función simple de similitud básica (tolerante a errores OCR)
function parecido(a, b) {
  if (!a || !b) return false;

  let errores = 0;
  for (let i = 0; i < Math.min(a.length, b.length); i++) {
    if (a[i] !== b[i]) errores++;
  }

  errores += Math.abs(a.length - b.length);

  // Permitir máximo 30% de error
  return errores <= Math.floor(b.length * 0.3);
}

const palabras = textoNormalizado.split(" ");

let encontradoNombre = false;
let encontradoApellido = false;

for (let palabra of palabras) {

  // 🔹 Validación nombre
  if (parecido(palabra, "dennys") || parecido(palabra, "denys")) {
    encontradoNombre = true;
  }

  // 🔹 Validación apellido (Ger*)
  if (
    palabra.length >= 3 &&
    (
      palabra.startsWith("ger") ||
      parecido(palabra.slice(0, 3), "ger")
    )
  ) {
    encontradoApellido = true;
  }
}

if (!(encontradoNombre && encontradoApellido)) {
  console.error("⛔ Destinatario incorrecto:", textoNormalizado);
  throw new Error(
    "El comprobante NO pertenece al destinatario correcto (Dennys Ger*)."
  );
}

console.log("✅ Destinatario verificado correctamente (modo OCR tolerante).");

// ===============================
// === DETECCIÓN DE MONTO ========
// ===============================

// Limpieza ya aplicada previamente en "text"

// Regex seguro que detecta: 
// s/3 — s/3.5 — s/3.50 — S/ 10 — S10 — S/.10 — etc
const regexMontoSeguro = /s[\/.]?\s*([0-9]+(?:\.[0-9]{1,2})?)/i;
let execMonto = regexMontoSeguro.exec(text);

let montoPagado = null;

// Plan B — detecta solo números sueltos
// PERO ahora también acepta enteros sin decimales
if (!execMonto) {
  execMonto = /\b([0-9]+(?:\.[0-9]{1,2})?)\b/.exec(text);
}

// Conversión
if (execMonto) {
  let num = execMonto[1];

  // Si detecta un entero sin decimales: "3" → 3.00
  if (/^[0-9]+$/.test(num)) {
    montoPagado = parseFloat(num + ".00");
  } else {
    montoPagado = parseFloat(num);
  }
}

// Filtro de rango válido
if (!montoPagado || isNaN(montoPagado) || montoPagado <= 0 || montoPagado > 1500) {
  montoPagado = null;
}

// ===============================
// === EVITAR FALSOS POSITIVOS ===
// ===============================

if (execMonto) {

  const alrededor = text.substring(execMonto.index - 6, execMonto.index + 6);

  // 1. Evitar confundir hora con monto
  if (/^\d{1,2}\.\d{2}$/.test(execMonto[1]) && /\d{1,2}:\d{2}/.test(alrededor)) {
    console.warn("⛔ Monto confundido con hora → descartado");
    montoPagado = null;
  }

  // 2. Evitar códigos de operación (5+ dígitos)
  if (execMonto[1].length >= 5 && /^\d{5,}$/.test(execMonto[1])) {
    console.warn("⛔ Detectado código de operación en vez de monto → descartado");
    montoPagado = null;
  }
}

// Validación final
if (!montoPagado) {
  throw new Error("No se detectó un monto válido en el comprobante.");
}

if (montoPagado < totalPedido) {
  throw new Error(`Monto insuficiente. Detectado: S/${montoPagado.toFixed(2)}`);
}

console.log("💰 Monto detectado:", montoPagado);


// ===============================
// === DETECCIÓN DE HORA =========
// ===============================

// Buscar hora con o sin AM/PM
let horaMatchAMPM = text.match(/\b([01]?\d|2[0-3]):([0-5]\d)\s*(am|pm)\b/);
let horaMatch     = text.match(/\b([01]?\d|2[0-3]):([0-5]\d)\b/);

let horaPago = null;

if (horaMatchAMPM) horaPago = horaMatchAMPM[0].trim();
else if (horaMatch) horaPago = horaMatch[0].trim();

if (!horaPago) {
  throw new Error("No se encontró la hora del pago en el comprobante.");
}

// Conversión
function convertirHora(hora) {
  const ampm = hora.includes("am") || hora.includes("pm");
  let [h, m] = hora.replace(/am|pm/, "").trim().split(":").map(Number);

  if (ampm) {
    const esPM = hora.includes("pm");
    if (esPM && h < 12) h += 12;
    if (!esPM && h === 12) h = 0;
  }

  return h * 60 + m;
}

const minutosPago = convertirHora(horaPago);
const ahora = new Date();
const minutosAhora = ahora.getHours() * 60 + ahora.getMinutes();
const diferencia = Math.abs(minutosAhora - minutosPago);

// Permitir rango ±45 min como Yape real
if (diferencia > 45) {
  throw new Error(`La hora del pago (${horaPago}) no coincide con el pedido.`);
}

console.log("⏱ Hora detectada:", horaPago);


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

    // === Registrar venta en SUPABASE (CON CANTIDADES REALES) ===

// Convertir carrito a estructura limpia
const productosProcesados = carrito.map(item => ({
  nombre: item.nombre,
  cantidad: Number(item.qty),
  precio_unitario: Number(item.precio),
  subtotal: Number(item.qty) * Number(item.precio)
}));

const { error: insertError } = await supabase.from('ventas').insert([{
  id_pedido: pedidoId,
  cliente: clienteNombre,
  total: totalPedido,
  productos: productosProcesados,
  fecha: new Date().toISOString()
}]);

if (insertError) {
  console.error("⚠ Error guardando venta en Supabase:", insertError);
  throw insertError;
}

console.log("✅ Venta registrada correctamente en Supabase con cantidades correctas");


 // === Generar PDF premium ===
const { jsPDF } = window.jspdf;
const doc = new jsPDF("p", "mm", "a4");

// ================================
// 🟨 CABECERA PREMIUM
// ================================
doc.setFillColor(255, 184, 28); // dorado suave
doc.rect(0, 0, 210, 32, "F");

// Logo opcional (si tienes base64)
// doc.addImage(logoBase64, "PNG", 10, 5, 22, 22);

doc.setFont("helvetica", "bold");
doc.setFontSize(22);
doc.setTextColor(50, 32, 0);
doc.text("El Camarón de Oro", 15, 20);

doc.setFontSize(12);
doc.setFont("helvetica", "normal");
doc.text("Comprobante de Pedido", 195, 20, { align: "right" });

// Línea elegante
doc.setDrawColor(180, 180, 180);
doc.line(10, 36, 200, 36);

// ================================
// 📝 INFORMACIÓN DEL CLIENTE
// ================================
let y = 48;
doc.setTextColor(60, 60, 60);
doc.setFontSize(12);

const secciones = [
  `ID Pedido: ${pedidoId}`,
  `Fecha: ${new Date().toLocaleString()}`,
  `Cliente: ${clienteNombre}`,
  `Celular: ${clienteCelular}`
];
if (clienteReferencia) secciones.push(`Referencia: ${clienteReferencia}`);

secciones.forEach(t => {
  doc.text(t, 15, y);
  y += 7;
});

// Separador fino
doc.setDrawColor(220, 220, 220);
doc.line(10, y + 4, 200, y + 4);
y += 15;

// ================================
// 🍽️ DETALLE DE ITEMS
// ================================
doc.setFont("helvetica", "bold");
doc.setFontSize(14);
doc.setTextColor(40, 40, 40);
doc.text("Detalle del Pedido", 15, y);
y += 10;

// Encabezados
doc.setFontSize(12);
doc.text("Producto", 15, y);
doc.text("Cantidad", 115, y);
doc.text("Subtotal", 170, y, { align: "right" });
y += 5;

// Línea debajo de títulos
doc.setDrawColor(180, 180, 180);
doc.line(10, y, 200, y);
y += 7;

// Items
doc.setFont("helvetica", "normal");
doc.setFontSize(11);
carrito.forEach(it => {
  doc.text(it.nombre, 15, y);
  doc.text(String(it.qty), 120, y);
  doc.text(`S/ ${(it.precio * it.qty).toFixed(2)}`, 195, y, { align: "right" });
  y += 7;
});

// ================================
// 💳 TOTAL DESTACADO PREMIUM
// ================================
y += 10;

// Caja resaltada
doc.setFillColor(255, 236, 180); // dorado suave claro
doc.roundedRect(10, y, 190, 14, 3, 3, "F");

doc.setFont("helvetica", "bold");
doc.setFontSize(14);
doc.setTextColor(60, 40, 0);
doc.text(`TOTAL:  S/ ${totalPedido.toFixed(2)}`, 20, y + 10);

// ================================
// ❤️ PIE DE PÁGINA
// ================================
doc.setFontSize(11);
doc.setFont("helvetica", "normal");
doc.setTextColor(100, 100, 100);
doc.text(
  "Gracias por confiar en nosotros ❤️\nEl Camarón de Oro – Sabor que te acompaña",
  15,
  275
);

// ================================
// 📄 GUARDAR
// ================================
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

        const adminLink = `https://admin-validar.onrender.com/index.html?token=${token}`;

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

        const btnWhatsApp = document.getElementById("btn-whatsapp");
        btnWhatsApp.addEventListener("click", () => {
          window.open(whatsappURL, "_blank");
          if (window.bloquearMapaPago) window.bloquearMapaPago();
          showToast("📱 Pedido enviado por WhatsApp para validación manual.", "info");
          qrContainer.innerHTML = `
            <h3>📱 Pedido enviado a validación manual</h3>
            <p>Tu comprobante fue enviado por WhatsApp al área administrativa.</p>
            <p>Te confirmarán el pedido en breve.</p>
            <p><b>Cliente:</b> ${clienteNombre}<br>
               <b>Celular:</b> ${clienteCelular}<br>
               <b>Referencia:</b> ${clienteReferencia || "—"}<br>
               <b>Total:</b> S/ ${totalPedido.toFixed(2)}</p>
          `;
        });

        verifyBtn.disabled = true;
      }
    }
  });
};

// Inicializar automáticamente
window.initPagoVerificar();










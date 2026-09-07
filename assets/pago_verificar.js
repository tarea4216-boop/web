import { supabase } from './supabaseClient.js';

window.initPagoVerificar = async function () {

  const qrContainer = document.getElementById('qr');
  if (!qrContainer) return;

  const db = firebase.database();
  const auth = firebase.auth();

  // =========================================================
  // === UI DE CARGA
  // =========================================================

  const uploadContainer = document.createElement('div');

  uploadContainer.innerHTML = `
    <h4>📸 Subir comprobante de pago</h4>

    <p>
      Por favor, sube la captura del pago realizado en Yape o BCP.
    </p>

    <input
      type="file"
      id="capture-input"
      accept="image/*"
      style="margin-top:8px;"
    >

    <button
      id="verify-btn"
      class="btn primary"
      style="margin-top:10px;"
    >
      Verificar pago
    </button>

    <div
      id="verify-status"
      style="margin-top:1rem;font-weight:bold;"
    ></div>
  `;

  qrContainer.appendChild(uploadContainer);

  // =========================================================
  // === REFERENCIAS
  // =========================================================

  const inputFile = document.getElementById('capture-input');
  const verifyBtn = document.getElementById('verify-btn');
  const statusDiv = document.getElementById('verify-status');

  let selectedFile = null;
  let intentosFallidos = 0;

  inputFile.addEventListener('change', e => {
    selectedFile = e.target.files[0];
  });

  // =========================================================
  // === DATOS DEL PEDIDO
  // =========================================================

  const pedidoId =
    qrContainer.dataset.pedidoId ||
    `pedido-${Date.now()}`;

  const totalPedido =
    parseFloat(qrContainer.dataset.total || "0");

  const carrito =
    JSON.parse(qrContainer.dataset.cart || "[]");

  const lat =
    parseFloat(qrContainer.dataset.lat);

  const lng =
    parseFloat(qrContainer.dataset.lng);

  const clienteNombre =
    qrContainer.dataset.nombre || "Sin nombre";

  const clienteCelular =
    qrContainer.dataset.celular || "Sin celular";

  const clienteReferencia =
    qrContainer.dataset.referencia || "";

  const clienteUid =
    qrContainer.dataset.uid || "anónimo";


  // =========================================================
  // === MOMENTO EN QUE SE CREÓ EL PEDIDO
  // =========================================================
  //
  // Si pago.html ya proporciona:
  //
  // data-creado-en="TIMESTAMP"
  //
  // se utilizará ese timestamp.
  //
  // Si todavía no lo proporciona, usamos el momento actual
  // como respaldo.
  //
  // =========================================================

  const pedidoCreadoTs =
    Number(
      qrContainer.dataset.creadoEn ||
      qrContainer.dataset.fechaPedido ||
      Date.now()
    );


  // =========================================================
  // === CONFIGURACIÓN DE VERIFICACIÓN
  // =========================================================

  const CONFIG_VERIFICACION = {

    // Diferencia máxima entre pago y creación del pedido
    maxMinutosPago: 45,

    // Puntaje mínimo para aprobar automáticamente
    puntajeMinimo: 85,

    // Últimos dígitos del número receptor de Yape.
    //
    // IMPORTANTE:
    // Cambia "773" si tu número receptor cambia.
    //
    ultimosDigitosYape: "773"
  };


  // =========================================================
  // === GUARDAR PEDIDO PENDIENTE
  // =========================================================

  async function guardarPedidoPendiente(token) {

    const ref =
      db
        .ref("pedidosPendientesValidacion")
        .child(`validacion-${token}`);

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

      ubicacion: {
        lat,
        lng
      },

      items: carrito,

      metodo_pago: "Yape/BCP"
    });

    console.log(
      "📦 Pedido guardado en pedidosPendientesValidacion:",
      token
    );
  }


  // =========================================================
  // === NORMALIZAR TEXTO
  // =========================================================

  function normalizar(str) {

    return String(str || "")
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9\s]/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  }


  // =========================================================
  // === SIMILITUD OCR
  // =========================================================

  function parecido(a, b) {

    if (!a || !b) return false;

    a = normalizar(a);
    b = normalizar(b);

    if (!a || !b) return false;

    // Coincidencia directa
    if (a === b) return true;

    // Si una palabra está contenida en la otra
    if (
      a.length >= 4 &&
      b.length >= 4 &&
      (a.includes(b) || b.includes(a))
    ) {
      return true;
    }

    let errores = 0;

    const longitudMinima =
      Math.min(a.length, b.length);

    for (
      let i = 0;
      i < longitudMinima;
      i++
    ) {

      if (a[i] !== b[i]) {
        errores++;
      }
    }

    errores +=
      Math.abs(a.length - b.length);

    const porcentajeError =
      errores /
      Math.max(a.length, b.length);

    return porcentajeError <= 0.30;
  }


  // =========================================================
  // === VERIFICAR DESTINATARIO
  // =========================================================

  function verificarDestinatario(texto) {

    const textoNormalizado =
      normalizar(texto);

    const palabras =
      textoNormalizado.split(" ");

    let encontradoNombre = false;
    let encontradoApellido = false;

    for (const palabra of palabras) {

      // -----------------------------------------------
      // NOMBRE
      // -----------------------------------------------

      if (
        parecido(palabra, "dennys") ||
        parecido(palabra, "denys")
      ) {
        encontradoNombre = true;
      }

      // -----------------------------------------------
      // APELLIDO
      // Ger*
      // -----------------------------------------------

      if (
        palabra.length >= 3 &&
        (
          palabra.startsWith("ger") ||
          parecido(
            palabra.substring(0, 3),
            "ger"
          )
        )
      ) {
        encontradoApellido = true;
      }
    }

    return {
      valido:
        encontradoNombre &&
        encontradoApellido,

      nombre:
        encontradoNombre,

      apellido:
        encontradoApellido
    };
  }


  // =========================================================
  // === DETECCIÓN DE MONTO
  // =========================================================
  //
  // Acepta:
  //
  // S/1
  // S/ 1
  // S/1.5
  // S/1.50
  // S/.1
  // S/. 1.50
  // S 1
  //
  // También acepta coma decimal.
  //
  // IMPORTANTE:
  // NO buscamos números sueltos como fallback.
  // =========================================================

  function detectarMonto(texto) {

    const regexMonto =
      /(?:s\s*\/\s*\.?|s\s*\.|soles?)\s*([0-9]+(?:[.,][0-9]{1,2})?)/i;

    const match =
      regexMonto.exec(texto);

    if (!match) {
      return null;
    }

    let valor =
      match[1]
        .replace(",", ".");

    const monto =
      parseFloat(valor);

    if (
      isNaN(monto) ||
      monto <= 0 ||
      monto > 1500
    ) {
      return null;
    }

    return monto;
  }


  // =========================================================
  // === PERSONAJES HISTÓRICOS DE YAPE
  // =========================================================

  const personajesYape = [

    {
      min: 0.10,
      max: 19.99,

      nombre:
        "José Abelardo Quiñones",

      variantes: [
        "jose abelardo quinones",
        "jose quinones",
        "abelardo quinones",
        "jose quinones gonzales",
        "quinones"
      ]
    },

    {
      min: 20.00,
      max: 49.99,

      nombre:
        "Miguel Grau",

      variantes: [
        "miguel grau",
        "grau"
      ]
    },

    {
      min: 50.00,
      max: 99.99,

      nombre:
        "Abraham Valdelomar",

      variantes: [
        "abraham valdelomar",
        "valdelomar"
      ]
    },

    {
      min: 100.00,
      max: 199.99,

      nombre:
        "Pedro Paulet",

      variantes: [
        "pedro paulet",
        "paulet"
      ]
    },

    {
      min: 200.00,
      max: 500.00,

      nombre:
        "Santa Rosa de Lima",

      variantes: [
        "santa rosa de lima",
        "santa rosa",
        "rosa de lima"
      ]
    }
  ];


  // =========================================================
  // === OBTENER PERSONAJE SEGÚN MONTO
  // =========================================================

  function obtenerPersonajePorMonto(monto) {

    if (!monto) {
      return null;
    }

    return personajesYape.find(
      personaje =>
        monto >= personaje.min &&
        monto <= personaje.max
    ) || null;
  }


  // =========================================================
  // === DETECTAR PERSONAJE EN OCR
  // =========================================================

  function detectarPersonaje(texto) {

    const textoNormalizado =
      normalizar(texto);

    for (
      const personaje of personajesYape
    ) {

      for (
        const variante of personaje.variantes
      ) {

        const varianteNormalizada =
          normalizar(variante);

        if (
          textoNormalizado.includes(
            varianteNormalizada
          )
        ) {

          return personaje;
        }
      }
    }

    return null;
  }


  // =========================================================
  // === DETECTAR FECHA
  // =========================================================

  const mesesYape = {

    ene: 0,
    enero: 0,

    feb: 1,
    febrero: 1,

    mar: 2,
    marzo: 2,

    abr: 3,
    abril: 3,

    may: 4,
    mayo: 4,

    jun: 5,
    junio: 5,

    jul: 6,
    julio: 6,

    ago: 7,
    agosto: 7,

    sep: 8,
    septiembre: 8,

    set: 8,
    setiembre: 8,

    oct: 9,
    octubre: 9,

    nov: 10,
    noviembre: 10,

    dic: 11,
    diciembre: 11
  };


  function detectarFecha(texto) {

    // =====================================================
    // FORMATO:
    //
    // 06 set. 2026
    // 06 sep. 2026
    // 06 septiembre 2026
    // =====================================================

    const regexTexto =
      /\b(\d{1,2})\s+(ene(?:ro)?|feb(?:rero)?|mar(?:zo)?|abr(?:il)?|may(?:o)?|jun(?:io)?|jul(?:io)?|ago(?:sto)?|sep(?:tiembre)?|set(?:iembre)?|oct(?:ubre)?|nov(?:iembre)?|dic(?:iembre)?)\.?\s+(\d{4})\b/i;

    const matchTexto =
      texto.match(regexTexto);

    if (matchTexto) {

      const dia =
        parseInt(matchTexto[1]);

      const mesTexto =
        matchTexto[2]
          .toLowerCase();

      const anio =
        parseInt(matchTexto[3]);

      const mes =
        mesesYape[mesTexto];

      if (
        mes === undefined
      ) {
        return null;
      }

      const fecha =
        new Date(
          anio,
          mes,
          dia
        );

      if (
        fecha.getFullYear() !== anio ||
        fecha.getMonth() !== mes ||
        fecha.getDate() !== dia
      ) {
        return null;
      }

      return fecha;
    }


    // =====================================================
    // FORMATO:
    //
    // 06/09/2026
    // 06-09-2026
    // =====================================================

    const regexNumerica =
      /\b(\d{1,2})[\/-](\d{1,2})[\/-](\d{4})\b/;

    const matchNumerica =
      texto.match(regexNumerica);

    if (matchNumerica) {

      const dia =
        parseInt(matchNumerica[1]);

      const mes =
        parseInt(matchNumerica[2]) - 1;

      const anio =
        parseInt(matchNumerica[3]);

      const fecha =
        new Date(
          anio,
          mes,
          dia
        );

      if (
        fecha.getFullYear() !== anio ||
        fecha.getMonth() !== mes ||
        fecha.getDate() !== dia
      ) {
        return null;
      }

      return fecha;
    }


    return null;
  }


  // =========================================================
  // === DETECTAR HORA
  // =========================================================
  //
  // Acepta:
  //
  // 09:15 p. m.
  // 09:15 pm
  // 9:15 p.m.
  // 21:15
  //
  // =========================================================

  function detectarHora(texto) {

    // -----------------------------------------------------
    // 12 horas
    // -----------------------------------------------------

    const regex12 =
      /\b(0?[1-9]|1[0-2])\s*:\s*([0-5]\d)\s*(a\.?\s*m\.?|p\.?\s*m\.?|am|pm)\b/i;

    const match12 =
      texto.match(regex12);

    if (match12) {

      let hora =
        parseInt(match12[1]);

      const minutos =
        parseInt(match12[2]);

      const periodo =
        match12[3]
          .toLowerCase()
          .replace(/\./g, "")
          .replace(/\s/g, "");

      if (periodo === "pm" && hora < 12) {
        hora += 12;
      }

      if (periodo === "am" && hora === 12) {
        hora = 0;
      }

      return {
        texto: match12[0].trim(),

        hora,

        minutos,

        totalMinutos:
          hora * 60 + minutos
      };
    }


    // -----------------------------------------------------
    // 24 horas
    // -----------------------------------------------------

    const regex24 =
      /\b([01]?\d|2[0-3])\s*:\s*([0-5]\d)\b/;

    const match24 =
      texto.match(regex24);

    if (match24) {

      const hora =
        parseInt(match24[1]);

      const minutos =
        parseInt(match24[2]);

      return {
        texto: match24[0].trim(),

        hora,

        minutos,

        totalMinutos:
          hora * 60 + minutos
      };
    }


    return null;
  }


  // =========================================================
  // === DETECTAR CÓDIGO DE SEGURIDAD
  // =========================================================

  function detectarCodigoSeguridad(texto) {

    const regex =
      /c[oó]digo\s+de\s+seguridad\s*[:\-]?\s*(\d{3,6})/i;

    const match =
      texto.match(regex);

    if (!match) {
      return null;
    }

    return match[1];
  }


  // =========================================================
  // === DETECTAR NÚMERO DE OPERACIÓN
  // =========================================================

  function detectarNumeroOperacion(texto) {

    const regex =
      /(?:nro\.?|número|numero)\s*(?:de)?\s*operaci[oó]n\s*[:\-]?\s*(\d{5,20})/i;

    const match =
      texto.match(regex);

    if (!match) {
      return null;
    }

    return match[1];
  }


  // =========================================================
  // === DETECTAR CELULAR DESTINO
  // =========================================================

  function detectarUltimosDigitosCelular(texto) {

    // Ejemplo:
    //
    // *** *** 773
    //

    const regex =
      /\*{2,}\s+\*{2,}\s+(\d{3,4})\b/;

    const match =
      texto.match(regex);

    if (!match) {
      return null;
    }

    return match[1];
  }


  // =========================================================
  // === CONVERTIR HORA + FECHA EN DATETIME
  // =========================================================

  function crearFechaHoraPago(
    fecha,
    hora
  ) {

    if (!fecha || !hora) {
      return null;
    }

    const resultado =
      new Date(fecha);

    resultado.setHours(
      hora.hora,
      hora.minutos,
      0,
      0
    );

    return resultado;
  }


  // =========================================================
  // === DIFERENCIA DE MINUTOS
  // =========================================================

  function diferenciaMinutos(
    fecha1,
    fecha2
  ) {

    if (!fecha1 || !fecha2) {
      return Infinity;
    }

    return Math.abs(
      fecha1.getTime() -
      fecha2.getTime()
    ) / 60000;
  }


  // =========================================================
  // === FORMATEAR FECHA
  // =========================================================

  function formatearFecha(fecha) {

    if (!fecha) {
      return null;
    }

    return fecha.toLocaleDateString(
      "es-PE",
      {
        day: "2-digit",
        month: "2-digit",
        year: "numeric"
      }
    );
  }


  // =========================================================
  // === PROCESAMIENTO PRINCIPAL
  // =========================================================

  verifyBtn.addEventListener(
    'click',
    async () => {

      if (!selectedFile) {

        showToast(
          "⚠️ Selecciona una imagen del comprobante.",
          "info"
        );

        return;
      }


      statusDiv.textContent =
        "⏳ Analizando comprobante Yape...";

      verifyBtn.disabled = true;


      try {

        // ===================================================
        // === OCR
        // ===================================================

        const result =
          await Tesseract.recognize(
            selectedFile,
            'spa'
          );

        let text =
          result.data.text || "";


        // ===================================================
        // === LIMPIEZA OCR
        // ===================================================

        text =
          text

            // Errores comunes del OCR
            .replace(/§/g, "S")
            .replace(/\$/g, "S")
            .replace(/\bsl\b/gi, "S")
            .replace(/5\//g, "S/")
            .replace(/S\s*\/\s*\./gi, "S/")

            // Espacios
            .replace(/\r?\n/g, " ")
            .replace(/\s+/g, " ")

            .trim();


        console.log(
          "📝 TEXTO OCR ORIGINAL:",
          result.data.text
        );

        console.log(
          "📝 TEXTO OCR PROCESADO:",
          text
        );


        // ===================================================
        // === NIVEL DE CONFIANZA OCR
        // ===================================================

        const confianzaOCR =
          Number(
            result.data.confidence || 0
          );

        console.log(
          "📊 Confianza OCR:",
          confianzaOCR
        );


        // ===================================================
        // === 1. DESTINATARIO
        // ===================================================

        const destinatario =
          verificarDestinatario(text);


        console.log(
          "👤 Destinatario:",
          destinatario
        );


        if (!destinatario.valido) {

          throw new Error(
            "El comprobante no pertenece al destinatario correcto (Dennys Ger*)."
          );
        }


        console.log(
          "✅ Destinatario correcto."
        );


        // ===================================================
        // === 2. MONTO
        // ===================================================

        const montoPagado =
          detectarMonto(text);


        if (!montoPagado) {

          throw new Error(
            "No se pudo detectar correctamente el monto del comprobante."
          );
        }


        console.log(
          "💰 Monto detectado:",
          montoPagado
        );


        // ===================================================
        // === COMPARAR MONTO
        // ===================================================

        const diferenciaMonto =
          montoPagado - totalPedido;


        // Permitimos pequeñas diferencias por redondeo OCR
        const montoSuficiente =
          diferenciaMonto >= -0.005;


        if (!montoSuficiente) {

          throw new Error(
            `Monto insuficiente. Detectado: S/${montoPagado.toFixed(2)}. Pedido: S/${totalPedido.toFixed(2)}`
          );
        }


        console.log(
          "✅ Monto suficiente."
        );


        // ===================================================
        // === 3. PERSONAJE HISTÓRICO
        // ===================================================

        const personajeEsperado =
          obtenerPersonajePorMonto(
            montoPagado
          );


        const personajeDetectado =
          detectarPersonaje(text);


        console.log(
          "👤 Personaje esperado:",
          personajeEsperado
            ? personajeEsperado.nombre
            : "Ninguno"
        );

        console.log(
          "👤 Personaje detectado:",
          personajeDetectado
            ? personajeDetectado.nombre
            : "No detectado"
        );


        let personajeCoincide =
          null;


        if (
          personajeDetectado &&
          personajeEsperado
        ) {

          personajeCoincide =
            normalizar(
              personajeDetectado.nombre
            ) ===
            normalizar(
              personajeEsperado.nombre
            );
        }


        // ===================================================
        // === 4. FECHA
        // ===================================================

        const fechaPago =
          detectarFecha(text);


        console.log(
          "📅 Fecha detectada:",
          fechaPago
            ? fechaPago.toLocaleDateString("es-PE")
            : "No detectada"
        );


        // ===================================================
        // === 5. HORA
        // ===================================================

        const horaPago =
          detectarHora(text);


        console.log(
          "⏰ Hora detectada:",
          horaPago
            ? horaPago.texto
            : "No detectada"
        );


        // ===================================================
        // === FECHA + HORA DEL PAGO
        // ===================================================

        const fechaHoraPago =
          crearFechaHoraPago(
            fechaPago,
            horaPago
          );


        const fechaHoraPedido =
          new Date(
            pedidoCreadoTs
          );


        let diferenciaPagoMinutos =
          Infinity;


        if (
          fechaHoraPago &&
          !isNaN(
            fechaHoraPago.getTime()
          )
        ) {

          diferenciaPagoMinutos =
            diferenciaMinutos(
              fechaHoraPago,
              fechaHoraPedido
            );
        }


        console.log(
          "🕐 Fecha/hora pedido:",
          fechaHoraPedido.toLocaleString("es-PE")
        );

        console.log(
          "🕐 Fecha/hora pago:",
          fechaHoraPago
            ? fechaHoraPago.toLocaleString("es-PE")
            : "No disponible"
        );

        console.log(
          "⏱ Diferencia:",
          diferenciaPagoMinutos,
          "minutos"
        );


        // ===================================================
        // === VALIDACIÓN DE FECHA
        // ===================================================

        let fechaCoincide =
          null;


        if (fechaPago) {

          fechaCoincide =
            fechaPago.getFullYear() ===
              fechaHoraPedido.getFullYear() &&

            fechaPago.getMonth() ===
              fechaHoraPedido.getMonth() &&

            fechaPago.getDate() ===
              fechaHoraPedido.getDate();
        }


        // ===================================================
        // === VALIDACIÓN DE FECHA + HORA
        // ===================================================

        let horaCoincide =
          null;


        if (
          fechaHoraPago &&
          !isNaN(
            fechaHoraPago.getTime()
          )
        ) {

          horaCoincide =
            diferenciaPagoMinutos <=
            CONFIG_VERIFICACION.maxMinutosPago;
        }


        // ===================================================
        // === 6. CÓDIGO DE SEGURIDAD
        // ===================================================

        const codigoSeguridad =
          detectarCodigoSeguridad(text);


        console.log(
          "🔐 Código de seguridad:",
          codigoSeguridad || "No detectado"
        );


        // ===================================================
        // === 7. NÚMERO DE OPERACIÓN
        // ===================================================

        const numeroOperacion =
          detectarNumeroOperacion(text);


        console.log(
          "🧾 N.º operación:",
          numeroOperacion || "No detectado"
        );


        // ===================================================
        // === 8. CELULAR DESTINO
        // ===================================================

        const ultimosDigitos =
          detectarUltimosDigitosCelular(
            text
          );


        console.log(
          "📱 Últimos dígitos destino:",
          ultimosDigitos || "No detectados"
        );


        let celularCoincide =
          null;


        if (ultimosDigitos) {

          celularCoincide =
            ultimosDigitos.endsWith(
              CONFIG_VERIFICACION
                .ultimosDigitosYape
            );
        }


        // ===================================================
        // === SISTEMA DE PUNTUACIÓN
        // ===================================================
        //
        // DESTINATARIO 35
        // MONTO        35
        // FECHA        10
        // HORA         10
        // PERSONAJE     5
        // OPERACIÓN     3
        // SEGURIDAD     2
        //
        // TOTAL        100
        //
        // ===================================================

        let puntaje = 0;

        const observaciones = [];


        // ---------------------------------------------------
        // DESTINATARIO
        // ---------------------------------------------------

        if (destinatario.valido) {

          puntaje += 35;

          observaciones.push(
            "✅ Destinatario correcto"
          );
        }


        // ---------------------------------------------------
        // MONTO
        // ---------------------------------------------------

        if (montoSuficiente) {

          puntaje += 35;

          observaciones.push(
            "✅ Monto correcto"
          );
        }


        // ---------------------------------------------------
        // FECHA
        // ---------------------------------------------------

        if (fechaCoincide === true) {

          puntaje += 10;

          observaciones.push(
            "✅ Fecha correcta"
          );

        } else if (fechaCoincide === false) {

          puntaje -= 20;

          observaciones.push(
            "❌ Fecha no coincide"
          );

        } else {

          observaciones.push(
            "⚠️ Fecha no legible"
          );
        }


        // ---------------------------------------------------
        // HORA
        // ---------------------------------------------------

        if (horaCoincide === true) {

          puntaje += 10;

          observaciones.push(
            "✅ Hora correcta"
          );

        } else if (horaCoincide === false) {

          puntaje -= 20;

          observaciones.push(
            "❌ Hora no coincide"
          );

        } else {

          observaciones.push(
            "⚠️ Hora no legible"
          );
        }


        // ---------------------------------------------------
        // PERSONAJE
        // ---------------------------------------------------

        if (personajeCoincide === true) {

          puntaje += 5;

          observaciones.push(
            `✅ Personaje correcto: ${personajeDetectado.nombre}`
          );

        } else if (personajeCoincide === false) {

          // IMPORTANTE:
          // No rechazamos inmediatamente.
          // Solo penalizamos.

          puntaje -= 20;

          observaciones.push(
            `⚠️ Personaje inconsistente. Esperado: ${personajeEsperado?.nombre || "N/A"} | Detectado: ${personajeDetectado?.nombre || "N/A"}`
          );

        } else {

          observaciones.push(
            "⚠️ Personaje no legible"
          );
        }


        // ---------------------------------------------------
        // NÚMERO DE OPERACIÓN
        // ---------------------------------------------------

        if (numeroOperacion) {

          puntaje += 3;

          observaciones.push(
            "✅ N.º de operación detectado"
          );

        } else {

          observaciones.push(
            "⚠️ N.º de operación no legible"
          );
        }


        // ---------------------------------------------------
        // CÓDIGO DE SEGURIDAD
        // ---------------------------------------------------

        if (codigoSeguridad) {

          puntaje += 2;

          observaciones.push(
            "✅ Código de seguridad detectado"
          );

        } else {

          observaciones.push(
            "⚠️ Código de seguridad no legible"
          );
        }


        // ===================================================
        // === CELULAR
        // ===================================================
        //
        // No forma parte del puntaje principal porque puede
        // no aparecer claramente en una captura.
        //
        // Si se detecta y contradice, lo consideramos alerta.
        // ===================================================

        if (celularCoincide === false) {

          puntaje -= 15;

          observaciones.push(
            "⚠️ El número de destino no coincide"
          );

        } else if (celularCoincide === true) {

          observaciones.push(
            "✅ Número de destino coincide"
          );
        }


        // ===================================================
        // === EVITAR PUNTAJE NEGATIVO
        // ===================================================

        puntaje =
          Math.max(
            0,
            Math.min(100, puntaje)
          );


        console.log(
          "===================================="
        );

        console.log(
          "📊 RESULTADO DE VERIFICACIÓN"
        );

        console.log(
          "===================================="
        );

        console.log(
          "Puntaje:",
          puntaje,
          "/ 100"
        );

        console.log(
          "Confianza OCR:",
          confianzaOCR
        );

        console.log(
          observaciones
        );


        // ===================================================
        // === REGLAS DE RECHAZO FUERTE
        // ===================================================
        //
        // Estas condiciones sí son importantes.
        // =====================================================

        if (!destinatario.valido) {

          throw new Error(
            "El destinatario del comprobante no coincide."
          );
        }


        if (!montoSuficiente) {

          throw new Error(
            `Monto insuficiente. Detectado: S/${montoPagado.toFixed(2)}`
          );
        }


        // Si el personaje fue detectado claramente y NO
        // corresponde al monto, no aprobamos automáticamente.

        if (
          personajeCoincide === false
        ) {

          throw new Error(
            `El personaje histórico detectado (${personajeDetectado.nombre}) no corresponde al monto S/${montoPagado.toFixed(2)}.`
          );
        }


        // Si la fecha fue detectada y no coincide,
        // no aprobar.

        if (
          fechaCoincide === false
        ) {

          throw new Error(
            `La fecha del pago (${formatearFecha(fechaPago)}) no corresponde a la fecha del pedido.`
          );
        }


        // Si tenemos fecha + hora y están fuera del rango.

        if (
          fechaHoraPago &&
          horaCoincide === false
        ) {

          throw new Error(
            `La fecha/hora del pago (${horaPago.texto}) no coincide con el momento del pedido.`
          );
        }


        // Si el celular está claramente visible pero no coincide.

        if (
          celularCoincide === false
        ) {

          throw new Error(
            "El número de destino del comprobante no coincide con el número registrado."
          );
        }


        // ===================================================
        // === DECISIÓN FINAL
        // ===================================================

        if (
          puntaje <
          CONFIG_VERIFICACION.puntajeMinimo
        ) {

          throw new Error(
            `No se pudo verificar el comprobante con suficiente confianza. Puntaje: ${puntaje}/100.`
          );
        }


        // ===================================================
        // === PAGO APROBADO
        // ===================================================

        console.log(
          "🎉 PAGO APROBADO AUTOMÁTICAMENTE"
        );


        // ===================================================
        // === PEDIDO CORRECTO
        // ===================================================

        const refNuevo =
          db
            .ref("pedidosOnline")
            .push();


        await refNuevo.set({

          idTemporal:
            clienteUid,

          total:
            totalPedido,

          estado:
            "confirmado",

          tipo_pedido:
            "online",

          cliente: {

            uid:
              clienteUid,

            nombre:
              clienteNombre,

            celular:
              clienteCelular,

            referencia:
              clienteReferencia
          },

          creadoEn:
            Date.now(),

          ubicacion: {

            lat,
            lng
          },

          items:
            carrito,

          metodo_pago:
            "Yape/BCP",


          // =================================================
          // === INFORMACIÓN DE VERIFICACIÓN
          // =================================================

          verificacion: {

            monto:
              montoPagado,

            fecha:
              fechaPago
                ? fechaPago.toISOString()
                : null,

            fecha_formateada:
              fechaPago
                ? formatearFecha(fechaPago)
                : null,

            hora:
              horaPago
                ? horaPago.texto
                : null,

            codigo_seguridad:
              codigoSeguridad || null,

            numero_operacion:
              numeroOperacion || null,

            personaje_esperado:
              personajeEsperado
                ? personajeEsperado.nombre
                : null,

            personaje_detectado:
              personajeDetectado
                ? personajeDetectado.nombre
                : null,

            personaje_coincide:
              personajeCoincide,

            celular_destino:
              ultimosDigitos || null,

            celular_coincide:
              celularCoincide,

            puntaje:
              puntaje,

            confianza_ocr:
              confianzaOCR,

            diferencia_minutos:
              isFinite(diferenciaPagoMinutos)
                ? Math.round(
                    diferenciaPagoMinutos
                  )
                : null,

            verificado_en:
              new Date().toISOString()
          }
        });


        console.log(
          "✅ Pedido guardado correctamente en Firebase"
        );


        // ===================================================
        // === REGISTRAR VENTA EN SUPABASE
        // ===================================================

        const productosProcesados =
          carrito.map(item => ({

            nombre:
              item.nombre,

            cantidad:
              Number(item.qty),

            precio_unitario:
              Number(item.precio),

            subtotal:
              Number(item.qty) *
              Number(item.precio)
          }));


        const {
          error: insertError
        } =
          await supabase
            .from('ventas')
            .insert([{

              id_pedido:
                pedidoId,

              cliente:
                clienteNombre,

              total:
                totalPedido,

              productos:
                productosProcesados,

              fecha:
                new Date().toISOString()
            }]);


        if (insertError) {

          console.error(
            "⚠ Error guardando venta en Supabase:",
            insertError
          );

          throw insertError;
        }


        console.log(
          "✅ Venta registrada correctamente en Supabase con cantidades correctas"
        );


        // ===================================================
        // === GENERAR PDF PREMIUM
        // ===================================================

        const { jsPDF } =
          window.jspdf;

        const doc =
          new jsPDF(
            "p",
            "mm",
            "a4"
          );


        // ===================================================
        // CABECERA
        // ===================================================

        doc.setFillColor(
          255,
          184,
          28
        );

        doc.rect(
          0,
          0,
          210,
          32,
          "F"
        );


        doc.setFont(
          "helvetica",
          "bold"
        );

        doc.setFontSize(22);

        doc.setTextColor(
          50,
          32,
          0
        );

        doc.text(
          "El Camarón de Oro",
          15,
          20
        );


        doc.setFontSize(12);

        doc.setFont(
          "helvetica",
          "normal"
        );

        doc.text(
          "Comprobante de Pedido",
          195,
          20,
          {
            align: "right"
          }
        );


        // ===================================================
        // LÍNEA
        // ===================================================

        doc.setDrawColor(
          180,
          180,
          180
        );

        doc.line(
          10,
          36,
          200,
          36
        );


        // ===================================================
        // INFORMACIÓN CLIENTE
        // ===================================================

        let y = 48;

        doc.setTextColor(
          60,
          60,
          60
        );

        doc.setFontSize(12);


        const secciones = [

          `ID Pedido: ${pedidoId}`,

          `Fecha: ${
            new Date().toLocaleString()
          }`,

          `Cliente: ${clienteNombre}`,

          `Celular: ${clienteCelular}`
        ];


        if (clienteReferencia) {

          secciones.push(
            `Referencia: ${clienteReferencia}`
          );
        }


        secciones.forEach(t => {

          doc.text(
            t,
            15,
            y
          );

          y += 7;
        });


        doc.setDrawColor(
          220,
          220,
          220
        );

        doc.line(
          10,
          y + 4,
          200,
          y + 4
        );

        y += 15;


        // ===================================================
        // DETALLE ITEMS
        // ===================================================

        doc.setFont(
          "helvetica",
          "bold"
        );

        doc.setFontSize(14);

        doc.setTextColor(
          40,
          40,
          40
        );

        doc.text(
          "Detalle del Pedido",
          15,
          y
        );

        y += 10;


        doc.setFontSize(12);

        doc.text(
          "Producto",
          15,
          y
        );

        doc.text(
          "Cantidad",
          115,
          y
        );

        doc.text(
          "Subtotal",
          170,
          y,
          {
            align: "right"
          }
        );

        y += 5;


        doc.setDrawColor(
          180,
          180,
          180
        );

        doc.line(
          10,
          y,
          200,
          y
        );

        y += 7;


        // ===================================================
        // ITEMS
        // ===================================================

        doc.setFont(
          "helvetica",
          "normal"
        );

        doc.setFontSize(11);


        carrito.forEach(it => {

          doc.text(
            it.nombre,
            15,
            y
          );

          doc.text(
            String(it.qty),
            120,
            y
          );

          doc.text(
            `S/ ${(it.precio * it.qty).toFixed(2)}`,
            195,
            y,
            {
              align: "right"
            }
          );

          y += 7;
        });


        // ===================================================
        // TOTAL
        // ===================================================

        y += 10;


        doc.setFillColor(
          255,
          236,
          180
        );

        doc.roundedRect(
          10,
          y,
          190,
          14,
          3,
          3,
          "F"
        );


        doc.setFont(
          "helvetica",
          "bold"
        );

        doc.setFontSize(14);

        doc.setTextColor(
          60,
          40,
          0
        );

        doc.text(
          `TOTAL:  S/ ${totalPedido.toFixed(2)}`,
          20,
          y + 10
        );


        // ===================================================
        // PIE
        // ===================================================

        doc.setFontSize(11);

        doc.setFont(
          "helvetica",
          "normal"
        );

        doc.setTextColor(
          100,
          100,
          100
        );

        doc.text(
          "Gracias por confiar en nosotros ❤️\nEl Camarón de Oro – Sabor que te acompaña",
          15,
          275
        );


        // ===================================================
        // GUARDAR PDF
        // ===================================================

        doc.save(
          `Pedido_${pedidoId}.pdf`
        );


        // ===================================================
        // BLOQUEAR MAPA
        // ===================================================

        if (
          window.bloquearMapaPago
        ) {

          window.bloquearMapaPago();
        }


        // ===================================================
        // MENSAJE
        // ===================================================

        showToast(
          "🎉 Pago confirmado. Comprobante descargado.",
          "success"
        );


        qrContainer.innerHTML = `

          <h3>
            🎉 Pago confirmado con éxito
          </h3>

          <p>
            Tu pedido fue guardado y enviado a cocina.
          </p>

          <p>
            Se ha descargado un comprobante PDF.
          </p>

          <p>
            <b>Cliente:</b>
            ${clienteNombre}
            <br>

            <b>Celular:</b>
            ${clienteCelular}
            <br>

            <b>Referencia:</b>
            ${clienteReferencia || "—"}
            <br>

            <b>Total:</b>
            S/ ${totalPedido.toFixed(2)}
          </p>

          <hr>

          <p>
            <b>Verificación:</b>
            ${puntaje}/100
          </p>

        `;


      } catch (err) {

        // ===================================================
        // === ERROR
        // ===================================================

        intentosFallidos++;

        console.error(
          "❌ Error en verificación:",
          err
        );


        statusDiv.textContent =
          "❌ " +
          err.message;


        showToast(
          "❌ " +
          err.message,
          "error"
        );


        verifyBtn.disabled =
          false;


        // ===================================================
        // === SEGUNDO INTENTO
        // ===================================================

        if (
          intentosFallidos >= 2
        ) {

          try {

            const token =
              Math.random()
                .toString(36)
                .substring(2, 10)
                .toUpperCase();


            await guardarPedidoPendiente(
              token
            );


            // =================================================
            // LINK ADMIN
            // =================================================

            const adminLink =
              `https://admin-validar.onrender.com/index.html?token=${token}`;


            // =================================================
            // MENSAJE WHATSAPP
            // =================================================

            const mensaje = `

Hola, quiero hacer un pedido pero no puedo validar mi comprobante de pago.

🧾 Detalles del pedido:

${carrito
  .map(
    it =>
      `- ${it.nombre} x${it.qty} — S/ ${(it.precio * it.qty).toFixed(2)}`
  )
  .join('\n')}

💰 Total:
S/ ${totalPedido.toFixed(2)}

👤 Cliente:
${clienteNombre}

📱 ${clienteCelular}

🏠 ${clienteReferencia || "Sin referencia"}

Validar pedido:
${adminLink}

            `.trim();


            const whatsappURL =
              `https://wa.me/51986556773?text=${encodeURIComponent(mensaje)}`;


            // =================================================
            // UI
            // =================================================

            statusDiv.innerHTML = `

              ⚠️ No se pudo validar el pago automáticamente.

              <br>

              <button
                id="btn-whatsapp"
                class="btn primary"
                style="margin-top:10px;"
              >
                📱 Enviar por WhatsApp
              </button>

            `;


            const btnWhatsApp =
              document.getElementById(
                "btn-whatsapp"
              );


            btnWhatsApp.addEventListener(
              "click",
              () => {

                window.open(
                  whatsappURL,
                  "_blank"
                );


                if (
                  window.bloquearMapaPago
                ) {

                  window.bloquearMapaPago();
                }


                showToast(
                  "📱 Pedido enviado por WhatsApp para validación manual.",
                  "info"
                );


                qrContainer.innerHTML = `

                  <h3>
                    📱 Pedido enviado a validación manual
                  </h3>

                  <p>
                    Tu comprobante fue enviado por WhatsApp
                    al área administrativa.
                  </p>

                  <p>
                    Te confirmarán el pedido en breve.
                  </p>

                  <p>
                    <b>Cliente:</b>
                    ${clienteNombre}
                    <br>

                    <b>Celular:</b>
                    ${clienteCelular}
                    <br>

                    <b>Referencia:</b>
                    ${clienteReferencia || "—"}
                    <br>

                    <b>Total:</b>
                    S/ ${totalPedido.toFixed(2)}
                  </p>

                `;
              }
            );


            verifyBtn.disabled =
              true;


          } catch (errorPendiente) {

            console.error(
              "❌ Error guardando pedido pendiente:",
              errorPendiente
            );

            statusDiv.innerHTML += `
              <br>
              <small>
                ⚠️ También ocurrió un error al enviar
                el pedido para validación manual.
              </small>
            `;
          }
        }
      }
    }
  );
};


// =========================================================
// === INICIALIZAR AUTOMÁTICAMENTE
// =========================================================

window.initPagoVerificar();

(async function () {

  const STORAGE_KEY = 'camaron_cart_v1';

  const cart =
    JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');

  const summary =
    document.getElementById('cart-summary');

  const qrContainer =
    document.getElementById('qr');

  const coverageMsg =
    document.getElementById('coverage-msg');

  let marker = null;
  let selectedLatLng = null;
  let pagoBloqueado = false;
  let currentUser = null;


  // =====================================================
  // CARRITO VACÍO
  // =====================================================

  if (!cart.length) {

    summary.innerHTML =
      '<p>Tu carrito está vacío.</p>';

    showToast(
      "⚠️ Tu carrito está vacío",
      "error"
    );

    return;
  }


  // =====================================================
  // RESUMEN DEL PEDIDO
  // =====================================================

  let total = 0;

  const ul = document.createElement('ul');

  ul.style.listStyle = 'none';
  ul.style.paddingLeft = '0';


  cart.forEach((it, index) => {

    const li =
      document.createElement('li');

    li.style.marginBottom = '1rem';

    li.innerHTML = `
      <p>
        <b>${it.nombre}</b>
        x${it.qty}
        —
        S/ ${(it.precio * it.qty).toFixed(2)}
      </p>

      <textarea
        id="comentario-${index}"
        placeholder="Comentario adicional (opcional)"
        rows="1"
        style="
          width:100%;
          resize:none;
          border-radius:6px;
          padding:5px;
        "
      ></textarea>
    `;

    ul.appendChild(li);

    total +=
      Number(it.precio) *
      Number(it.qty);
  });


  summary.appendChild(ul);

  summary.innerHTML += `
    <p>
      <b>Total:</b>
      S/ ${total.toFixed(2)}
    </p>
  `;


  qrContainer.innerHTML = `
    <p style="color:#555;font-size:0.9rem;">
      📍 Selecciona tu ubicación en el mapa
      para continuar con el pago.
    </p>
  `;


  // =====================================================
  // FIREBASE
  // IMPORTANTE:
  // SE HACE ANTES DE PERMITIR EL PROCESO DE PAGO
  // =====================================================

  try {

    const cred =
      await firebase.auth().signInAnonymously();

    currentUser =
      cred.user;

    console.log(
      "✅ Usuario Firebase:",
      currentUser.uid
    );


    const roleRef =
      firebase
        .database()
        .ref(
          'roles/' +
          currentUser.uid
        );


    const snap =
      await roleRef.get();


    if (!snap.exists()) {

      await roleRef.set(
        'cliente'
      );
    }


  } catch (err) {

    console.error(
      "Firebase error:",
      err
    );

    showToast(
      "❌ Error al conectarse a Firebase.",
      "error"
    );

    return;
  }


  // =====================================================
  // MAPA
  // =====================================================

  const restaurantLatLng =
    L.latLng(
      -12.525472,
      -76.557917
    );


  const map =
    L.map('map').setView(
      [
        restaurantLatLng.lat,
        restaurantLatLng.lng
      ],
      15
    );


// =====================================================
// MAPA OPENSTREETMAP
// =====================================================

const mapa = L.tileLayer(
  'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
  {
    maxZoom: 19,
    attribution: '&copy; OpenStreetMap contributors'
  }
);

const satelite = L.tileLayer(
  'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
  {
    maxZoom: 19,
    attribution: '&copy; Esri, Maxar, Earthstar Geographics'
  }
);

mapa.addTo(map);

L.control.layers({
  '🗺️ Mapa': mapa,
  '🛰️ Satélite': satelite
}).addTo(map);

  // =====================================================
  // ICONOS
  // =====================================================

  const emojiIcon = (emoji) =>

    L.divIcon({

      html: `
        <div style="
          font-size:34px;
          line-height:34px;
          transform:translate(-50%,-50%);
          filter:
            drop-shadow(
              0 2px 4px
              rgba(0,0,0,0.4)
            );
        ">
          ${emoji}
        </div>
      `,

      className:
        "emoji-marker",

      iconSize:
        [34, 34],

      iconAnchor:
        [17, 17]
    });


  // =====================================================
  // RESTAURANTE
  // =====================================================

  L.marker(
    restaurantLatLng,
    {
      icon:
        emojiIcon("🍤")
    }
  )
    .addTo(map)
    .bindPopup(
      '🍤 Restaurante El Camarón de Oro'
    )
    .openPopup();


 // =====================================================
// POLÍGONO DE COBERTURA
// =====================================================

const coverageCoords = [

  // ─────────────────────────────────────────────
  // ZONA OESTE / SAN JUAN DE CORREVIENTO
  // ─────────────────────────────────────────────

  [-12.52717, -76.57763],
  [-12.53106, -76.57970],
  [-12.53195, -76.57264],
  [-12.53033, -76.57223],
  [-12.52952, -76.57410],

  // ─────────────────────────────────────────────
  // ZONA CENTRAL
  // ─────────────────────────────────────────────

  [-12.52588, -76.57244],
  [-12.52337, -76.56579],
  [-12.52345, -76.56039],
  [-12.52547, -76.55291],
  [-12.52588, -76.54959],

  // ─────────────────────────────────────────────
  // PARTE NORTE DE CALANGO
  // ─────────────────────────────────────────────

  [-12.52466, -76.54959],
  [-12.52061, -76.55001],
  [-12.51980, -76.54917],
  [-12.51737, -76.54917],

  // ─────────────────────────────────────────────
  // EXTENSIÓN NORTE
  // ─────────────────────────────────────────────

  [-12.51535, -76.54772],
  [-12.51555, -76.54564],
  [-12.51919, -76.54564],
  [-12.51960, -76.54419],

  // ─────────────────────────────────────────────
  // ESTE DE CALANGO
  // ─────────────────────────────────────────────

  [-12.52183, -76.54378],
  [-12.52203, -76.54149],
  [-12.52385, -76.54128],
  [-12.52405, -76.53838],

  // ─────────────────────────────────────────────
  // LÍMITE ESTE / SUR
  // ─────────────────────────────────────────────

  [-12.52750, -76.53838],
  [-12.52952, -76.54128],
  [-12.52912, -76.55291],
  [-12.52831, -76.56122],
  [-12.52750, -76.56953],

  // Cerrar polígono
  [-12.52717, -76.57763]

];

const polygon =
  L.polygon(
    coverageCoords,
    {
      color: "#0077FF",
      weight: 3,
      fillColor: "#66B3FF",
      fillOpacity: 0.25,
      smoothFactor: 1.5,
      dashArray: "6 6"
    }
  ).addTo(map);


  // =====================================================
  // VALIDAR COBERTURA
  // =====================================================

  function checkCoverage(latlng) {

    const pt =
      turf.point([
        latlng.lng,
        latlng.lat
      ]);


    const poly =
      turf.polygon([
        coverageCoords.map(
          c => [c[1], c[0]]
        )
      ]);


    return turf.booleanPointInPolygon(
      pt,
      poly
    );
  }


  // =====================================================
  // CLICK EN MAPA
  // =====================================================

  map.on(
    'click',
    function (e) {

      if (pagoBloqueado) {

        showToast(
          "ℹ️ Ya no puedes cambiar la ubicación, pago en proceso.",
          "info"
        );

        return;
      }


      // ---------------------------------------------
      // ELIMINAR MARCADOR ANTERIOR
      // ---------------------------------------------

      if (marker) {

        map.removeLayer(
          marker
        );
      }


      // ---------------------------------------------
      // MARCADOR CLIENTE
      // ---------------------------------------------

      marker =
        L.marker(
          e.latlng,
          {
            icon:
              emojiIcon("📍")
          }
        ).addTo(map);


      selectedLatLng =
        e.latlng;


      // ---------------------------------------------
      // VALIDAR COBERTURA
      // ---------------------------------------------

      if (
        !checkCoverage(
          selectedLatLng
        )
      ) {

        coverageMsg.textContent =
          '⚠️ Fuera de cobertura.';


        qrContainer.innerHTML = `
          <p style="color:#c00;">
            ⚠️ Estás fuera del área de entrega.
          </p>
        `;


        showToast(
          "⚠️ Estás fuera del área de entrega.",
          "error"
        );

        return;
      }


      coverageMsg.textContent =
        '✅ Dentro de cobertura.';


      showToast(
        "✅ Ubicación válida",
        "success"
      );


      // =================================================
      // FORMULARIO
      // =================================================

      qrContainer.innerHTML = `

        <h4>
          Datos para la entrega
        </h4>

        <div
          style="
            display:flex;
            flex-direction:column;
            gap:10px;
            max-width:400px;
          "
        >

          <input
            type="text"
            id="cliente-nombre"
            placeholder="👤 Nombre completo"
            class="input"
          >

          <input
            type="tel"
            id="cliente-celular"
            placeholder="📱 Número de celular"
            maxlength="9"
            class="input"
          >

          <textarea
            id="cliente-referencia"
            placeholder="🏠 Referencia del lugar"
            rows="2"
            class="input"
          ></textarea>

          <button
            id="continuar-pago"
            class="btn primary"
          >
            Continuar al pago
          </button>

        </div>

      `;


      // =================================================
      // DATOS BÁSICOS DEL PEDIDO
      // =================================================

      qrContainer.dataset.lat =
        selectedLatLng.lat;

      qrContainer.dataset.lng =
        selectedLatLng.lng;

      qrContainer.dataset.total =
        String(total);

      qrContainer.dataset.uid =
        currentUser.uid;


      // =================================================
      // CONTINUAR AL PAGO
      // =================================================

      document
        .getElementById(
          'continuar-pago'
        )
        .onclick = () => {


          // -------------------------------------------
          // DATOS CLIENTE
          // -------------------------------------------

          const nombre =
            document
              .getElementById(
                'cliente-nombre'
              )
              .value
              .trim();


          const celular =
            document
              .getElementById(
                'cliente-celular'
              )
              .value
              .trim();


          const referencia =
            document
              .getElementById(
                'cliente-referencia'
              )
              .value
              .trim();


          // -------------------------------------------
          // VALIDAR
          // -------------------------------------------

          if (
            !nombre ||
            !celular
          ) {

            showToast(
              "⚠️ Ingresa tu nombre y número de celular.",
              "error"
            );

            return;
          }


          // =================================================
          // MOMENTO EXACTO EN QUE COMIENZA EL PAGO
          // =================================================

          const creadoEn =
            Date.now();


          // =================================================
          // PRODUCTOS + COMENTARIOS
          // =================================================

          const cartWithComments =
            cart.map(
              (it, index) => {

                const textarea =
                  document.getElementById(
                    `comentario-${index}`
                  );


                return {

                  ...it,

                  comentario:
                    textarea?.value?.trim() ||
                    ""

                };
              }
            );


          // =================================================
          // GUARDAR DATOS EN QR CONTAINER
          // =================================================

          Object.assign(
            qrContainer.dataset,
            {

              nombre,

              celular,

              referencia,

              cart:
                JSON.stringify(
                  cartWithComments
                ),

              pedidoId:
                `pedido-${creadoEn}`,

              creadoEn:
                String(creadoEn),

              fechaPedido:
                String(creadoEn),

              total:
                String(total)

            }
          );


          console.log(
            "📦 Pedido creado:",
            qrContainer.dataset.pedidoId
          );

          console.log(
            "🕐 Timestamp:",
            creadoEn
          );


          // =================================================
          // MOSTRAR QR
          // =================================================

          qrContainer.innerHTML = `

            <h4>
              Resumen de tu pedido
            </h4>

            <p>
              <b>Cliente:</b>
              ${nombre}
            </p>

            <p>
              <b>Celular:</b>
              ${celular}
            </p>

            <p>
              <b>Total:</b>
              S/ ${total.toFixed(2)}
            </p>

            <img
              src="yape.png"
              alt="QR de Yape"
              style="
                max-width:220px;
                margin-top:10px;
              "
            >

            <p
              style="
                font-size:0.9rem;
              "
            >
              Sube la captura del pago
              para verificar
              o copia este número:

              <b>986556773</b>
            </p>

          `;


          // =================================================
          // CARGAR VERIFICADOR
          // =================================================

          // Evitar cargarlo dos veces

          if (
            document.getElementById(
              "verificadorScript"
            )
          ) {

            return;
          }


          const script =
            document.createElement(
              'script'
            );


          script.id =
            "verificadorScript";


          script.type =
            "module";


          script.src =
            "assets/pago_verificar.js";


          document.body.appendChild(
            script
          );


          // =================================================
          // BLOQUEAR PROCESO
          // =================================================

          pagoBloqueado =
            true;


          // =================================================
          // LIMPIAR CARRITO
          // =================================================

          localStorage.removeItem(
            STORAGE_KEY
          );

        };

    }
  );


  // =====================================================
  // FIN
  // =====================================================

})();

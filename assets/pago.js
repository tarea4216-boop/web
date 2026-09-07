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
  // MAPA CARTO
  // =====================================================

  L.tileLayer(
    'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png',
    {
      attribution:
        '&copy; OpenStreetMap & CartoDB'
    }
  ).addTo(map);


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

    [-12.53008, -76.57879],
    [-12.52990, -76.57620],
    [-12.53110, -76.57419],
    [-12.52966, -76.57315],
    [-12.52804, -76.57111],
    [-12.52660, -76.56970],
    [-12.52434, -76.56974],
    [-12.52375, -76.56680],
    [-12.52371, -76.56554],
    [-12.52590, -76.55640],
    [-12.52650, -76.55280],
    [-12.52684, -76.54852],
    [-12.52049, -76.54789],
    [-12.52053, -76.54597],
    [-12.52394, -76.54587],
    [-12.52389, -76.54133],
    [-12.52675, -76.54120],
    [-12.52820, -76.54260],
    [-12.52740, -76.54890],
    [-12.52698, -76.57774],
    [-12.52900, -76.57840],
    [-12.53008, -76.57879]

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

// ==============================
// MODAL DE PRODUCTO (CON HORARIO)
// ==============================

// === REFERENCIAS DEL MODAL ===
const modal = document.getElementById("productModal");
const modalImage = document.getElementById("modalImage");
const modalTitle = document.getElementById("modalTitle");
const modalDesc = document.getElementById("modalDesc");
const modalPrice = document.getElementById("modalPrice");
const addToCartBtn = document.getElementById("addToCartBtn");

let currentItem = null;

// ==============================
// HORARIO DE ATENCIÓN
// ==============================
let HORARIO = { apertura: 0, cierre: 24 };
let HORARIO_CARGADO = false;

// Cargar horario SOLO si Supabase existe
async function cargarHorarioAtencion() {
  if (typeof supabase === "undefined") {
    console.warn("Supabase aún no está cargado. Horario libre temporal.");
    HORARIO_CARGADO = false;
    return;
  }

  try {
    const { data, error } = await supabase
      .from("horario_atencion")
      .select("apertura, cierre")
      .limit(1)
      .maybeSingle();

    if (error && error.code !== "PGRST116") {
      console.error("Error cargando horario:", error);
      return;
    }

    if (!data) {
      HORARIO = { apertura: 0, cierre: 24 };
      HORARIO_CARGADO = true;
      return;
    }

    HORARIO.apertura = data.apertura;
    HORARIO.cierre = data.cierre;
    HORARIO_CARGADO = true;

  } catch (err) {
    console.error("Error inesperado horario:", err);
  }
}

// Verificar horario (FAIL-SAFE)
function estaDentroDelHorario() {
  // ⛑️ Si el horario aún no cargó → NO BLOQUEAR
  if (!HORARIO_CARGADO) return true;

  const ahora = new Date();
  const horaActual = ahora.getHours() + ahora.getMinutes() / 60;

  return horaActual >= HORARIO.apertura && horaActual < HORARIO.cierre;
}

// ==============================
// ABRIR MODAL
// ==============================
document.addEventListener("click", (e) => {
  const addBtn = e.target.closest("[data-add]");
  if (addBtn) return;

  const item = e.target.closest(".carousel-item");
  if (!item || !modal) return;

  if (!estaDentroDelHorario()) {
    showToast(
      `⚠️ Fuera de horario. Atendemos de ${HORARIO.apertura}:00 a ${HORARIO.cierre}:00.`,
      "error"
    );
    return;
  }

  currentItem = item;

  modalImage.src = item.querySelector("img")?.src || "";
  modalTitle.textContent = item.querySelector(".title")?.textContent || "Producto";
  modalDesc.textContent = item.querySelector(".muted")?.textContent || "";
  modalPrice.textContent = item.querySelector(".price")?.textContent || "";

  modal.style.display = "flex";
});

// ==============================
// CERRAR MODAL
// ==============================
if (modal) {
  modal.addEventListener("click", (e) => {
    if (e.target === modal) modal.style.display = "none";
  });
}

// ==============================
// AGREGAR AL CARRITO
// ==============================
if (addToCartBtn) {
  addToCartBtn.addEventListener("click", () => {
    if (!estaDentroDelHorario()) {
      showToast(
        `⚠️ Fuera de horario. Atendemos de ${HORARIO.apertura}:00 a ${HORARIO.cierre}:00.`,
        "error"
      );
      return;
    }

    if (!currentItem) return;

    const id = currentItem.querySelector("[data-add]")?.dataset.add;
    if (!id) return;

    const product = window.PRODUCTS?.find(p => p.id === id);

    if (!product || !window.cart) {
      showToast("⚠️ No se pudo agregar el producto", "error");
      return;
    }

    window.cart.add({
      id: product.id,
      nombre: product.nombre,
      precio: product.precio,
      imagen_url: product.imagen_url,
      qty: 1
    });

    window.dispatchEvent(new Event("cart:change"));
    showToast(`🛒 ${product.nombre} agregado al carrito`, "success");

    modal.style.display = "none";
  });
}

// ==============================
// INIT
// ==============================
document.addEventListener("DOMContentLoaded", () => {
  // Esperar un poco por Supabase
  setTimeout(cargarHorarioAtencion, 300);
});

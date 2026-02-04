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
// HORARIO DE ATENCIÓN (DESDE BD)
// ==============================
let HORARIO = { apertura: 0, cierre: 24 };
let HORARIO_CARGADO = false;

// Cargar horario desde Supabase
async function cargarHorarioAtencion() {
  const { data, error } = await supabase
    .from("horario_atencion")
    .select("apertura, cierre")
    .limit(1)
    .maybeSingle();

  // Error real
  if (error && error.code !== "PGRST116") {
    console.error("Error cargando horario (modal):", error);
    return;
  }

  // Si no hay horario configurado → libre
  if (!data) {
    HORARIO = { apertura: 0, cierre: 24 };
    HORARIO_CARGADO = true;
    return;
  }

  HORARIO.apertura = data.apertura;
  HORARIO.cierre = data.cierre;
  HORARIO_CARGADO = true;
}

// Verificar si está dentro del horario
function estaDentroDelHorario() {
  if (!HORARIO_CARGADO) return false;

  const ahora = new Date();
  const hora = ahora.getHours() + ahora.getMinutes() / 60;

  return hora >= HORARIO.apertura && hora < HORARIO.cierre;
}

// ==============================
// ABRIR MODAL
// ==============================
document.addEventListener("click", (e) => {
  // No abrir si se hace clic en botón "Agregar"
  const addBtn = e.target.closest("[data-add]");
  if (addBtn) return;

  const item = e.target.closest(".carousel-item");
  if (!item || !modal) return;

  // Bloquear fuera de horario
  if (!estaDentroDelHorario()) {
    showToast(
      `⚠️ Fuera de horario. Atendemos de ${HORARIO.apertura}:00 a ${HORARIO.cierre}:00.`,
      "error"
    );
    return;
  }

  currentItem = item;

  const img = item.querySelector("img")?.src || "";
  const title = item.querySelector(".title")?.textContent || "Producto";
  const desc = item.querySelector(".muted")?.textContent || "";
  const price = item.querySelector(".price")?.textContent || "";

  modalImage.src = img;
  modalTitle.textContent = title;
  modalDesc.textContent = desc;
  modalPrice.textContent = price;

  modal.style.display = "flex";
});

// ==============================
// CERRAR MODAL
// ==============================
if (modal) {
  modal.addEventListener("click", (e) => {
    if (e.target === modal) {
      modal.style.display = "none";
    }
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

    const id = currentItem
      .querySelector("[data-add]")
      ?.getAttribute("data-add");

    if (!id) return;

    const product = window.PRODUCTS?.find(p => p.id === id);

    if (product && window.cart) {
      window.cart.add({
        id: product.id,
        nombre: product.nombre,
        precio: product.precio,
        imagen_url: product.imagen_url,
        qty: 1
      });

      window.dispatchEvent(new Event("cart:change"));

      // Animación opcional
      try {
        document.dispatchEvent(
          new CustomEvent("itemAdded", { detail: { img: modalImage } })
        );
      } catch {
        window.dispatchEvent(
          new CustomEvent("itemAdded", { detail: { img: modalImage } })
        );
      }

      showToast(`🛒 ${product.nombre} agregado al carrito`, "success");
    } else {
      showToast("⚠️ No se pudo agregar el producto", "error");
    }

    modal.style.display = "none";
  });
}

// ==============================
// INIT
// ==============================
document.addEventListener("DOMContentLoaded", async () => {
  await cargarHorarioAtencion();
});

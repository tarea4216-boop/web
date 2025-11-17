// === REFERENCIAS DEL MODAL ===
const modal = document.getElementById("productModal");
const modalImage = document.getElementById("modalImage");
const modalTitle = document.getElementById("modalTitle");
const modalDesc = document.getElementById("modalDesc");
const modalPrice = document.getElementById("modalPrice");
const addToCartBtn = document.getElementById("addToCartBtn");

let currentItem = null;

// === HORARIO DE ATENCIÓN ===
function estaDentroDelHorario() {
  const ahora = new Date();
  const hora = ahora.getHours() + ahora.getMinutes() / 60;
  return hora >= 10 && hora < 18;
}

// === ABRIR MODAL ===
document.addEventListener("click", (e) => {
  // No abrir si clic en el botón "Agregar"
  const addBtn = e.target.closest("[data-add]");
  if (addBtn) return;

  // Buscar el contenedor de producto
  const item = e.target.closest(".carousel-item");
  if (!item || !modal) return;

  // Evitar abrir fuera del horario
  if (!estaDentroDelHorario()) {
    showToast("⚠️ Fuera de horario. El restaurante atiende de 10:00 a 18:00.", "error");
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

// === CERRAR MODAL ===
if (modal) {
  modal.addEventListener("click", (e) => {
    if (e.target === modal) {
      modal.style.display = "none";
    }
  });
}

// === AGREGAR AL CARRITO ===
if (addToCartBtn) {
  addToCartBtn.addEventListener("click", () => {
    if (!estaDentroDelHorario()) {
      showToast("⚠️ El restaurante abre a las 10:00 a.m.", "error");
      return;
    }

    if (!currentItem) return;
    const id = currentItem.querySelector("[data-add]")?.getAttribute("data-add");
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

      // ✨ Animación o efecto opcional (si existe)
      try {
        document.dispatchEvent(new CustomEvent('itemAdded', { detail: { img: modalImage } }));
      } catch {
        window.dispatchEvent(new CustomEvent('itemAdded', { detail: { img: modalImage } }));
      }

      showToast(`🛒 ${product.nombre} agregado al carrito`, "success");
    } else {
      showToast("⚠️ No se pudo agregar el producto", "error");
    }

    modal.style.display = "none";
  });
}

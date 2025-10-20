const modal = document.getElementById("productModal");
const modalImage = document.getElementById("modalImage");
const modalTitle = document.getElementById("modalTitle");
const modalDesc = document.getElementById("modalDesc");
const modalPrice = document.getElementById("modalPrice");
const addToCartBtn = document.getElementById("addToCartBtn");

let currentItem = null;

// Delegación: abrir modal solo si se hace click en tarjeta (no en el botón "Agregar")
document.addEventListener("click", (e) => {
  const addBtn = e.target.closest("[data-add]");
  if (addBtn) {
    // Si es botón "Agregar", dejamos que menu.js maneje el carrito y no abrimos modal
    return;
  }

  const item = e.target.closest(".carousel-item");
  if (item) {
    currentItem = item;

    // Datos desde la tarjeta
    const img = item.querySelector("img")?.src || "";
    const title = item.querySelector(".title")?.textContent || "Producto";
    const desc = item.querySelector(".muted")?.textContent || "";
    const price = item.querySelector(".price")?.textContent || "";

    // Cargar en modal
    modalImage.src = img;
    modalTitle.textContent = title;
    modalDesc.textContent = desc;
    modalPrice.textContent = price;

    modal.style.display = "flex";
  }
});

// Cerrar modal si se hace click fuera
modal.addEventListener("click", (e) => {
  if (e.target === modal) {
    modal.style.display = "none";
  }
});

// Botón "Agregar al carrito" dentro del modal
addToCartBtn.addEventListener("click", () => {
  if (!currentItem) return;

  const id = currentItem.querySelector("[data-add]")?.getAttribute("data-add");
  if (!id) return;

  // Buscar producto en PRODUCTS (expuesto en menu.js)
  const product = window.PRODUCTS?.find(p => p.id === id);
  if (product && window.cart) {
    window.cart.add({
      id: product.id,
      nombre: product.nombre,
      precio: product.precio,
      imagen_url: product.imagen_url,
      qty: 1
    });
    // notifica UI del cambio de carrito
    window.dispatchEvent(new Event("cart:change"));

    // <-- NUEVO: dispara evento personalizado para la animación
    // enviamos el elemento <img> del modal para que el listener lo use
    try {
      document.dispatchEvent(new CustomEvent('itemAdded', { detail: { img: modalImage } }));
    } catch (err) {
      // fallback a window si por alguna razón document falla
      try { window.dispatchEvent(new CustomEvent('itemAdded', { detail: { img: modalImage } })); } catch (e) {}
    }
  }

  modal.style.display = "none";
});

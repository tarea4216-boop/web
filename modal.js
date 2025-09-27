const modal = document.getElementById("productModal");
const modalImage = document.getElementById("modalImage");
const modalTitle = document.getElementById("modalTitle");
const modalDesc = document.getElementById("modalDesc");
const modalPrice = document.getElementById("modalPrice");
const addToCartBtn = document.getElementById("addToCartBtn");

let currentItem = null;

// Delegación: esperar a que menu.js genere los productos
document.addEventListener("click", (e) => {
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

// Botón agregar al carrito
addToCartBtn.addEventListener("click", () => {
  if (currentItem) {
    currentItem.classList.add("selected");
  }
  modal.style.display = "none";
});

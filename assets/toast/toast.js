// ✅ FUNCIÓN DE NOTIFICACIONES TOAST PERSONALIZADAS
function showToast(mensaje, tipo = "info") {
  const contenedor = document.getElementById("toastContainer");
  if (!contenedor) return;

  const toast = document.createElement("div");
  toast.className = `toast ${tipo}`;
  toast.textContent = mensaje;
  contenedor.appendChild(toast);

  // Mostrar
  setTimeout(() => toast.classList.add("show"), 100);

  // Ocultar y eliminar
  setTimeout(() => {
    toast.style.animation = "fadeOut 0.5s forwards";
    setTimeout(() => toast.remove(), 500);
  }, 4000);
}
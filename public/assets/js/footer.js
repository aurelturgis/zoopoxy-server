document.addEventListener("DOMContentLoaded", () => {
  const footer = document.querySelector("footer");
  if (!footer) return;

  // Si le loader n'est PAS présent, on affiche le footer immédiatement
  const loader = document.getElementById("loader");

  if (!loader) {
    footer.classList.remove("footer-hidden");
    footer.classList.add("footer-animate");
  }
});

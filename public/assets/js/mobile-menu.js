document.addEventListener("DOMContentLoaded", () => {
  const burgerBtn   = document.getElementById("burgerBtn");
  const mobileMenu  = document.getElementById("mobileMenu");
  const mobileClose = document.getElementById("mobileClose");

  if (!burgerBtn || !mobileMenu) return;

  burgerBtn.addEventListener("click", () => {
    mobileMenu.style.display = "flex";
  });

  if (mobileClose) {
    mobileClose.addEventListener("click", () => {
      mobileMenu.style.display = "none";
    });
  }

  // Fermeture si on clique en dehors du menu
  document.addEventListener("click", (e) => {
    if (!mobileMenu.contains(e.target) && e.target !== burgerBtn) {
      mobileMenu.style.display = "none";
    }
  });
});

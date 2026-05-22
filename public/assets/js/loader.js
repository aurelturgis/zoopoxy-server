window.addEventListener('load', () => {
  const loader = document.getElementById('loader');
  const mainContent = document.getElementById('main-content');
  const footer = document.querySelector('footer');

  setTimeout(() => {
    if (loader) loader.style.display = 'none';
    if (mainContent) mainContent.classList.remove('hidden');
    if (footer) {
      footer.classList.remove('footer-hidden');
      footer.classList.add('footer-animate');
    }
  }, 500);
});

document.addEventListener("DOMContentLoaded", () => {
  const popup = document.getElementById('cookiePopup');
  const accept = document.getElementById('cookieAccept');
  const decline = document.getElementById('cookieDecline');

  if (localStorage.getItem('sa_cookies')) {
    if (popup) popup.style.display = 'none';
    return;
  }

  if (accept) {
    accept.addEventListener('click', () => {
      localStorage.setItem('sa_cookies', 'accepted');
      popup.style.display = 'none';
    });
  }

  if (decline) {
    decline.addEventListener('click', () => {
      localStorage.setItem('sa_cookies', 'declined');
      popup.style.display = 'none';
    });
  }
});

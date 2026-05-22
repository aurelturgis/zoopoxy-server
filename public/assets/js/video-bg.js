window.addEventListener('load', () => {
  const video = document.getElementById('bg-video');
  if (!video) return;

  const source = video.querySelector('source');

  function updateVideoSource() {
    if (window.innerWidth < 1080) {
      source.setAttribute('src', 'assets/video/home-1080x1920.mp4');
    } else {
      source.setAttribute('src', 'assets/video/home-1920x1080.mp4');
    }
    video.load();
  }

  updateVideoSource();
  window.addEventListener('resize', updateVideoSource);
});

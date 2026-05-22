// JavaScript Document
document.addEventListener("DOMContentLoaded", () => {
  const audio = document.getElementById('bg-audio');
  const btnOn = document.getElementById('audio-on');
  const btnOff = document.getElementById('audio-off');

  if (!audio || !btnOn || !btnOff) return;

  btnOn.addEventListener('click', () => {
    audio.play();
    btnOn.classList.add('hidden');
    btnOff.classList.remove('hidden');
  });

  btnOff.addEventListener('click', () => {
    audio.pause();
    btnOff.classList.add('hidden');
    btnOn.classList.remove('hidden');
  });
});

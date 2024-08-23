const cards = document.querySelectorAll('.card');

cards.forEach($card => {
  let bounds;

  function rotateToMouse(e) {
    const mouseX = e.clientX;
    const mouseY = e.clientY;
    const leftX = mouseX - bounds.x;
    const topY = mouseY - bounds.y;
    const center = {
      x: leftX - bounds.width / 2,
      y: topY - bounds.height / 2
    }
    const distance = Math.sqrt(center.x ** 2 + center.y ** 2);

    $card.style.transform = `
      scale3d(1.07, 1.07, 1.07)
      rotate3d(
        ${center.y / 100},
        ${-center.x / 100},
        0,
        ${Math.log(distance) * 2}deg
      )
    `;

    $card.querySelector('.glow').style.backgroundImage = `
      radial-gradient(
        circle at
        ${center.x * 2 + bounds.width / 2}px
        ${center.y * 2 + bounds.height / 2}px,
        #ffffff55,
        #0000000f
      )
    `;
  }

  $card.addEventListener('mouseenter', () => {
    bounds = $card.getBoundingClientRect();
    document.addEventListener('mousemove', rotateToMouse);
  });

  $card.addEventListener('mouseleave', () => {
    document.removeEventListener('mousemove', rotateToMouse);
    $card.style.transform = '';
    $card.querySelector('.glow').style.backgroundImage = '';
  });
});

document.addEventListener('DOMContentLoaded', () => {
  const cards = document.querySelectorAll('.card');
  let activeCard = null;

  cards.forEach(card => {
      const audio = card.querySelector('.card-audio');
      const speakerIcon = card.querySelector('.speaker-icon');

      audio.preload = 'auto';

      card.addEventListener('click', () => {
          if (activeCard && activeCard !== card) {
              const activeAudio = activeCard.querySelector('.card-audio');
              activeAudio.pause();
              activeAudio.currentTime = 0;
              activeCard.classList.remove('active');
          }

          if (audio.paused) {
              audio.currentTime = 0;
              audio.play().catch(error => {
                  console.error('Failed to play audio:', error);
              });
              card.classList.add('active');
              activeCard = card;
          } else {
              audio.pause();
              card.classList.remove('active');
              activeCard = null;
          }
      });
  });
});

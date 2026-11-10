(() => {
  'use strict';
  const root = document.documentElement;
  const toggle = document.querySelector('.motion-toggle');
  let effectsPaused = false;
  let scrollFrame = 0;
  let summaryTimer = 0;
  let summaryRunning = false;
  const summary = 'Responded to a reported UXO cache at grid 717. Established control, confirmed hazard indicators, and coordinated removal actions with site security.';
  const summaryText = document.querySelector('#summary-text');
  const generate = document.querySelector('#generate-summary');

  function finishSummary() {
    window.clearTimeout(summaryTimer);
    summaryText.textContent = summary;
    generate.disabled = false;
    document.querySelector('#generate-label').textContent = 'REPLAY DEMO SUMMARY';
    summaryRunning = false;
  }

  function setMotion(paused) {
    effectsPaused = paused;
    root.classList.toggle('effects-paused', paused);
    toggle.setAttribute('aria-pressed', String(paused));
    toggle.setAttribute('aria-label', paused ? 'Enable visual effects' : 'Pause visual effects');
    document.querySelector('.motion-label').textContent = paused ? 'FX OFF' : 'FX ON';
    if (paused) {
      document.querySelectorAll('[data-tilt]').forEach(element => element.style.removeProperty('transform'));
      if (summaryRunning) finishSummary();
    }
  }
  setMotion(effectsPaused);
  toggle.addEventListener('click', () => { setMotion(!effectsPaused); });

  if ('IntersectionObserver' in window) {
    root.classList.add('js-motion');
    const observer = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-visible');
          observer.unobserve(entry.target);
        }
      });
    }, { threshold: .08, rootMargin: '0px 0px -20px 0px' });
    document.querySelectorAll('.reveal').forEach(element => observer.observe(element));
  }

  const progress = document.querySelector('.page-progress');
  function updateScroll() {
    const total = root.scrollHeight - window.innerHeight;
    progress.style.transform = `scaleX(${total > 0 ? Math.min(1, Math.max(0, window.scrollY / total)) : 0})`;
    scrollFrame = 0;
  }
  window.addEventListener('scroll', () => {
    if (!scrollFrame) scrollFrame = window.requestAnimationFrame(updateScroll);
  }, { passive: true });
  updateScroll();

  const clock = document.querySelector('#utc-clock');
  function updateClock() {
    if (document.hidden) return;
    const now = new Date();
    clock.textContent = now.toISOString().slice(11, 19);
    clock.dateTime = now.toISOString();
  }
  updateClock();
  window.setInterval(updateClock, 1000);

  document.querySelectorAll('[data-preview]').forEach(button => {
    button.addEventListener('click', () => {
      if (button.getAttribute('aria-pressed') === 'true') return;
      document.querySelectorAll('[data-preview]').forEach(item => item.setAttribute('aria-pressed', String(item === button)));
      const image = document.querySelector('#operations-preview');
      image.src = button.dataset.image;
      image.alt = button.dataset.alt;
      image.classList.remove('image-switch');
      void image.offsetWidth;
      image.classList.add('image-switch');
    });
  });

  generate.addEventListener('click', () => {
    if (summaryRunning) return;
    summaryRunning = true;
    generate.disabled = true;
    document.querySelector('#generate-label').textContent = 'GENERATING DEMO…';
    if (effectsPaused) { finishSummary(); return; }
    const words = summary.split(' ');
    let cursor = 0;
    summaryText.textContent = '';
    function typeWord() {
      summaryText.textContent = words.slice(0, ++cursor).join(' ');
      if (cursor < words.length) summaryTimer = window.setTimeout(typeWord, 65);
      else finishSummary();
    }
    summaryTimer = window.setTimeout(typeWord, 280);
  });

  const finePointer = window.matchMedia('(hover: hover) and (pointer: fine)');
  document.querySelectorAll('[data-tilt]').forEach(element => {
    element.addEventListener('pointermove', event => {
      if (effectsPaused || !finePointer.matches) return;
      const rect = element.getBoundingClientRect();
      const x = (event.clientX - rect.left) / rect.width - .5;
      const y = (event.clientY - rect.top) / rect.height - .5;
      const base = element.classList.contains('hero-phone') ? -7 : element.classList.contains('screen-frame') ? 5 : -9;
      element.style.transform = `perspective(900px) rotateX(${-y * 9}deg) rotateY(${x * 12}deg) rotate(${base}deg) translateY(-4px)`;
    });
    element.addEventListener('pointerleave', () => element.style.removeProperty('transform'));
  });

  // Render topographic contours only when the viewport changes.
  const canvas = document.querySelector('.terrain');
  const context = canvas.getContext('2d');
  function drawTerrain() {
    if (!context) return;
    const width = canvas.clientWidth;
    const height = canvas.clientHeight;
    const density = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = width * density;
    canvas.height = height * density;
    context.setTransform(density, 0, 0, density, 0, 0);
    context.clearRect(0, 0, width, height);
    context.lineWidth = .7;
    for (let ring = 0; ring < 27; ring++) {
      context.beginPath();
      for (let step = 0; step <= 180; step++) {
        const angle = step / 180 * Math.PI * 2;
        const radius = 95 + ring * 24 + Math.sin(angle * 3 + ring * .09) * 27 + Math.cos(angle * 5 - ring * .07) * 13;
        const x = width * .81 + Math.cos(angle) * radius * 1.45;
        const y = height * .45 + Math.sin(angle) * radius * .89;
        if (step === 0) context.moveTo(x, y); else context.lineTo(x, y);
      }
      context.closePath();
      context.strokeStyle = ring % 5 === 0 ? 'rgba(255,103,0,0.12)' : 'rgba(153,164,181,0.07)';
      context.stroke();
    }
  }
  drawTerrain();
  let resizeTimer;
  window.addEventListener('resize', () => {
    window.clearTimeout(resizeTimer);
    resizeTimer = window.setTimeout(() => { drawTerrain(); updateScroll(); }, 150);
  }, { passive: true });
})();

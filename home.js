let aiHighlightPlayed = false;

export function initHome(main) {
  const features = [...main.querySelectorAll("[data-feature]")];
  const disposeFeatureShowcase = initFeatureShowcase(main, features);
  const disposePreviews = initPreviews(main);
  const disposeVideos = initDemoVideos(main);
  const wordmark = main.querySelector(".ai-wordmark");
  const aiObserver = new IntersectionObserver(([entry]) => {
    if (!entry.isIntersecting || aiHighlightPlayed) return;
    aiHighlightPlayed = true;
    wordmark.classList.add("is-highlighted");
    aiObserver.disconnect();
    wordmark.addEventListener("animationend", () => wordmark.classList.remove("is-highlighted"), { once: true });
  });
  if (wordmark && !aiHighlightPlayed) aiObserver.observe(wordmark);

  function updateScrollState() {
    const viewportCenter = window.innerHeight * 0.52;
    const titleRevealRange = Math.min(400, window.innerHeight * 0.40);
    const revealRange = Math.min(300, window.innerHeight * 0.28);
    const isPortrait = window.innerHeight > window.innerWidth;

    features.forEach((feature) => {
      const rect = feature.getBoundingClientRect();
      const featureCenter = rect.top + rect.height / 2;
      const distance = Math.abs(featureCenter - viewportCenter);
      const visual = feature.querySelector(".feature-visual");

      const visualRect = visual.getBoundingClientRect();

      if (visualRect.top < window.innerHeight && visualRect.bottom > 0) {
        visual.classList.add("is-demo-visible");
      }

      if (isPortrait) {
        if (rect.top <= window.innerHeight * 0.84 && rect.bottom > 0) {
          feature.classList.add("is-title-revealed", "is-revealed");
        }

        return;
      }

      if (distance <= titleRevealRange) {
        feature.classList.add("is-title-revealed");
      }

      if (distance <= revealRange) {
        feature.classList.add("is-revealed");
      }
    });
  }

  updateScrollState();
  window.addEventListener("scroll", updateScrollState, { passive: true });
  window.addEventListener("resize", updateScrollState);
  return () => {
    aiObserver.disconnect();
    disposeFeatureShowcase();
    disposePreviews();
    disposeVideos();
    window.removeEventListener("scroll", updateScrollState);
    window.removeEventListener("resize", updateScrollState);
  };
}

function initDemoVideos(main) {
  const mobile = window.matchMedia("(max-width: 860px)");
  const controller = new AbortController();
  const players = [...main.querySelectorAll("[data-demo-video]")].map(video => ({ video, visible: false }));

  function update() {
    for (const { video, visible } of players) {
      const panel = video.closest("[data-phone-panel]");
      const active = panel ? !mobile.matches && panel.classList.contains("is-active") : mobile.matches;
      const playing = active && visible && !document.hidden
        && !document.documentElement.classList.contains("nav-is-open")
        && (mobile.matches || main.dataset.demosPaused !== "true");
      if (playing) video.play().catch(() => {});
      else video.pause();
      if (!active) video.currentTime = 0;
    }
  }

  const observer = new IntersectionObserver(entries => {
    for (const entry of entries) {
      players.find(player => player.video === entry.target).visible = entry.isIntersecting;
    }
    update();
  });
  players.forEach(({ video }) => observer.observe(video));
  main.addEventListener("featurechange", update, { signal: controller.signal });
  document.addEventListener("visibilitychange", update, { signal: controller.signal });
  mobile.addEventListener("change", update, { signal: controller.signal });
  const menuObserver = new MutationObserver(update);
  menuObserver.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
  return () => {
    observer.disconnect();
    menuObserver.disconnect();
    controller.abort();
    players.forEach(({ video }) => video.pause());
  };
}

function initFeatureShowcase(main, features) {
  const previous = main.querySelector("[data-feature-prev]");
  const next = main.querySelector("[data-feature-next]");
  const count = main.querySelector("[data-feature-count]");
  const toggle = main.querySelector("[data-feature-pause]");
  const phonePanels = [...main.querySelectorAll("[data-phone-panel]")];
  if (!previous || !next || !count || !features.length) return () => {};
  const controller = new AbortController();
  let index = 0;
  let midpointTimer;
  let generation = 0;
  let completed = false;
  phonePanels.forEach(panel => panel.querySelectorAll("img").forEach(image => {
    image.loading = "eager";
    image.decode().catch(() => {});
  }));
  async function showSecondImage() {
    const token = generation;
    const images = phonePanels[index]?.querySelectorAll("img");
    if (!images?.[1]) return;
    try { await images[1].decode(); } catch { return; }
    if (token !== generation || progress.playState !== "running") return;
    images[1].classList.add("is-incoming");
  }
  const progress = main.querySelector("[data-demo-progress]").animate(
    [{ width: "0%", backgroundColor: "#ffe000" },
     { width: "100%", backgroundColor: "#ff6700" }],
    { duration: 10000, fill: "both" }
  );
  progress.pause();
  function updateToggle(animate = false) {
    const outgoing = animate ? toggle.querySelector("i")?.cloneNode(true) : null;
    const paused = main.dataset.demosPaused === "true";
    const label = completed ? "Restart demos" : paused ? "Play demos" : "Pause demos";
    toggle.setAttribute("aria-label", label);
    toggle.title = `${label} (Space)`;
    toggle.classList.toggle("is-paused", paused);
    toggle.innerHTML = `<i class="bi bi-${completed ? "arrow-counterclockwise" : paused ? "play-fill" : "pause-fill"}"></i>`;
    if (outgoing) {
      outgoing.className = "bi bi-pause-fill icon-outgoing";
      outgoing.setAttribute("aria-hidden", "true");
      toggle.firstElementChild.classList.add("icon-incoming");
      toggle.append(outgoing);
      outgoing.addEventListener("animationend", () => outgoing.remove(), { once: true });
    }
  }
  progress.onfinish = () => {
    if (index < features.length - 1) { show(1); return; }
    completed = true;
    main.dataset.demosPaused = "true";
    clearTimeout(midpointTimer);
    updateToggle(true);
    main.dispatchEvent(new CustomEvent("featurechange"));
  };
  let visible = false;
  const desktop = window.matchMedia("(min-width: 861px)");

  function schedule() {
    clearTimeout(midpointTimer);
    progress.pause();
    if (main.dataset.demosPaused === "true" || !desktop.matches || !visible
      || document.hidden || document.documentElement.classList.contains("nav-is-open")) return;
    progress.play();
    midpointTimer = setTimeout(showSecondImage, Math.max(0, 5000 - Number(progress.currentTime)));
  }

  function show(step) {
    completed = false;
    updateToggle();
    generation++;
    phonePanels.forEach(panel => panel.querySelectorAll("img").forEach((image, i) => {
      image.classList.remove("is-incoming");
      image.classList.toggle("is-current", i === 0);
    }));
    features[index].classList.remove("is-active-item");
    phonePanels[index]?.classList.remove("is-active");
    index = (index + step + features.length) % features.length;
    const active = features[index];
    active.classList.add("is-active-item", "is-title-revealed", "is-revealed");
    active.querySelector(".feature-visual")?.classList.add("is-demo-visible");
    phonePanels[index]?.classList.add("is-active");
    count.textContent = `${index + 1} of ${features.length}`;
    main.dispatchEvent(new CustomEvent("featurechange"));
    progress.currentTime = 0;
    schedule();
  }

  toggle?.addEventListener("click", () => {
    if (completed) {
      main.dataset.demosPaused = "false";
      show(-index);
      return;
    }
    main.dataset.demosPaused = String(main.dataset.demosPaused !== "true");
    updateToggle();
    main.dispatchEvent(new CustomEvent("featurechange"));
    schedule();
  }, { signal: controller.signal });
  const observer = new IntersectionObserver(([entry]) => {
    visible = entry.isIntersecting;
    schedule();
  });
  observer.observe(main.querySelector(".shared-phone-stage"));
  const menuObserver = new MutationObserver(schedule);
  menuObserver.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
  document.addEventListener("visibilitychange", schedule, { signal: controller.signal });
  desktop.addEventListener("change", schedule, { signal: controller.signal });
  previous.addEventListener("click", () => show(-1), { signal: controller.signal });
  next.addEventListener("click", () => show(1), { signal: controller.signal });
  document.addEventListener("keydown", (event) => {
    if (!desktop.matches || !visible || event.defaultPrevented || event.repeat
      || event.altKey || event.ctrlKey || event.metaKey || event.shiftKey
      || document.documentElement.classList.contains("nav-is-open")) return;
    if (event.target instanceof Element
      && event.target.closest('input, textarea, select, button, a, [contenteditable]:not([contenteditable="false"]), [role="textbox"]')
      && ![toggle, previous, next].some(control => control.contains(event.target))) return;
    if (![" ", "ArrowLeft", "ArrowRight"].includes(event.key)) return;
    event.preventDefault();
    const control = event.key === " " ? toggle : event.key === "ArrowLeft" ? previous : next;
    control.getAnimations().forEach(animation => animation.cancel());
    control.animate([
      { transform: "scale(1)" },
      { transform: "scale(0.88)", offset: 0.25 },
      { transform: "scale(1.06)", offset: 0.65 },
      { transform: "scale(1)" }
    ], { duration: 240, easing: "ease-out" });
    control.click();
  }, { signal: controller.signal });
  return () => {
    generation++;
    clearTimeout(midpointTimer);
    progress.cancel();
    observer.disconnect();
    menuObserver.disconnect();
    controller.abort();
  };
}

function initPreviews(main) {
  const holdMs = 5000;
  const fadeMs = 480;
  const mobile = window.matchMedia("(max-width: 860px)");
  const players = [];
  let disposed = false;

  main.querySelectorAll(".preview-image-stack").forEach((stack) => {
    if (stack.closest("[data-phone-panel]")) return;
    const images = [...stack.querySelectorAll("img")];
    if (images.length < 2) return;
    let index = 0;
    let visible = false;
    let timer;
    let fadeTimer;
    let incoming;

    const isActiveItem = () => {
      const sharedPanel = stack.closest("[data-phone-panel]");
      if (sharedPanel) return sharedPanel.classList.contains("is-active");
      return stack.closest("[data-feature]")?.classList.contains("is-active-item");
    };
    const canPlay = () => !disposed && visible && !document.hidden
      && (mobile.matches || main.dataset.demosPaused !== "true")
      && !document.documentElement.classList.contains("nav-is-open")
      && (mobile.matches || isActiveItem());

    function commit() {
      if (!incoming) return;
      images[index].classList.remove("is-current");
      incoming.classList.remove("is-incoming");
      incoming.classList.add("is-current");
      index = images.indexOf(incoming);
      incoming = null;
    }

    function pause() {
      clearTimeout(timer);
      clearTimeout(fadeTimer);
      timer = fadeTimer = null;
      commit();
    }

    function schedule() {
      if (!canPlay() || timer || fadeTimer) return;
      timer = setTimeout(advance, holdMs);
    }

    async function advance() {
      timer = null;
      if (!canPlay()) return;
      const target = images[(index + 1) % images.length];
      try { await target.decode(); } catch { schedule(); return; }
      if (!canPlay()) return;
      incoming = target;
      incoming.classList.add("is-incoming");
      fadeTimer = setTimeout(() => {
        fadeTimer = null;
        commit();
        schedule();
      }, fadeMs);
    }

    function update() {
      if (canPlay()) schedule();
      else pause();
    }

    players.push({ stack, setVisible(value) { visible = value; update(); }, update, pause });
  });

  const observer = new IntersectionObserver((entries) => {
    for (const entry of entries) {
      players.find((player) => player.stack === entry.target)?.setVisible(entry.isIntersecting);
    }
  }, { rootMargin: "100px" });
  players.forEach((player) => observer.observe(player.stack));
  const updateAll = () => players.forEach((player) => player.update());
  main.addEventListener("featurechange", updateAll);
  document.addEventListener("visibilitychange", updateAll);
  mobile.addEventListener("change", updateAll);
  const menuObserver = new MutationObserver(updateAll);
  menuObserver.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });

  return () => {
    disposed = true;
    observer.disconnect();
    menuObserver.disconnect();
    main.removeEventListener("featurechange", updateAll);
    document.removeEventListener("visibilitychange", updateAll);
    mobile.removeEventListener("change", updateAll);
    players.forEach((player) => player.pause());
  };
}

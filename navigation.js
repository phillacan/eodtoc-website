import { initPageNavigation } from "./page-navigation.js?v=27";

(() => {
  const header = document.querySelector(".top-bar");
  const navigation = document.querySelector(".site-nav");
  const menuToggle = document.querySelector(".nav-menu-toggle");
  const brand = document.querySelector(".site-brand");
  const brandMotion = window.matchMedia("(hover: hover)");

  brand.addEventListener("pointerenter", () => {
    if (brandMotion.matches) brand.classList.add("is-gradient-cycling");
  });
  function finishBrandCycle(event) {
    if (event.animationName === "toc-gradient-cycle") {
      brand.classList.remove("is-gradient-cycling");
    }
  }
  brand.addEventListener("animationend", finishBrandCycle);
  brand.addEventListener("animationcancel", finishBrandCycle);
  brandMotion.addEventListener("change", () => {
    brand.classList.remove("is-gradient-cycling");
  });


  function setMenuOpen(open) {
    header.classList.toggle("is-menu-open", open);
    document.documentElement.classList.toggle("nav-is-open", open);
    document.querySelector("#page-content").inert = open;
    menuToggle.setAttribute("aria-expanded", String(open));
    menuToggle.setAttribute("aria-label", open ? "Close navigation" : "Open navigation");
    menuToggle.querySelector("path").setAttribute("d", open ? "M6 6L18 18M18 6L6 18" : "M4 6h16M4 12h16M4 18h16");
    navigation.inert = header.classList.contains("is-compact") && !open;
  }

  function updateNavigationLayout() {
    const wasCompact = header.classList.contains("is-compact");
    const wasOpen = header.classList.contains("is-menu-open");
    // Measure the full desktop layout before deciding whether it fits.
    header.classList.remove("is-compact");
    const style = getComputedStyle(header);
    const needed = document.querySelector(".site-brand").getBoundingClientRect().width
      + navigation.getBoundingClientRect().width
      + document.querySelector(".nav-actions").getBoundingClientRect().width
      + parseFloat(style.columnGap) * 2
      + parseFloat(style.paddingLeft) + parseFloat(style.paddingRight);
    const compact = window.matchMedia("(max-width: 860px)").matches || needed > header.clientWidth;
    header.classList.toggle("is-compact", compact);
    document.documentElement.style.setProperty("--nav-height", `${header.getBoundingClientRect().height}px`);
    setMenuOpen(compact && wasCompact && wasOpen);
  }

  menuToggle.addEventListener("click", () => {
    const open = menuToggle.getAttribute("aria-expanded") !== "true";
    setMenuOpen(open);
  });
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && header.classList.contains("is-menu-open")) setMenuOpen(false);
  });
  document.addEventListener("click", (event) => {
    if (!header.contains(event.target)) setMenuOpen(false);
  });
  new ResizeObserver(updateNavigationLayout).observe(header);
  document.fonts.ready.then(updateNavigationLayout);
  updateNavigationLayout();

  initPageNavigation(() => {
    setMenuOpen(false);
    updateNavigationLayout();
  });
})();

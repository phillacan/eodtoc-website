const pagePaths = new Set(["/", "/security/", "/status/", "/support/", "/privacy/"]);

function pagePath(url) {
  return url.pathname.replace(/index\.html$/, "").replace(/\/?$/, "/");
}

function resolveLinks(container, base) {
  // Fetched HTML keeps its own relative URLs, even after the address changes.
  container.querySelectorAll("[href], [src]").forEach((element) => {
    for (const attribute of ["href", "src"]) {
      if (element.hasAttribute(attribute)) {
        element.setAttribute(attribute, new URL(element.getAttribute(attribute), base).href);
      }
    }
  });
}

async function loadStyles(page, base) {
  const existing = new Set([...document.querySelectorAll('link[rel="stylesheet"]')].map((link) => link.href));
  await Promise.all([...page.querySelectorAll('link[rel="stylesheet"]')].map((source) => {
    const url = new URL(source.getAttribute("href"), base);
    if (existing.has(url.href)) return;
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = url.href;
    // External icon fonts shouldn't hold up navigation if their CDN is slow.
    if (url.origin !== location.origin) {
      document.head.append(link);
      return;
    }
    return new Promise((resolve, reject) => {
      link.onload = resolve;
      link.onerror = () => {
        link.remove();
        reject(new Error(`Unable to load ${url.href}`));
      };
      document.head.append(link);
    });
  }));
}

export function initPageNavigation(onPageChange) {
  const header = document.querySelector(".top-bar");
  resolveLinks(header, location.href);
  let currentURL = new URL(location.href);
  let request;
  let pageController = new AbortController();
  let disposePage = () => {};
  let scrollFrame;

  async function initializePage(url, signal) {
    const main = document.querySelector("main");
    if (pagePath(url) === "/") {
      const { initHome } = await import("./home.js?v=25");
      if (!signal.aborted) disposePage = initHome(main);
    } else if (pagePath(url) === "/status/") {
      const { initStatus } = await import("./status/status.js?v=3");
      if (!signal.aborted) await initStatus(main, signal);
    }
  }

  function markCurrentPage(url) {
    header.querySelectorAll(".site-nav a").forEach((link) => {
      if (pagePath(new URL(link.href)) === pagePath(url)) link.setAttribute("aria-current", "page");
      else link.removeAttribute("aria-current");
    });
  }

  function saveScroll() {
    if (location.href === currentURL.href) {
      history.replaceState({ ...history.state, scroll: [scrollX, scrollY] }, "");
    }
  }

  function restorePosition(url, position) {
    if (position) {
      window.scrollTo({ left: position[0], top: position[1], behavior: "instant" });
    } else if (url.hash) {
      let id = url.hash.slice(1);
      try { id = decodeURIComponent(id); } catch { /* Keep a malformed fragment literal. */ }
      const target = document.getElementById(id);
      if (target) target.scrollIntoView({ behavior: "instant" });
      else window.scrollTo({ top: 0, behavior: "instant" });
    } else {
      window.scrollTo({ top: 0, behavior: "instant" });
    }
  }

  async function navigate(url, { historyChange = false, position } = {}) {
    request?.abort();
    const controller = new AbortController();
    request = controller;
    const signal = controller.signal;
    const content = document.querySelector("#page-content");
    try {
      const response = await fetch(url, { signal, headers: { Accept: "text/html" } });
      if (!response.ok || !response.headers.get("content-type")?.includes("text/html")) {
        throw new Error("Page unavailable");
      }
      const page = new DOMParser().parseFromString(await response.text(), "text/html");
      const nextContent = page.querySelector("#page-content");
      if (!nextContent?.querySelector("main")) throw new Error("Page content unavailable");
      resolveLinks(nextContent, response.url);
      await loadStyles(page, response.url);
      if (signal.aborted) return;

      if (!historyChange) {
        saveScroll();
        history.pushState({ scroll: null }, "", url);
      }
      pageController.abort();
      disposePage();
      disposePage = () => {};
      pageController = new AbortController();
      const pageSignal = pageController.signal;
      content.replaceWith(nextContent);
      document.body.className = page.body.className;
      document.title = page.title;
      const description = page.querySelector('meta[name="description"]');
      document.querySelector('meta[name="description"]')?.remove();
      if (description) document.head.append(description);
      currentURL = new URL(url);
      markCurrentPage(url);
      onPageChange();

      await initializePage(url, pageSignal);
      if (signal.aborted || pageSignal.aborted) return;
      requestAnimationFrame(() => {
        if (!signal.aborted) restorePosition(url, position);
      });
    } catch (error) {
      if (!signal.aborted) location.assign(url.href);
    }
  }

  history.scrollRestoration = "manual";
  saveScroll();
  window.addEventListener("scroll", () => {
    cancelAnimationFrame(scrollFrame);
    scrollFrame = requestAnimationFrame(saveScroll);
  }, { passive: true });

  document.addEventListener("click", (event) => {
    const link = event.target.closest("a[href]");
    if (!link || event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey
      || link.hasAttribute("download") || (link.target && link.target !== "_self")) return;
    const url = new URL(link.href);
    if (url.origin !== location.origin || !pagePaths.has(pagePath(url))) return;
    if (url.pathname === location.pathname && url.search === location.search && url.hash) return;
    event.preventDefault();
    navigate(url);
  });

  window.addEventListener("popstate", (event) => {
    const url = new URL(location.href);
    if (url.pathname === currentURL.pathname && url.search === currentURL.search) {
      // Hash navigation within the current document doesn't need another fetch.
      request?.abort();
      currentURL = url;
      restorePosition(url, event.state?.scroll);
    } else {
      navigate(url, { historyChange: true, position: event.state?.scroll });
    }
  });

  window.addEventListener("hashchange", () => {
    const url = new URL(location.href);
    if (url.pathname === currentURL.pathname && url.search === currentURL.search) {
      currentURL = url;
      saveScroll();
    }
  });

  markCurrentPage(currentURL);
  initializePage(currentURL, pageController.signal).catch(() => {});
}

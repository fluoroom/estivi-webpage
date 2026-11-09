/* Estivi — landing page behaviour. No dependencies. */
(() => {
  "use strict";

  const $ = (selector, scope = document) => scope.querySelector(selector);
  const $$ = (selector, scope = document) => Array.from(scope.querySelectorAll(selector));

  document.documentElement.classList.remove("no-js");
  document.documentElement.classList.add("js");

  const motionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
  const canHover = window.matchMedia("(hover: hover) and (pointer: fine)");
  const locale = document.documentElement.lang === "es" ? "es" : "en";

  const strings = {
    en: {
      openMenu: "Open menu",
      closeMenu: "Close menu",
      decoding: (percent) => `decoding ${percent}%`,
      received: "picture received",
      copyFallback: "Copy",
      copied: "Copied",
      copyFailed: "Copy failed",
      modePixels: "pixels",
      modeLines: "lines",
      turnMode: "mode",
      blockFallback: "Block",
      weekDays: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]
    },
    es: {
      openMenu: "Abrir menú",
      closeMenu: "Cerrar menú",
      decoding: (percent) => `decodificando ${percent}%`,
      received: "imagen recibida",
      copyFallback: "Copiar",
      copied: "Copiado",
      copyFailed: "No se pudo copiar",
      modePixels: "píxeles",
      modeLines: "líneas",
      turnMode: "modo",
      blockFallback: "Bloque",
      weekDays: ["lunes", "martes", "miércoles", "jueves", "viernes", "sábado", "domingo"]
    }
  }[locale];

  const localizeModeName = (name) => locale === "es"
    ? name.replace(/colour/g, "color").replace(/black and white/g, "blanco y negro")
    : name;

  const localizeModeFamily = (family) => locale === "es"
    ? family.replace(/colour/g, "color").replace(/black & white/g, "blanco y negro")
    : family;

  /* ------------------------------------------------------------
     Header, mobile menu, scroll state, active section
     ------------------------------------------------------------ */

  const header = $("[data-header]");
  const nav = $("[data-nav]");
  const navToggle = $("[data-nav-toggle]");
  const navScrim = $("[data-nav-scrim]");
  const desktopQuery = window.matchMedia("(min-width: 961px)");
  let lastNavFocus = null;
  let navOpen = false;
  let navFocusTimer = 0;

  function closeNav(restoreFocus = true) {
    window.clearTimeout(navFocusTimer);
    navFocusTimer = 0;
    if (!navOpen) return;
    navOpen = false;
    header.classList.remove("nav-open");
    navToggle.setAttribute("aria-expanded", "false");
    navToggle.setAttribute("aria-label", strings.openMenu);
    document.body.classList.remove("nav-locked");
    if (navScrim) navScrim.hidden = true;
    if (restoreFocus && lastNavFocus instanceof HTMLElement) {
      lastNavFocus.focus({ preventScroll: true });
    }
  }

  function openNav() {
    if (navOpen || desktopQuery.matches) return;
    navOpen = true;
    lastNavFocus = document.activeElement;
    header.classList.add("nav-open");
    navToggle.setAttribute("aria-expanded", "true");
    navToggle.setAttribute("aria-label", strings.closeMenu);
    document.body.classList.add("nav-locked");
    if (navScrim) navScrim.hidden = false;
    const firstLink = nav ? nav.querySelector("a") : null;
    if (firstLink) {
      navFocusTimer = window.setTimeout(() => firstLink.focus({ preventScroll: true }), 30);
    }
  }

  if (header && nav && navToggle) {
    navToggle.addEventListener("click", () => {
      if (navOpen) closeNav();
      else openNav();
    });

    nav.addEventListener("click", (event) => {
      if (event.target.closest("a")) closeNav(false);
    });

    if (navScrim) navScrim.addEventListener("click", () => closeNav());

    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape" && navOpen) closeNav();
    });

    const onBreakpointChange = (event) => {
      if (event.matches) closeNav(false);
    };
    if (desktopQuery.addEventListener) desktopQuery.addEventListener("change", onBreakpointChange);
    else desktopQuery.addListener(onBreakpointChange);
  }

  const navLinks = $$("[data-nav-link]");
  const sections = navLinks
    .map((link) => {
      const id = link.getAttribute("href");
      return id && id.startsWith("#") ? document.getElementById(id.slice(1)) : null;
    })
    .filter(Boolean);

  let scrollTicking = false;

  function updateScrollState() {
    if (header) header.classList.toggle("is-scrolled", window.scrollY > 12);

    if (sections.length) {
      const probe = 150;
      let current = null;
      for (const section of sections) {
        const rect = section.getBoundingClientRect();
        if (rect.top <= probe && rect.bottom > probe) {
          current = section;
          break;
        }
      }
      for (const link of navLinks) {
        const active = current !== null && link.getAttribute("href") === `#${current.id}`;
        link.classList.toggle("is-active", active);
        if (active) link.setAttribute("aria-current", "location");
        else link.removeAttribute("aria-current");
      }
    }
    scrollTicking = false;
  }

  function onScroll() {
    if (scrollTicking) return;
    scrollTicking = true;
    window.requestAnimationFrame(updateScrollState);
  }

  window.addEventListener("scroll", onScroll, { passive: true });
  window.addEventListener("resize", onScroll, { passive: true });
  updateScrollState();

  /* ------------------------------------------------------------
     UTC clock in the receiver chrome
     ------------------------------------------------------------ */

  const clock = $("[data-clock]");
  if (clock) {
    const tickClock = () => {
      const now = new Date();
      clock.textContent = `UTC ${now.toISOString().slice(11, 19)}`;
    };
    tickClock();
    window.setInterval(tickClock, 1000);
  }

  /* ------------------------------------------------------------
     Receiver visor: a progressive "decode" of the demo picture
     ------------------------------------------------------------ */

  const visor = $("[data-visor]");
  const visorScreen = $("[data-visor-screen]", visor || document);
  const visorBar = $("[data-visor-bar]", visor || document);
  const visorStatus = $("[data-visor-status]", visor || document);
  const replayButton = $("[data-replay]", visor || document);

  if (visor && visorScreen && visorBar && visorStatus) {
    const DURATION = 6400;
    const HOLD = 3200;
    let visorFrame = 0;
    let visorStartedAt = 0;
    let holdTimer = 0;
    let visorVisible = false;

    const setProgress = (progress) => {
      const value = Math.max(0, Math.min(progress, 1));
      visorScreen.style.setProperty("--scan", `${(value * 100).toFixed(3)}%`);
      visorBar.style.transform = `scaleX(${value.toFixed(4)})`;
      if (value >= 1) {
        visorStatus.textContent = strings.received;
      } else {
        visorStatus.textContent = strings.decoding(Math.round(value * 100));
      }
    };

    const stopVisor = () => {
      window.cancelAnimationFrame(visorFrame);
      window.clearTimeout(holdTimer);
      visorFrame = 0;
      holdTimer = 0;
      visor.classList.remove("is-scanning");
    };

    const tickVisor = (timestamp) => {
      if (!visorStartedAt) visorStartedAt = timestamp;
      const progress = Math.min((timestamp - visorStartedAt) / DURATION, 1);
      setProgress(progress);

      if (progress < 1) {
        visorFrame = window.requestAnimationFrame(tickVisor);
      } else {
        visorFrame = 0;
        visor.classList.remove("is-scanning");
        holdTimer = window.setTimeout(() => {
          holdTimer = 0;
          if (visorVisible && !motionQuery.matches) startVisor();
        }, HOLD);
      }
    };

    function startVisor() {
      stopVisor();
      if (motionQuery.matches) {
        setProgress(1);
        return;
      }
      visor.classList.add("is-scanning");
      setProgress(0);
      visorStartedAt = 0;
      visorFrame = window.requestAnimationFrame(tickVisor);
    }

    if (replayButton) {
      replayButton.addEventListener("click", () => {
        visorVisible = true;
        startVisor();
      });
    }

    if ("IntersectionObserver" in window) {
      const visorObserver = new IntersectionObserver(
        (entries) => {
          const entry = entries[0];
          if (!entry) return;
          visorVisible = entry.isIntersecting;
          if (visorVisible && !motionQuery.matches) {
            startVisor();
          } else if (!visorVisible) {
            stopVisor();
          }
        },
        { threshold: 0.08 }
      );
      visorObserver.observe(visor);
    } else {
      visorVisible = true;
      startVisor();
    }

    if (motionQuery.matches) setProgress(1);

    const onMotionChange = (event) => {
      if (event.matches) {
        stopVisor();
        setProgress(1);
      } else if (visorVisible) {
        startVisor();
      }
    };
    if (motionQuery.addEventListener) motionQuery.addEventListener("change", onMotionChange);
    else motionQuery.addListener(onMotionChange);
  }

  /* ------------------------------------------------------------
     Reveal on scroll
     ------------------------------------------------------------ */

  const revealElements = $$(".reveal");

  if ("IntersectionObserver" in window && !motionQuery.matches) {
    const pending = [];
    for (const element of revealElements) {
      const rect = element.getBoundingClientRect();
      if (rect.top > window.innerHeight * 0.9) {
        element.classList.add("reveal-pending");
        pending.push(element);
      }
    }

    if (pending.length) {
      const revealObserver = new IntersectionObserver(
        (entries) => {
          for (const entry of entries) {
            if (!entry.isIntersecting) continue;
            entry.target.classList.remove("reveal-pending");
            entry.target.classList.add("is-visible");
            revealObserver.unobserve(entry.target);
          }
        },
        { rootMargin: "0px 0px -6% 0px", threshold: 0.06 }
      );
      for (const element of pending) revealObserver.observe(element);
    }
  }

  /* ------------------------------------------------------------
     Week schedule: select a block, inspect the turn
     ------------------------------------------------------------ */

  const week = $("[data-week]");

  const weekBase = {
    ajuste: {
      title: "Ajuste y paisaje",
      mode: "Martin M1",
      picture: "atardecer.png",
      preview: "/assets/img/atardecer.webp"
    },
    noticias: {
      title: "Noticias LU1AQY",
      mode: "Scottie S1",
      picture: "atardecer.png",
      preview: "/assets/img/atardecer.webp"
    },
    radio: {
      title: "Radio Club",
      mode: "Martin M1",
      picture: "carta-de-ajuste.png",
      preview: "/assets/img/carta.webp"
    },
    ronda: {
      title: "Ronda DX",
      mode: "Scottie S1",
      picture: "atardecer.png",
      preview: "/assets/img/atardecer.webp"
    },
    cierre: {
      title: "Cierre",
      mode: "Martin M1",
      picture: "carta-de-ajuste.png",
      preview: "/assets/img/carta.webp"
    }
  };

  const weekCopy = {
    en: {
      ajuste: {
        when: "12:00–15:00 · Mon–Fri",
        desc: "An afternoon of slow sunsets and tuning cards, on repeat.",
        runs: "Every 10 min",
        previewAlt: "The demo channel's sunset picture, sent by Ajuste y paisaje.",
        pieces: [["Welcome", "R36"], ["Picture", "M1"], ["Bumper post", "R12"], ["Bye", "R24"]]
      },
      noticias: {
        when: "21:00–23:00 · Mon–Fri",
        desc: "The evening bulletin, with a sunset and the station’s callsign.",
        runs: "Every 10 min",
        previewAlt: "The demo channel's sunset picture, sent by Noticias LU1AQY.",
        pieces: [["Welcome", "R36"], ["Picture", "S1"], ["Bumper post", "R12"], ["Bye", "R24"]]
      },
      radio: {
        when: "19:00–20:00 · Tue, Thu",
        desc: "The club’s weekly slot, with its card and callsign.",
        runs: "Every 10 min",
        previewAlt: "The demo channel's colour tuning card, sent by Radio Club.",
        pieces: [["Welcome", "R36"], ["Picture", "M1"], ["Bumper post", "BW8"], ["Bye", "R24"]]
      },
      ronda: {
        when: "23:00–00:30 · Mon–Fri",
        desc: "The late net, crossing midnight without breaking the block.",
        runs: "Every 10 min",
        previewAlt: "The demo channel's sunset picture, sent by Ronda DX.",
        pieces: [["Welcome", "R36"], ["Picture", "S1"], ["Bumper post", "R12"], ["Bye", "R24"]]
      },
      cierre: {
        when: "23:45–23:55 · one date",
        desc: "A single card on a single date. Move it, skip it, delete it.",
        runs: "One-off block",
        previewAlt: "The demo channel's colour tuning card, sent by Cierre.",
        pieces: [["Picture", "M1"], ["Bye", "R24"]]
      }
    },
    es: {
      ajuste: {
        when: "12:00–15:00 · Lun–Vie",
        desc: "Una tarde de atardeceres lentos y cartas de ajuste, en repetición.",
        runs: "Cada 10 min",
        previewAlt: "La imagen de atardecer del canal de ejemplo, enviada por Ajuste y paisaje.",
        pieces: [["Bienvenida", "R36"], ["Imagen", "M1"], ["Cortina posterior", "R12"], ["Despedida", "R24"]]
      },
      noticias: {
        when: "21:00–23:00 · Lun–Vie",
        desc: "El boletín de la noche, con un atardecer y el indicativo de la estación.",
        runs: "Cada 10 min",
        previewAlt: "La imagen de atardecer del canal de ejemplo, enviada por Noticias LU1AQY.",
        pieces: [["Bienvenida", "R36"], ["Imagen", "S1"], ["Cortina posterior", "R12"], ["Despedida", "R24"]]
      },
      radio: {
        when: "19:00–20:00 · Mar, Jue",
        desc: "El espacio semanal del club, con su tarjeta y su indicativo.",
        runs: "Cada 10 min",
        previewAlt: "La carta de ajuste en color del canal de ejemplo, enviada por Radio Club.",
        pieces: [["Bienvenida", "R36"], ["Imagen", "M1"], ["Cortina posterior", "BW8"], ["Despedida", "R24"]]
      },
      ronda: {
        when: "23:00–00:30 · Lun–Vie",
        desc: "La ronda de la noche, que cruza la medianoche sin partir el bloque.",
        runs: "Cada 10 min",
        previewAlt: "La imagen de atardecer del canal de ejemplo, enviada por Ronda DX.",
        pieces: [["Bienvenida", "R36"], ["Imagen", "S1"], ["Cortina posterior", "R12"], ["Despedida", "R24"]]
      },
      cierre: {
        when: "23:45–23:55 · una fecha",
        desc: "Una tarjeta en una sola fecha. Movela, salteala o borrala.",
        runs: "Bloque único",
        previewAlt: "La carta de ajuste en color del canal de ejemplo, enviada por Cierre.",
        pieces: [["Imagen", "M1"], ["Despedida", "R24"]]
      }
    }
  };

  const weekData = {};
  for (const key of Object.keys(weekBase)) {
    weekData[key] = { ...weekBase[key], ...weekCopy[locale][key] };
  }

  if (week) {
    const weekButtons = $$("[data-block]", week);
    const panel = $("[data-week-panel]", week);
    const panelTitle = $("[data-week-title]", week);
    const panelWhen = $("[data-week-when]", week);
    const panelDesc = $("[data-week-desc]", week);
    const panelRuns = $("[data-week-runs]", week);
    const panelMode = $("[data-week-mode]", week);
    const panelPicture = $("[data-week-picture]", week);
    const panelPreview = $("[data-week-img]", week);
    const panelPreviewMode = $("[data-week-preview-mode]", week);
    const panelTurn = $("[data-week-turn]", week);

    const renderTurn = (pieces) => {
      if (!panelTurn) return;
      const fragment = document.createDocumentFragment();
      for (const [role, code] of pieces) {
        const item = document.createElement("li");
        const label = document.createElement("span");
        const mode = document.createElement("code");
        label.textContent = role;
        mode.textContent = code;
        item.setAttribute("aria-label", `${role}, ${strings.turnMode} ${code}`);
        item.append(label, mode);
        fragment.append(item);
      }
      panelTurn.replaceChildren(fragment);
    };

    const dayNames = strings.weekDays;
    $$(".calendar__col", week).forEach((column, index) => {
      for (const button of $$("[data-block]", column)) {
        const title = button.querySelector(".event__title");
        const time = button.querySelector(".event__time");
        const titleText = title ? title.textContent.trim() : strings.blockFallback;
        const timeText = time ? time.textContent.trim() : "";
        const label = [titleText, timeText].filter(Boolean).join(" ");
        button.setAttribute("aria-label", `${label}${dayNames[index] ? `, ${dayNames[index]}` : ""}`);
      }
    });

    const selectBlock = (key) => {
      const data = weekData[key];
      if (!data) return;

      for (const button of weekButtons) {
        const selected = button.getAttribute("data-block") === key;
        button.classList.toggle("is-selected", selected);
        button.setAttribute("aria-pressed", String(selected));
      }

      if (panelTitle) panelTitle.textContent = data.title;
      if (panelWhen) panelWhen.textContent = data.when;
      if (panelDesc) panelDesc.textContent = data.desc;
      if (panelRuns) panelRuns.textContent = data.runs;
      if (panelMode) panelMode.textContent = data.mode;
      if (panelPicture) panelPicture.textContent = data.picture;
      if (panelPreview) {
        panelPreview.src = data.preview;
        panelPreview.alt = data.previewAlt;
      }
      if (panelPreviewMode) panelPreviewMode.textContent = data.mode;
      renderTurn(data.pieces);

      if (panel && !motionQuery.matches) {
        panel.classList.remove("is-switching");
        void panel.offsetWidth;
        panel.classList.add("is-switching");
      }
    };

    week.addEventListener("click", (event) => {
      const button = event.target.closest("[data-block]");
      if (!button) return;
      selectBlock(button.getAttribute("data-block"));
    });

    selectBlock("noticias");
  }

  /* ------------------------------------------------------------
     Mode explorer
     ------------------------------------------------------------ */

  const modeData = {
    M1: { name: "Martin M1", family: "Martin · colour", w: 320, h: 256, lines: 256, vis: "0x2C" },
    M2: { name: "Martin M2", family: "Martin · colour", w: 320, h: 256, lines: 256, vis: "0x28" },
    M3: { name: "Martin M3", family: "Martin · colour", w: 320, h: 256, lines: 128, vis: "0x24" },
    M4: { name: "Martin M4", family: "Martin · colour", w: 320, h: 256, lines: 128, vis: "0x20" },
    S1: { name: "Scottie S1", family: "Scottie · colour", w: 320, h: 256, lines: 256, vis: "0x3C" },
    S2: { name: "Scottie S2", family: "Scottie · colour", w: 320, h: 256, lines: 256, vis: "0x38" },
    SDX: { name: "Scottie DX", family: "Scottie · colour", w: 320, h: 256, lines: 256, vis: "0x4C" },
    R24: { name: "Robot 24", family: "Robot · colour", w: 160, h: 120, lines: 120, vis: "0x04" },
    R36: { name: "Robot 36", family: "Robot · colour", w: 320, h: 240, lines: 240, vis: "0x08" },
    R72: { name: "Robot 72", family: "Robot · colour", w: 320, h: 240, lines: 240, vis: "0x0C" },
    R12: { name: "Robot 12 colour", family: "Robot · colour", w: 160, h: 120, lines: 120, vis: "0x00" },
    BW8: { name: "Robot 8 black and white", family: "Robot · black & white", w: 160, h: 120, lines: 120, vis: "0x02" },
    BW12: { name: "Robot 12 black and white", family: "Robot · black & white", w: 160, h: 120, lines: 120, vis: "0x06" },
    BW24: { name: "Robot 24 black and white", family: "Robot · black & white", w: 320, h: 240, lines: 240, vis: "0x0A" },
    PD50: { name: "PD 50", family: "PD · colour", w: 320, h: 256, lines: 128, vis: "0x5D" },
    PD90: { name: "PD 90", family: "PD · colour", w: 320, h: 256, lines: 128, vis: "0x63" },
    PD120: { name: "PD 120", family: "PD · colour", w: 640, h: 496, lines: 248, vis: "0x5F" },
    PD160: { name: "PD 160", family: "PD · colour", w: 512, h: 400, lines: 200, vis: "0x62" },
    PD180: { name: "PD 180", family: "PD · colour", w: 640, h: 496, lines: 248, vis: "0x60" },
    PD240: { name: "PD 240", family: "PD · colour", w: 640, h: 496, lines: 248, vis: "0x61" },
    PD290: { name: "PD 290", family: "PD · colour", w: 800, h: 616, lines: 308, vis: "0x5E" },
    YQ: { name: "YoniQ", family: "YoniQ · colour", w: 320, h: 256, lines: 128, vis: "0x73" }
  };

  const modeButtons = $$("[data-mode]");
  const modeReadout = $("[data-mode-readout]");

  if (modeButtons.length && modeReadout) {
    const modeFamily = $("[data-mode-family]", modeReadout);
    const modeCode = $("[data-mode-code]", modeReadout);
    const modeName = $("[data-mode-name]", modeReadout);
    const modeSize = $("[data-mode-size]", modeReadout);
    const modeLines = $("[data-mode-lines]", modeReadout);
    const modeVis = $("[data-mode-vis]", modeReadout);
    const modeDims = $("[data-mode-dims]", modeReadout);
    const modeFrame = $("[data-mode-frame]", modeReadout);
    const modeRect = $("[data-mode-rect]", modeReadout);
    const modeScreen = modeRect ? modeRect.parentElement : null;
    let currentMode = "M1";

    for (const button of modeButtons) {
      const data = modeData[button.getAttribute("data-mode")];
      if (data) {
        const name = localizeModeName(data.name);
        button.setAttribute(
          "aria-label",
          `${button.getAttribute("data-mode")}, ${name} — ${data.w} × ${data.h} ${strings.modePixels}, ${data.lines} ${strings.modeLines}, VIS ${data.vis}`
        );
      }
    }

    const sizeRect = () => {
      if (!modeRect || !modeScreen) return;
      const data = modeData[currentMode];
      if (!data) return;
      const availableWidth = Math.max(40, modeScreen.clientWidth - 26);
      const availableHeight = Math.max(30, modeScreen.clientHeight - 26);
      const scale = Math.max(0.08, Math.min(availableWidth / data.w, availableHeight / data.h));
      modeRect.style.width = `${Math.round(data.w * scale)}px`;
      modeRect.style.height = `${Math.round(data.h * scale)}px`;
    };

    const selectMode = (code) => {
      const data = modeData[code];
      if (!data) return;
      currentMode = code;

      for (const button of modeButtons) {
        button.setAttribute("aria-pressed", String(button.getAttribute("data-mode") === code));
      }

      if (modeFamily) modeFamily.textContent = localizeModeFamily(data.family);
      if (modeCode) modeCode.textContent = code;
      if (modeName) modeName.textContent = localizeModeName(data.name);
      if (modeSize) modeSize.textContent = `${data.w} × ${data.h}`;
      if (modeLines) modeLines.textContent = String(data.lines);
      if (modeVis) modeVis.textContent = data.vis;
      if (modeDims) modeDims.textContent = `${data.w} × ${data.h}`;
      if (modeFrame) modeFrame.textContent = code;
      sizeRect();
    };

    for (const button of modeButtons) {
      button.addEventListener("click", () => selectMode(button.getAttribute("data-mode")));
    }

    selectMode("M1");

    if ("ResizeObserver" in window && modeScreen) {
      const modeResizeObserver = new ResizeObserver(sizeRect);
      modeResizeObserver.observe(modeScreen);
    } else {
      window.addEventListener("resize", sizeRect, { passive: true });
    }
  }

  /* ------------------------------------------------------------
     Screenshot gallery + lightbox
     ------------------------------------------------------------ */

  const gallery = $("[data-gallery]");

  const galleryBase = {
    grid: { source: "https://github.com/fluoroom/estivi-tx", sourceLabel: "estivi-tx" },
    programs: { source: "https://github.com/fluoroom/estivi-tx", sourceLabel: "estivi-tx" },
    graphics: { source: "https://github.com/fluoroom/estivi-tx", sourceLabel: "estivi-tx" },
    receiver: { source: "https://github.com/fluoroom/estivi-rx", sourceLabel: "estivi-rx" },
    calendar: { source: "https://github.com/fluoroom/estivi-rx", sourceLabel: "estivi-rx" }
  };

  const galleryCopy = {
    en: {
      grid: {
        title: "The station at a glance",
        desc: "The weekly grid, the next transmission, and the selected block’s timeline."
      },
      programs: {
        title: "Programs that repeat",
        desc: "Every weekday keeps its own start, end, and interval. Turning one on copies the last schedule."
      },
      graphics: {
        title: "Graphics without another tool",
        desc: "Channel, program, and block layers stand over the next live picture."
      },
      receiver: {
        title: "The listener",
        desc: "The visor, the timeline, and the station’s hour row, all on one page."
      },
      calendar: {
        title: "Thirty days ahead",
        desc: "The guide becomes a calendar, with local times and callsigns. Only days with programs appear."
      }
    },
    es: {
      grid: {
        title: "La estación de un vistazo",
        desc: "La grilla semanal, la próxima transmisión y la línea de tiempo del bloque elegido."
      },
      programs: {
        title: "Programas que se repiten",
        desc: "Cada día conserva su inicio, fin e intervalo. Activar uno copia la última agenda."
      },
      graphics: {
        title: "Gráficos sin otra herramienta",
        desc: "Las capas de canal, programa y bloque se apoyan sobre la próxima imagen en vivo."
      },
      receiver: {
        title: "El receptor",
        desc: "El visor, la línea de tiempo y la fila de horas de la estación, en una sola página."
      },
      calendar: {
        title: "Treinta días por delante",
        desc: "La guía se vuelve calendario, con horas locales e indicativos. Solo aparecen los días con programas."
      }
    }
  };

  const galleryData = {};
  for (const key of Object.keys(galleryBase)) {
    galleryData[key] = { ...galleryBase[key], ...galleryCopy[locale][key] };
  }

  if (gallery) {
    const tabs = $$("[data-gallery-tab]", gallery);
    const panels = $$("[data-gallery-panel]", gallery);
    const captionTitle = $("[data-gallery-title]", gallery);
    const captionDesc = $("[data-gallery-desc]", gallery);
    const captionSource = $("[data-gallery-source]", gallery);
    const captionSourceLabel = $("[data-gallery-source-label]", gallery);
    let activeKey = tabs.find((tab) => tab.getAttribute("aria-selected") === "true")?.dataset.galleryTab || "grid";

    const selectTab = (key, focusTab = false) => {
      if (!galleryData[key]) return;
      activeKey = key;

      for (const tab of tabs) {
        const isActive = tab.dataset.galleryTab === key;
        tab.setAttribute("aria-selected", String(isActive));
        tab.tabIndex = isActive ? 0 : -1;
        if (isActive && focusTab) tab.focus();
      }
      for (const panel of panels) {
        panel.hidden = panel.dataset.galleryPanel !== key;
      }

      const data = galleryData[key];
      if (captionTitle) captionTitle.textContent = data.title;
      if (captionDesc) captionDesc.textContent = data.desc;
      if (captionSource) captionSource.setAttribute("href", data.source);
      if (captionSourceLabel) captionSourceLabel.textContent = data.sourceLabel;
    };

    for (const tab of tabs) {
      tab.addEventListener("click", () => selectTab(tab.dataset.galleryTab));
      tab.addEventListener("keydown", (event) => {
        const index = tabs.indexOf(tab);
        let nextIndex = null;
        if (event.key === "ArrowRight") nextIndex = (index + 1) % tabs.length;
        else if (event.key === "ArrowLeft") nextIndex = (index - 1 + tabs.length) % tabs.length;
        else if (event.key === "Home") nextIndex = 0;
        else if (event.key === "End") nextIndex = tabs.length - 1;
        if (nextIndex !== null) {
          event.preventDefault();
          selectTab(tabs[nextIndex].dataset.galleryTab, true);
        }
      });
    }

    const dialog = $("[data-lightbox]");
    const lightboxImage = dialog ? $("[data-lightbox-img]", dialog) : null;
    const lightboxTitle = dialog ? $("[data-lightbox-title]", dialog) : null;
    const lightboxDesc = dialog ? $("[data-lightbox-desc]", dialog) : null;
    const lightboxCount = dialog ? $("[data-lightbox-count]", dialog) : null;
    const lightboxClose = dialog ? $("[data-lightbox-close]", dialog) : null;
    const lightboxPrev = dialog ? $("[data-lightbox-prev]", dialog) : null;
    const lightboxNext = dialog ? $("[data-lightbox-next]", dialog) : null;
    const galleryKeys = tabs.map((tab) => tab.dataset.galleryTab);
    let lightboxIndex = 0;

    const updateLightbox = (index) => {
      if (!dialog || !lightboxImage) return;
      lightboxIndex = (index + galleryKeys.length) % galleryKeys.length;
      const key = galleryKeys[lightboxIndex];
      const data = galleryData[key];
      const panel = panels.find((item) => item.dataset.galleryPanel === key);
      const sourceImage = panel ? panel.querySelector("img") : null;
      if (!sourceImage || !data) return;

      lightboxImage.src = sourceImage.currentSrc || sourceImage.src;
      lightboxImage.alt = sourceImage.alt;
      if (lightboxTitle) lightboxTitle.textContent = data.title;
      if (lightboxDesc) lightboxDesc.textContent = data.desc;
      if (lightboxCount) lightboxCount.textContent = `${lightboxIndex + 1} / ${galleryKeys.length}`;
      selectTab(key);
    };

    const openLightbox = () => {
      if (!dialog || !lightboxImage) return;
      const index = galleryKeys.indexOf(activeKey);
      updateLightbox(index >= 0 ? index : 0);
      if (typeof dialog.showModal === "function") {
        dialog.showModal();
        document.body.classList.add("modal-open");
        if (lightboxClose) lightboxClose.focus();
      } else {
        window.open(lightboxImage.src, "_blank", "noopener");
      }
    };

    const closeLightbox = () => {
      if (!dialog || !dialog.open) return;
      dialog.close();
    };

    for (const openButton of $$("[data-lightbox-open]", gallery)) {
      openButton.addEventListener("click", openLightbox);
    }

    if (dialog) {
      if (lightboxClose) lightboxClose.addEventListener("click", closeLightbox);
      if (lightboxPrev) lightboxPrev.addEventListener("click", () => updateLightbox(lightboxIndex - 1));
      if (lightboxNext) lightboxNext.addEventListener("click", () => updateLightbox(lightboxIndex + 1));

      dialog.addEventListener("click", (event) => {
        if (event.target === dialog) closeLightbox();
      });

      dialog.addEventListener("keydown", (event) => {
        if (event.key === "ArrowLeft") {
          event.preventDefault();
          updateLightbox(lightboxIndex - 1);
        } else if (event.key === "ArrowRight") {
          event.preventDefault();
          updateLightbox(lightboxIndex + 1);
        }
      });

      dialog.addEventListener("close", () => {
        document.body.classList.remove("modal-open");
        const activePanel = panels.find((panel) => !panel.hidden);
        const trigger = activePanel ? activePanel.querySelector("[data-lightbox-open]") : null;
        if (trigger) trigger.focus({ preventScroll: true });
      });
    }

    selectTab(activeKey);
  }

  /* ------------------------------------------------------------
     Copy buttons
     ------------------------------------------------------------ */

  const copyTimers = new WeakMap();

  const fallbackCopy = (text) => {
    const area = document.createElement("textarea");
    area.value = text;
    area.setAttribute("readonly", "");
    area.style.position = "fixed";
    area.style.top = "-1000px";
    area.style.opacity = "0";
    document.body.appendChild(area);
    area.select();
    const copied = document.execCommand("copy");
    area.remove();
    return copied;
  };

  const copyText = async (text) => {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text);
      return true;
    }
    return fallbackCopy(text);
  };

  for (const button of $$("[data-copy-target]")) {
    const target = document.getElementById(button.getAttribute("data-copy-target"));
    if (!target) continue;
    const label = button.querySelector("span");
    const use = button.querySelector("use");
    const originalLabel = label ? label.textContent : strings.copyFallback;
    const originalHref = use ? use.getAttribute("href") : null;

    button.addEventListener("click", async () => {
      const text = target.textContent.trim();
      try {
        const copied = await copyText(text);
        if (!copied) throw new Error("Copy was not accepted");
        button.classList.add("is-copied");
        if (label) label.textContent = strings.copied;
        if (use) use.setAttribute("href", "#i-check");
        window.clearTimeout(copyTimers.get(button));
        copyTimers.set(
          button,
          window.setTimeout(() => {
            button.classList.remove("is-copied");
            if (label) label.textContent = originalLabel;
            if (use && originalHref) use.setAttribute("href", originalHref);
          }, 2000)
        );
      } catch (error) {
        if (label) label.textContent = strings.copyFailed;
        if (use) use.setAttribute("href", "#i-close");
        window.clearTimeout(copyTimers.get(button));
        copyTimers.set(
          button,
          window.setTimeout(() => {
            if (label) label.textContent = originalLabel;
            if (use) use.setAttribute("href", originalHref || "#i-copy");
          }, 2200)
        );
      }
    });
  }

  /* ------------------------------------------------------------
     Pointer spotlight on bento cards
     ------------------------------------------------------------ */

  if (canHover.matches && !motionQuery.matches) {
    for (const card of $$("[data-spotlight]")) {
      card.addEventListener(
        "pointermove",
        (event) => {
          const rect = card.getBoundingClientRect();
          card.style.setProperty("--mx", `${event.clientX - rect.left}px`);
          card.style.setProperty("--my", `${event.clientY - rect.top}px`);
        },
        { passive: true }
      );
    }
  }
})();

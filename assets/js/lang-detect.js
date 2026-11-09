/* Pick a page language before first paint.
 *
 * - An explicit choice (the language links write `estivi-lang`) always wins.
 * - With no choice, the English page redirects to Spanish when the browser
 *   language is Spanish. A direct visit to /es/ is always left alone.
 * - Query strings and anchors survive the redirect.
 */
(function () {
  var root = document.documentElement;

  /* Remember an explicit choice even on pages that do not auto-redirect. */
  document.addEventListener("click", function (event) {
    var target = event.target;
    if (!(target instanceof Element)) return;
    var link = target.closest("[data-set-lang]");
    if (!link) return;
    var language = link.getAttribute("data-set-lang");
    if (language !== "en" && language !== "es") return;
    try {
      window.localStorage.setItem("estivi-lang", language);
    } catch (error) {
      /* Storage may be unavailable; the link still navigates. */
    }
  });

  if (root.hasAttribute("data-no-lang-redirect")) return;

  try {
    var current = root.lang === "es" ? "es" : "en";
    var urls = {
      en: root.getAttribute("data-lang-en") || "/",
      es: root.getAttribute("data-lang-es") || "/es/"
    };
    var stored = null;

    try {
      stored = window.localStorage.getItem("estivi-lang");
    } catch (error) {
      /* Storage can be unavailable; fall back to the browser language. */
    }

    if (stored !== "en" && stored !== "es") stored = null;

    var target = null;

    if (stored) {
      if (stored !== current) target = urls[stored];
    } else if (current === "en") {
      var languages = navigator.languages && navigator.languages.length
        ? navigator.languages
        : [navigator.language || ""];
      var primary = String(languages[0] || "").toLowerCase();
      if (primary.indexOf("es") === 0) target = urls.es;
    }

    if (target) {
      window.location.replace(target + window.location.search + window.location.hash);
    }
  } catch (error) {
    /* Never let language detection stop the page from loading. */
  }
})();

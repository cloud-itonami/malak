// malak.surveillance landing — JP/EN toggle + accessible nav
(function () {
  const KEY = "malak.surv.lang";
  function detect() {
    const stored = localStorage.getItem(KEY);
    if (stored === "ja" || stored === "en") return stored;
    const nav = (navigator.language || "ja").toLowerCase();
    return nav.startsWith("ja") ? "ja" : "en";
  }
  function apply(l) {
    document.documentElement.setAttribute("data-lang", l);
    document.documentElement.setAttribute("lang", l);
    try { localStorage.setItem(KEY, l); } catch {}
  }
  function init() {
    apply(detect());
    const root = document.querySelector(".lang-toggle");
    if (!root) return;
    root.addEventListener("click", function (e) {
      const t = e.target.closest("button[data-set]");
      if (!t) return;
      apply(t.dataset.set);
    });
  }
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else { init(); }
})();

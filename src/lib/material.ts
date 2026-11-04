/*
 * Google's Material Web components (Material 3). Only the components the app uses are imported.
 * Their colours come from --md-sys-color-* tokens, which main.css points at the app's theme tokens,
 * so they follow every palette and mode.
 */
import "@material/web/button/filled-tonal-button.js";
import "@material/web/button/outlined-button.js";
import "@material/web/focus/md-focus-ring.js";
import "@material/web/iconbutton/icon-button.js";
import "@material/web/progress/circular-progress.js";
import "@material/web/ripple/ripple.js";
import "@material/web/switch/switch.js";

/** Material ripple (press feedback) on the app's own buttons, links and nav items. */
const RIPPLE_TARGETS = ".btn, .link-btn, .list-row--link, .nav__item, .text-link, .ex__video, .chip-btn";

export function addRipples(root: ParentNode = document) {
  root.querySelectorAll<HTMLElement>(RIPPLE_TARGETS).forEach((el) => {
    if (el.querySelector(":scope > md-ripple")) return;
    el.classList.add("has-ripple");
    el.prepend(document.createElement("md-ripple"));
  });
}

import { esc, $ } from "../lib/utils";
import { ICON } from "./icons";

/** Small non-blocking notification. Announced politely to screen readers via the live region. */
export function toast(msg: string, type: "info" | "error" = "info") {
  const root = $("#toasts");
  if (!root) return;
  const el = document.createElement("div");
  el.className = `toast toast--${type}`;
  el.innerHTML = `${type === "error" ? ICON.alert : ICON.check}<span>${esc(msg)}</span>`;
  root.append(el);
  while (root.children.length > 3) root.firstElementChild?.remove();
  requestAnimationFrame(() => el.classList.add("is-in"));
  setTimeout(() => {
    el.classList.remove("is-in");
    setTimeout(() => el.remove(), 300);
  }, type === "error" ? 5000 : 2400);
}

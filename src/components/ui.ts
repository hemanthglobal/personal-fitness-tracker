/* Shared presentational helpers. All return HTML strings; inputs are escaped by callers or here. */
import { INTENSITY } from "../data/workout-data";
import type { Intensity } from "../types/workout";
import { esc } from "../lib/utils";
import { ICON } from "./icons";

export const pill = (intensity: Intensity) => `<span class="pill pill--${intensity}">${INTENSITY[intensity].label}</span>`;
export const restPill = () => `<span class="pill pill--rest">Rest</span>`;

export function pageHeader(title: string, opts: { back?: string; backLabel?: string; eyebrow?: string; sub?: string } = {}) {
  return `
    <header class="page-head">
      ${opts.back ? `<a class="back" href="${opts.back}">${ICON.back}<span>${esc(opts.backLabel ?? "Back")}</span></a>` : ""}
      ${opts.eyebrow ? `<p class="eyebrow">${opts.eyebrow}</p>` : ""}
      <h1 class="page-title">${title}</h1>
      ${opts.sub ? `<p class="page-sub">${opts.sub}</p>` : ""}
    </header>`;
}

export const emptyState = (title: string, body: string, action = "") =>
  `<div class="empty"><p class="empty__title">${title}</p><p class="empty__body">${body}</p>${action}</div>`;

export function progressBar(value: number, max: number, label: string) {
  const pct = max ? Math.round((value / max) * 100) : 0;
  return `<div class="bar" role="progressbar" aria-label="${esc(label)}" aria-valuemin="0" aria-valuemax="${max}" aria-valuenow="${value}">
    <span class="bar__fill" style="--w:${pct}%"></span></div>`;
}

export function guidance(intensity: Intensity, hasSupersets: boolean) {
  const I = INTENSITY[intensity];
  return `
    <dl class="guide guide--${intensity}">
      <div><dt>Tempo</dt><dd>${I.tempo}</dd></div>
      <div><dt>Rest</dt><dd>${I.rest}</dd></div>
      ${hasSupersets ? `<div><dt>Supersets</dt><dd>No rest between paired exercises</dd></div>` : ""}
    </dl>`;
}

export const healthNotice = () =>
  `<p class="fineprint fineprint--box">The programme advises consulting your physician before starting any exercise and nutrition programme. This app is a tracking tool, not medical advice.</p>`;

export const listLink = (href: string, icon: string, title: string, sub: string) =>
  `<li><a class="list-row list-row--link list-row--nav" href="${href}">
    <span class="list-row__icon">${icon}</span><span class="list-row__main">${title}<small>${sub}</small></span>${ICON.chevron}</a></li>`;

/*
 * Appearance: two independent choices, like PetXcel's settings.
 *   mode    — light / dark / system (settings.theme)
 *   palette — the colour theme (settings.palette). "classic" is the original look.
 * The root element carries data-palette and the resolved data-mode; every colour is a CSS token,
 * and Material Web's --md-sys-color-* tokens point at the same tokens, so its components follow.
 * Both choices are saved on this device only (never synced).
 */
import type { Theme } from "./state";

export interface PaletteDef { id: string; name: string; desc: string; modes: ("light" | "dark")[] }

export const PALETTES: PaletteDef[] = [
  { id: "classic", name: "Classic Gold", desc: "The original look. Warm neutrals, gold accent", modes: ["light", "dark"] },
  { id: "violet", name: "Material Violet", desc: "Google's Material 3 baseline colours", modes: ["light", "dark"] },
  { id: "ocean", name: "Ocean Teal", desc: "Fresh, calm and focused", modes: ["light", "dark"] },
  { id: "forest", name: "Forest Green", desc: "Natural and steady", modes: ["light", "dark"] },
  { id: "ember", name: "Ember Red", desc: "Bold and energetic", modes: ["light", "dark"] },
  { id: "midnight", name: "Midnight", desc: "Deep blue on near-black. Dark only", modes: ["dark"] },
  { id: "contrast", name: "High Contrast", desc: "Strongest text and edges", modes: ["light", "dark"] },
];

export const DEFAULT_PALETTE = "classic";
export const isPalette = (v: unknown): v is string => typeof v === "string" && PALETTES.some((p) => p.id === v);
export const paletteDef = (id: string): PaletteDef => PALETTES.find((p) => p.id === id) ?? PALETTES[0]!;

const media = typeof matchMedia === "function" ? matchMedia("(prefers-color-scheme: dark)") : null;
export const systemDark = () => !!media?.matches;

/** The mode actually shown: a dark-only palette ignores the mode choice. */
export function resolveMode(palette: string, mode: Theme): "light" | "dark" {
  const def = paletteDef(palette);
  if (def.modes.length === 1) return def.modes[0]!;
  return mode === "system" ? (systemDark() ? "dark" : "light") : mode;
}

export function applyAppearance(palette: string, mode: Theme) {
  const root = document.documentElement;
  root.dataset.palette = paletteDef(palette).id;
  root.dataset.mode = resolveMode(palette, mode);
  const bg = getComputedStyle(root).getPropertyValue("--bg").trim();
  document.querySelectorAll<HTMLMetaElement>('meta[name="theme-color"]').forEach((m) => { if (bg) m.content = bg; });
}

/** Re-resolve "system" when the device switches between light and dark. */
export function onSystemModeChange(fn: () => void) {
  media?.addEventListener("change", fn);
}

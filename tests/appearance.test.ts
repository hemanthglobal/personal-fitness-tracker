import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { EXERCISE_DEMOS, demoFor } from "../src/data/exercise-demos";
import { SWATCHES } from "../src/data/theme-swatches";
import { allExerciseCodes } from "../src/data/workout-data";
import { normalizeState, defaultState } from "../src/lib/state";
import { PALETTES, resolveMode } from "../src/lib/theme";

const root = new URL("../", import.meta.url);

describe("exercise demos", () => {
  it("has a demo for every exercise in the programme, with both frames on disk", () => {
    for (const code of allExerciseCodes()) {
      const d = demoFor(code);
      expect(d, code).not.toBeNull();
      expect(d!.steps.length, code).toBeGreaterThan(0);
      for (const i of [0, 1]) expect(existsSync(new URL(`public/exercises/${d!.id}-${i}.webp`, root)), `${code} frame ${i}`).toBe(true);
    }
  });

  it("has no demos for unknown exercises, and none for custom ones", () => {
    const codes = new Set(allExerciseCodes());
    for (const code of Object.keys(EXERCISE_DEMOS)) expect(codes.has(code), code).toBe(true);
    expect(demoFor("custom_face_pull")).toBeNull();
  });
});

describe("appearance", () => {
  it("keeps the original look as the default palette", () => {
    expect(PALETTES[0]!.id).toBe("classic");
    expect(defaultState().settings.palette).toBe("classic");
  });

  it("has generated CSS and preview colours for every Material palette", () => {
    const css = readFileSync(new URL("src/styles/themes.css", root), "utf8");
    for (const p of PALETTES.filter((x) => x.id !== "classic")) {
      expect(css, p.id).toContain(`[data-palette="${p.id}"]`);
      expect(SWATCHES[p.id], p.id).toBeDefined();
    }
  });

  it("lists the same palettes in the no-flash script in index.html", () => {
    const html = readFileSync(new URL("index.html", root), "utf8");
    const ids = /\^\(([a-z|]+)\)\$/.exec(html)?.[1]?.split("|");
    expect(ids?.sort()).toEqual(PALETTES.map((p) => p.id).sort());
    for (const p of PALETTES.filter((x) => x.modes.length === 1)) expect(html).toContain(`${p.id}: 1`);
  });

  it("forces dark-only palettes to dark and honours explicit modes", () => {
    expect(resolveMode("midnight", "light")).toBe("dark");
    expect(resolveMode("ocean", "light")).toBe("light");
    expect(resolveMode("ocean", "dark")).toBe("dark");
  });

  it("drops unknown palettes from saved data", () => {
    const s = defaultState();
    const raw = JSON.parse(JSON.stringify(s));
    raw.settings.palette = "neon";
    expect(normalizeState(raw).settings.palette).toBe("classic");
    raw.settings.palette = "forest";
    expect(normalizeState(raw).settings.palette).toBe("forest");
  });
});

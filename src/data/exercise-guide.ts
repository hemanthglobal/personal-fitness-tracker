/*
 * Supplementary exercise guidance — NOT from the programme PDF.
 *
 * Breathing cues are general reference guidance (breathe in on the lowering / easier phase,
 * out on the effort; brace on heavy compound lifts). The UI labels them as a general tip.
 *
 * Demo videos: add a URL only after checking it actually demonstrates the named exercise.
 * Leave an entry out (or null) and the card simply shows no demo button.
 */

export interface Breathing { in: string; out: string }

const LOWER_CURL: Breathing = { in: "Lower the weight", out: "Curl up" };
const LOWER_PRESS: Breathing = { in: "Lower the dumbbells", out: "Press up" };
const SHRUG: Breathing = { in: "Lower the shoulders", out: "Shrug up" };
const CALF: Breathing = { in: "Lower the heels", out: "Rise onto your toes" };

/** Keyed by exercise code (src/data/workout-data.ts). Every code must have an entry (tested). */
export const BREATHING: Record<string, Breathing> = {
  // A — Shoulders / Traps
  db_lateral_raise: { in: "Lower the dumbbells", out: "Raise the dumbbells" },
  single_arm_db_overhead_press: { in: "Lower to your shoulder", out: "Press overhead" },
  db_rear_delt_flye: { in: "Lower the dumbbells", out: "Raise the arms out wide" },
  rope_high_pull: { in: "Let the rope return", out: "Pull the rope up" },
  scott_press: LOWER_PRESS,
  cable_shrug: SHRUG,
  db_upright_row: { in: "Lower the dumbbells", out: "Pull up to chest height" },
  barbell_clean_and_press: { in: "Breathe in and brace before the rep", out: "Breathe out as you finish the press" },
  db_shrug: SHRUG,

  // B — Back / Biceps / Forearms
  pullup: { in: "Lower yourself down", out: "Pull up" },
  standing_single_arm_cable_row: { in: "Let the arm extend", out: "Row the handle in" },
  single_arm_db_row: { in: "Lower the dumbbell", out: "Row up" },
  straight_arm_pushdown: { in: "Let the bar rise", out: "Push the bar down" },
  low_cable_pull: { in: "Let the arms extend", out: "Pull to your torso" },
  straight_bar_curl: LOWER_CURL,
  db_spider_curl: LOWER_CURL,
  reverse_curl: LOWER_CURL,
  lat_pulldown: { in: "Let the bar rise", out: "Pull the bar down" },
  barbell_bentover_row: { in: "Brace, then lower the bar", out: "Row the bar in" },
  seated_db_curl: LOWER_CURL,
  standing_straight_bar_cable_curl: LOWER_CURL,

  // C — Chest / Triceps
  pushup: { in: "Lower your chest", out: "Push up" },
  cable_crossover: { in: "Open the arms", out: "Bring the handles together" },
  bench_press: { in: "Lower the bar to your chest", out: "Press up" },
  incline_db_flye: { in: "Open the arms", out: "Bring the dumbbells together" },
  incline_db_press: LOWER_PRESS,
  incline_french_press: { in: "Lower behind your head", out: "Extend the arms" },
  rope_pushdown: { in: "Let the rope rise", out: "Push down" },
  db_overhead_extension: { in: "Lower behind your head", out: "Extend overhead" },
  db_kickback: { in: "Bring the dumbbell forward", out: "Extend back" },
  flat_db_press: LOWER_PRESS,
  db_incline_press: LOWER_PRESS,
  close_grip_bench_press: { in: "Brace, then lower the bar", out: "Press up" },

  // D — Legs
  leg_extension: { in: "Lower the pad", out: "Extend the legs" },
  leg_press: { in: "Lower the platform", out: "Press away" },
  leg_curl: { in: "Let the pad return", out: "Curl the pad in" },
  walking_lunge: { in: "Step and lower", out: "Drive up" },
  deadlift: { in: "Breathe in and brace before lifting", out: "Breathe out at the top, then reset" },
  squat: { in: "Breathe in and brace, then descend", out: "Breathe out as you drive up" },
  standing_calf_raise: CALF,
  seated_calf_raise: CALF,
};

/**
 * Verified exercise demo videos, keyed by exercise code. Empty for now — add links later, e.g.
 *   db_lateral_raise: "https://…",
 * Only https URLs are used; anything else is ignored.
 */
export const EXERCISE_VIDEOS: Record<string, string | null> = {};

export const videoFor = (code: string): string | null => {
  const url = EXERCISE_VIDEOS[code];
  return url && /^https:\/\//.test(url) ? url : null;
};

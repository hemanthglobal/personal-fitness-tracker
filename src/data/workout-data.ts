/*
 * 60 Days to Fit — programme definition.
 *
 * Transcribed from the supplied PDF ("60 Days to Fit: Strength & Muscle Building
 * Program", 7 pages), which is the source of truth:
 *   - Page 3: training calendar (12-day cycle x 5)
 *   - Pages 4–5: exercise breakdown (sets, reps per cycle, supersets, tempo/rest)
 *   - Page 6: example meal plan + macro formulas
 *   - Page 7: shopping list + supplement list
 *
 * Reps are not stored per exercise: they come from intensity + cycle
 * (light = 7 + cycle, heavy = 3 + cycle), exactly as the PDF tables show.
 *
 * Exercise codes must match the `exercise_codes` seed in
 * supabase/migrations/0001_initial_schema.sql (a test checks this).
 */
import type { CycleSlot, DaySchedule, Exercise, Intensity, IntensityGuide, WorkoutCode, WorkoutDefinition } from "../types/workout";

export const TOTAL_DAYS = 60;
export const CYCLE_LENGTH = 12;
export const CYCLES = 5;

export const WORKOUTS: Record<WorkoutCode, WorkoutDefinition> = {
  A: {
    name: "Shoulders / Traps",
    light: [
      { code: "db_lateral_raise", name: "Dumbbell Lateral Raise", sets: 3, superset: "A1" },
      { code: "single_arm_db_overhead_press", name: "Single-arm Dumbbell Overhead Press", sets: 3, superset: "A1" },
      { code: "db_rear_delt_flye", name: "Dumbbell Rear-delt Flye", sets: 3, superset: "A2" },
      { code: "rope_high_pull", name: "Rope High Pull", sets: 3, superset: "A2" },
      { code: "scott_press", name: "Scott Press", sets: 3 },
      { code: "cable_shrug", name: "Cable Shrug", sets: 3, superset: "A3" },
      { code: "db_upright_row", name: "Dumbbell Upright Row", sets: 3, superset: "A3" },
    ],
    heavy: [
      { code: "barbell_clean_and_press", name: "Barbell Clean and Press", sets: 3 },
      { code: "db_lateral_raise", name: "Dumbbell Lateral Raise", sets: 3 },
      { code: "db_rear_delt_flye", name: "Dumbbell Rear-delt Flye", sets: 3 },
      { code: "db_shrug", name: "Dumbbell Shrug", sets: 3 },
    ],
  },
  B: {
    name: "Back / Biceps / Forearms",
    light: [
      { code: "pullup", name: "Pullup", sets: 3, toFailure: true },
      { code: "standing_single_arm_cable_row", name: "Standing Single-arm Cable Row", sets: 3, superset: "B1" },
      { code: "single_arm_db_row", name: "Single-arm Dumbbell Row", sets: 3, superset: "B1" },
      { code: "straight_arm_pushdown", name: "Straight-arm Pushdown", sets: 3, superset: "B2" },
      { code: "low_cable_pull", name: "Low Cable Pull", sets: 3, superset: "B2" },
      { code: "straight_bar_curl", name: "Straight-bar Curl", sets: 3 },
      { code: "db_spider_curl", name: "Dumbbell Spider Curl", sets: 3 },
      { code: "reverse_curl", name: "Reverse Curl", sets: 3 },
    ],
    heavy: [
      { code: "pullup", name: "Pullup", sets: 2, toFailure: true },
      { code: "lat_pulldown", name: "Lat Pulldown", sets: 5 },
      { code: "barbell_bentover_row", name: "Barbell Bentover Row", sets: 3 },
      { code: "seated_db_curl", name: "Seated Dumbbell Curl", sets: 3 },
      { code: "standing_straight_bar_cable_curl", name: "Standing Straight-bar Cable Curl", sets: 3 },
    ],
  },
  C: {
    name: "Chest / Triceps",
    light: [
      { code: "pushup", name: "Pushup", sets: 2 },
      { code: "cable_crossover", name: "Cable Crossover", sets: 3, superset: "C1" },
      { code: "bench_press", name: "Bench Press", sets: 3, superset: "C1" },
      { code: "incline_db_flye", name: "Incline Dumbbell Flye", sets: 3, superset: "C2" },
      { code: "incline_db_press", name: "Incline Dumbbell Press", sets: 3, superset: "C2" },
      { code: "incline_french_press", name: "Incline French Press", sets: 3 },
      { code: "rope_pushdown", name: "Rope Pushdown", sets: 3, superset: "C3" },
      { code: "db_overhead_extension", name: "Dumbbell Overhead Extension", sets: 3, superset: "C3" },
      { code: "db_kickback", name: "Dumbbell Kickback", sets: 3 },
    ],
    heavy: [
      { code: "pushup", name: "Pushup", sets: 2 },
      { code: "flat_db_press", name: "Flat Dumbbell Press", sets: 5 },
      { code: "db_incline_press", name: "Dumbbell Incline Press", sets: 5 },
      { code: "close_grip_bench_press", name: "Close-grip Bench Press", sets: 5 },
      { code: "incline_french_press", name: "Incline French Press", sets: 5 },
    ],
  },
  D: {
    name: "Legs",
    light: [
      { code: "leg_extension", name: "Leg Extension", sets: 3, superset: "D1" },
      { code: "leg_press", name: "Leg Press", sets: 3, superset: "D1" },
      { code: "leg_curl", name: "Leg Curl", sets: 3, superset: "D2" },
      { code: "walking_lunge", name: "Walking Lunge", sets: 3, superset: "D2" },
      { code: "deadlift", name: "Deadlift", sets: 3 },
      { code: "standing_calf_raise", name: "Standing Calf Raise", sets: 3, superset: "D3" },
      { code: "seated_calf_raise", name: "Seated Calf Raise", sets: 3, superset: "D3" },
    ],
    heavy: [
      { code: "squat", name: "Squat", sets: 5 },
      { code: "deadlift", name: "Deadlift", sets: 5 },
      { code: "standing_calf_raise", name: "Standing Calf Raise", sets: 5 },
      { code: "seated_calf_raise", name: "Seated Calf Raise", sets: 5 },
    ],
  },
};

/** One 12-day cycle (PDF page 3). Repeats identically for cycles 1–5. */
export const CYCLE_PATTERN: CycleSlot[] = [
  { workout: "A", intensity: "light" },
  { workout: "B", intensity: "heavy" },
  { rest: true },
  { workout: "C", intensity: "light" },
  { workout: "D", intensity: "heavy" },
  { rest: true },
  { workout: "A", intensity: "heavy" },
  { workout: "B", intensity: "light" },
  { rest: true },
  { workout: "C", intensity: "heavy" },
  { workout: "D", intensity: "light" },
  { rest: true },
];

/** Tempo / rest guidance (PDF pages 4–5 footer notes). Heavy eccentric has no stated duration. */
export const INTENSITY: Record<Intensity, IntensityGuide> = {
  light: {
    label: "Light",
    tempo: "2 sec up / 3 sec down",
    tempoDetail: "2 seconds concentric, 3 seconds eccentric (negative)",
    rest: "60 sec between sets",
    restTarget: "60 sec",
    restSeconds: 60,
  },
  heavy: {
    label: "Heavy",
    tempo: "Explosive up / controlled down",
    tempoDetail: "Explosive concentric, controlled eccentric",
    rest: "3–4 min between sets",
    restTarget: "3–4 min",
    restSeconds: 180,
  },
};

/** Schedule entry for a programme day (1–60), or null if out of range. */
export function getSchedule(day: number): DaySchedule | null {
  if (!Number.isInteger(day) || day < 1 || day > TOTAL_DAYS) return null;
  const cycle = Math.ceil(day / CYCLE_LENGTH);
  const dayInCycle = ((day - 1) % CYCLE_LENGTH) + 1;
  const slot = CYCLE_PATTERN[dayInCycle - 1]!;
  if (slot.rest) return { day, cycle, dayInCycle, type: "rest" };
  const w = WORKOUTS[slot.workout];
  return {
    day, cycle, dayInCycle,
    type: "workout",
    workout: slot.workout,
    intensity: slot.intensity,
    name: w.name,
    exercises: w[slot.intensity],
  };
}

/** Target reps for an intensity/cycle. Null for "To Failure" exercises. */
export function getTargetReps(intensity: Intensity, cycle: number, exercise?: Exercise): number | null {
  if (exercise?.toFailure) return null;
  return intensity === "light" ? 7 + cycle : 3 + cycle;
}

/** Every exercise code used anywhere in the programme. */
export function allExerciseCodes(): string[] {
  const set = new Set<string>();
  for (const w of Object.values(WORKOUTS)) for (const e of [...w.light, ...w.heavy]) set.add(e.code);
  return [...set].sort();
}

export function exerciseName(code: string): string {
  for (const w of Object.values(WORKOUTS)) for (const e of [...w.light, ...w.heavy]) if (e.code === code) return e.name;
  return code;
}

export const REST_ACTIVITIES = ["Foam rolling", "Walking", "Hiking", "Yoga", "Biking", "Any other low-impact activity"];

export const VIDEO_URL = "https://www.muscleandfitness.com/60days";

export const MINDSET_TIPS = [
  "Remind yourself why you are starting this.",
  "Ask yourself how badly you want to see results.",
  "Learn to embrace the burn. When you feel you can't push any further, dig deep.",
];

export interface Meal { time: string; items: string[]; p: number; f: number; c: number; kcal: number }

/** PDF page 6 — example values only, never personal targets. */
export const NUTRITION = {
  formulas: [
    { macro: "Protein", perLb: 1.5 },
    { macro: "Carbohydrates", perLb: 2 },
    { macro: "Fat", perLb: 0.5 },
  ],
  meals: [
    { time: "6:30 AM", items: ["4 whole eggs", "1/2 cup oatmeal", "1 cup blueberries"], p: 35, f: 26, c: 79, kcal: 664 },
    { time: "9:00 AM", items: ["1 1/2 scoops whey protein", "1 medium banana", "8 oz sports drink"], p: 38.5, f: 3, c: 39.5, kcal: 350 },
    { time: "12:00 PM", items: ["4 1/2 oz chicken", "8 oz potato (cooked)", "3 oz avocado"], p: 45.5, f: 18, c: 69, kcal: 620.5 },
    { time: "3:00 PM", items: ["16 oz yogurt", "1/2 cup pineapple chunks", "1 oz almonds"], p: 34, f: 15, c: 62, kcal: 519 },
    { time: "6:00 PM", items: ["1 scoop whey protein", "1 medium apple"], p: 37.5, f: 3, c: 34.5, kcal: 305 },
    { time: "9:00 PM", items: ["4 1/2 oz turkey breast (ground)", "1 cup brown rice", "1 cup broccoli", "1 tbsp flax oil"], p: 34, f: 15, c: 62, kcal: 519 },
    { time: "11:00 PM", items: ["1 1/2 scoops whey protein", "1 tbsp peanut butter"], p: 41.5, f: 11, c: 7.5, kcal: 300 },
  ] as Meal[],
  total: { p: 275, f: 94, c: 343.5, kcal: 3286.5 },
  waterTip: "Aim for no less than half a gallon to a full gallon of water per day.",
  replacements: {
    Meat: ["Lean steak", "Lean pork", "Fish", "Turkey", "Bison"],
    Vegetables: ["Asparagus", "Green beans", "Spinach", "Cauliflower", "Eggplant", "Romaine salad"],
    Carbs: ["Ezekiel bread", "Whole-wheat bread", "Pita bread", "Quinoa", "Sweet potato", "Whole-wheat pasta"],
  } as Record<string, string[]>,
};

/** PDF page 7. */
export const SHOPPING: { category: string; items: string[] }[] = [
  { category: "Proteins", items: [
    "Boneless, skinless chicken breast", "Tuna (water packed)", "Fish (salmon, seabass, halibut)", "Shrimp",
    "Extra lean ground beef", "Protein powder", "Egg whites or eggs", "Ribeye steaks or roast",
    "Top round steaks or roast", "Beef tenderloin", "Top loin (NY strip steak)", "Eye of round",
    "Ground turkey, turkey breast slices or cutlets",
  ] },
  { category: "Complex Carbs", items: [
    "Oatmeal (old fashioned or quick oats)", "Sweet potatoes (yams)", "Beans (pinto, black, kidney)",
    "Brown rice", "Multigrain cereal", "Whole-wheat pasta",
  ] },
  { category: "Fibrous Carbs", items: [
    "Lettuce (green leaf, red leaf, romaine)", "Broccoli", "Asparagus", "String beans", "Spinach",
    "Bell peppers", "Brussels sprouts", "Cauliflower", "Celery",
  ] },
  { category: "Healthy Fats", items: ["Peanut butter", "Olive oil or safflower oil", "Nuts (peanuts, almonds)", "Flaxseed oil", "Avocado"] },
  { category: "Dairy & Eggs", items: ["Low-fat cottage cheese", "Eggs", "Low or non-fat milk", "Greek yogurt"] },
  { category: "Other Produce & Fruits", items: [
    "Cucumber", "Green or red pepper", "Onions", "Garlic", "Tomatoes", "Zucchini",
    "Bananas, apples, grapefruit, peaches", "Strawberries, blueberries, raspberries", "Lemons or limes",
  ] },
  { category: "Condiments & Misc.", items: [
    "Balsamic vinegar", "Chili powder", "Salt-free seasoning blend", "Steak sauce", "Sugar-free maple syrup",
    "Chili paste", "Mustard", "Extracts (vanilla, almond, etc.)", "Sea salt",
  ] },
];

/** PDF pages 2 & 7. Descriptions paraphrase the source; nothing added. */
export const SUPPLEMENTS = [
  { name: "BCAAs / Aminos", note: "Listed as aiding recovery and building lean muscle." },
  { name: "Protein powder", note: "A convenient way to supplement your diet; the source suggests it for post-workout nutrition." },
  { name: "Creatine", note: "Taken pre- or post-workout; the source says it can help strength and size." },
  { name: "Glutamine", note: "Listed for recovery. The source notes it's also found in chicken, fish, eggs and dairy." },
  { name: "Pre-workout", note: "Described as an energy, focus and endurance booster for low-energy days." },
];

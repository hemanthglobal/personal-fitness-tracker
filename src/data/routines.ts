/*
 * Warm-up and stretching routines — supplementary, NOT from the programme PDF.
 * General, equipment-free movements matched to each workout's muscle groups.
 * The UI labels these as general guidance. Edit freely.
 */
import type { WorkoutCode } from "../types/workout";

export interface RoutineMove {
  name: string;
  cue: string;
  seconds: number;
  /** Done once per side: expands into a Left and a Right step. */
  eachSide?: boolean;
}

export interface Routine {
  kind: "warmup" | "stretch";
  key: WorkoutCode | "full";
  title: string;
  moves: RoutineMove[];
  /** Shown on the finish screen. */
  finishTip: string;
}

/** Seconds of "get ready" before each move (and between sides). */
export const PREP_SECONDS = 5;

const PULSE: RoutineMove[] = [
  { name: "March or jog on the spot", cue: "Easy pace. Swing your arms and let your breathing pick up.", seconds: 60 },
  { name: "Jumping jacks", cue: "Light and rhythmic. Step them out if you prefer low impact.", seconds: 40 },
];

const WARMUP_TIP = "Before your first exercise, do 1–2 light sets with about half your working weight.";
const STRETCH_TIP = "Hold each stretch gently. Mild tension only, never pain, and don't bounce.";

export const WARMUPS: Record<WorkoutCode, Routine> = {
  A: {
    kind: "warmup", key: "A", title: "Shoulders & traps warm-up", finishTip: WARMUP_TIP,
    moves: [
      ...PULSE,
      { name: "Arm circles", cue: "Small to big circles. Switch direction halfway.", seconds: 40 },
      { name: "Shoulder rolls", cue: "Slow rolls up, back and down.", seconds: 30 },
      { name: "Arm cross-swings", cue: "Open the arms wide, then hug across your chest.", seconds: 30 },
      { name: "Wall slides", cue: "Back against a wall, slide your arms up and down in a W to Y shape.", seconds: 40 },
      { name: "Scapular push-ups", cue: "Arms straight. Squeeze and spread your shoulder blades.", seconds: 30 },
    ],
  },
  B: {
    kind: "warmup", key: "B", title: "Back & arms warm-up", finishTip: WARMUP_TIP,
    moves: [
      ...PULSE,
      { name: "Cat-cow", cue: "On hands and knees, round then arch your spine slowly.", seconds: 40 },
      { name: "Thoracic rotations", cue: "On all fours, hand behind head, rotate the elbow up to the ceiling.", seconds: 25, eachSide: true },
      { name: "Arm swings", cue: "Swing your arms forward and back, loosening the shoulders.", seconds: 30 },
      { name: "Bodyweight hip hinges", cue: "Push your hips back with a flat back, then stand tall.", seconds: 30 },
      { name: "Wrist circles", cue: "Interlace your fingers and roll the wrists both ways.", seconds: 30 },
    ],
  },
  C: {
    kind: "warmup", key: "C", title: "Chest & triceps warm-up", finishTip: WARMUP_TIP,
    moves: [
      ...PULSE,
      { name: "Arm circles", cue: "Small to big circles. Switch direction halfway.", seconds: 30 },
      { name: "Arm cross-swings", cue: "Open the arms wide, then hug across your chest.", seconds: 30 },
      { name: "Scapular push-ups", cue: "Arms straight. Squeeze and spread your shoulder blades.", seconds: 30 },
      { name: "Incline push-ups", cue: "Hands on a bench. Smooth, easy reps.", seconds: 40 },
      { name: "Triceps arm swings", cue: "Reach overhead, then swing the arms down and back.", seconds: 30 },
    ],
  },
  D: {
    kind: "warmup", key: "D", title: "Legs warm-up", finishTip: WARMUP_TIP,
    moves: [
      ...PULSE,
      { name: "Leg swings, front to back", cue: "Hold something for balance. Swing loose and controlled.", seconds: 25, eachSide: true },
      { name: "Leg swings, side to side", cue: "Swing across your body and out to the side.", seconds: 25, eachSide: true },
      { name: "Bodyweight squats", cue: "Sit back and down, chest up, knees tracking your toes.", seconds: 40 },
      { name: "Reverse lunges", cue: "Step back, lower gently, alternate legs.", seconds: 40 },
      { name: "Glute bridges", cue: "Drive through your heels and squeeze at the top.", seconds: 30 },
      { name: "Ankle circles", cue: "Circle each ankle both ways.", seconds: 20, eachSide: true },
    ],
  },
};

export const STRETCHES: Record<WorkoutCode | "full", Routine> = {
  A: {
    kind: "stretch", key: "A", title: "Shoulders & traps stretch", finishTip: STRETCH_TIP,
    moves: [
      { name: "Cross-body shoulder stretch", cue: "Pull one arm across your chest with the other.", seconds: 30, eachSide: true },
      { name: "Upper trap stretch", cue: "Tilt your ear toward your shoulder, shoulder down.", seconds: 30, eachSide: true },
      { name: "Doorway chest & front shoulder stretch", cue: "Forearm on a door frame, step through gently.", seconds: 30, eachSide: true },
      { name: "Child's pose", cue: "Sit back on your heels, arms long, breathe slowly.", seconds: 45 },
    ],
  },
  B: {
    kind: "stretch", key: "B", title: "Back & arms stretch", finishTip: STRETCH_TIP,
    moves: [
      { name: "Child's pose", cue: "Sit back on your heels, arms long, breathe slowly.", seconds: 45 },
      { name: "Side lat stretch", cue: "Reach one arm overhead and lean away.", seconds: 30, eachSide: true },
      { name: "Cat-cow", cue: "Slow rounds and arches through the whole spine.", seconds: 30 },
      { name: "Biceps wall stretch", cue: "Palm on a wall behind you, turn your body away.", seconds: 30, eachSide: true },
      { name: "Wrist flexor stretch", cue: "Arm straight, palm up, gently pull the fingers back.", seconds: 25, eachSide: true },
    ],
  },
  C: {
    kind: "stretch", key: "C", title: "Chest & triceps stretch", finishTip: STRETCH_TIP,
    moves: [
      { name: "Doorway chest stretch", cue: "Forearm on a door frame, step through gently.", seconds: 30, eachSide: true },
      { name: "Overhead triceps stretch", cue: "Hand behind your head, gently push the elbow down.", seconds: 30, eachSide: true },
      { name: "Cross-body shoulder stretch", cue: "Pull one arm across your chest with the other.", seconds: 30, eachSide: true },
      { name: "Behind-back chest opener", cue: "Clasp your hands behind you and lift gently.", seconds: 30 },
    ],
  },
  D: {
    kind: "stretch", key: "D", title: "Legs stretch", finishTip: STRETCH_TIP,
    moves: [
      { name: "Standing quad stretch", cue: "Heel to glute, knees together, hips forward.", seconds: 30, eachSide: true },
      { name: "Seated hamstring stretch", cue: "One leg straight, hinge forward from the hips.", seconds: 30, eachSide: true },
      { name: "Kneeling hip flexor stretch", cue: "Half-kneel, tuck the pelvis and shift forward.", seconds: 30, eachSide: true },
      { name: "Figure-4 glute stretch", cue: "Lying down, ankle over knee, pull the leg in.", seconds: 30, eachSide: true },
      { name: "Calf wall stretch", cue: "Back leg straight, heel down, lean into the wall.", seconds: 30, eachSide: true },
    ],
  },
  full: {
    kind: "stretch", key: "full", title: "Full-body stretch", finishTip: STRETCH_TIP,
    moves: [
      { name: "Cat-cow", cue: "Slow rounds and arches through the whole spine.", seconds: 40 },
      { name: "Child's pose", cue: "Sit back on your heels, arms long, breathe slowly.", seconds: 45 },
      { name: "Cross-body shoulder stretch", cue: "Pull one arm across your chest with the other.", seconds: 30, eachSide: true },
      { name: "Doorway chest stretch", cue: "Forearm on a door frame, step through gently.", seconds: 30, eachSide: true },
      { name: "Kneeling hip flexor stretch", cue: "Half-kneel, tuck the pelvis and shift forward.", seconds: 30, eachSide: true },
      { name: "Seated hamstring stretch", cue: "One leg straight, hinge forward from the hips.", seconds: 30, eachSide: true },
      { name: "Standing quad stretch", cue: "Heel to glute, knees together, hips forward.", seconds: 30, eachSide: true },
      { name: "Calf wall stretch", cue: "Back leg straight, heel down, lean into the wall.", seconds: 30, eachSide: true },
    ],
  },
};

export function getRoutine(kind: string, key: string): Routine | null {
  if (kind === "warmup") return WARMUPS[key as WorkoutCode] ?? null;
  if (kind === "stretch") return STRETCHES[key as WorkoutCode | "full"] ?? null;
  return null;
}

export interface Step { name: string; cue: string; seconds: number; side?: "Left" | "Right" }

/** Flatten a routine into timed steps (each-side moves become two steps). */
export function expandSteps(r: Routine): Step[] {
  return r.moves.flatMap((m): Step[] => {
    const base = { name: m.name, cue: m.cue, seconds: m.seconds };
    return m.eachSide ? [{ ...base, side: "Left" }, { ...base, side: "Right" }] : [base];
  });
}

/** Total seconds including the get-ready gaps. */
export const routineSeconds = (r: Routine) => expandSteps(r).reduce((t, s) => t + s.seconds + PREP_SECONDS, 0);
export const routineMinutes = (r: Routine) => Math.max(1, Math.round(routineSeconds(r) / 60));

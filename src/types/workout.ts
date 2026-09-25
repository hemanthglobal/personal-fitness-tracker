export type WorkoutCode = "A" | "B" | "C" | "D";
export type Intensity = "light" | "heavy";

export interface Exercise {
  /** Stable identifier, also stored in the database. Shared by the same movement across workouts. */
  code: string;
  /** Display name, spelled as in the source PDF. */
  name: string;
  sets: number;
  /** PDF "To Failure" rows. */
  toFailure?: boolean;
  /** Consecutive exercises with the same group are a superset. */
  superset?: string;
}

export interface WorkoutDefinition {
  name: string;
  light: Exercise[];
  heavy: Exercise[];
}

export type CycleSlot = { rest: true } | { rest?: false; workout: WorkoutCode; intensity: Intensity };

export interface RestSchedule {
  day: number;
  cycle: number;
  dayInCycle: number;
  type: "rest";
}

export interface WorkoutSchedule {
  day: number;
  cycle: number;
  dayInCycle: number;
  type: "workout";
  workout: WorkoutCode;
  intensity: Intensity;
  name: string;
  exercises: Exercise[];
}

export type DaySchedule = RestSchedule | WorkoutSchedule;

export interface IntensityGuide {
  label: string;
  tempo: string;
  tempoDetail: string;
  rest: string;
  restTarget: string;
  restSeconds: number;
}

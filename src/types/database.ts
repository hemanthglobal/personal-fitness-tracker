/* Row shapes for the Supabase tables (see supabase/migrations). */

export interface ProfileRow {
  id: string;
  display_name: string | null;
  weight_unit: "kg" | "lb";
  created_at: string;
  updated_at: string;
}

export interface ProgrammeRow {
  id: string;
  user_id: string;
  name: string;
  start_date: string;
  status: "active" | "completed" | "cancelled";
  created_at: string;
  updated_at: string;
}

export interface ProgrammeDayRow {
  id: string;
  programme_id: string;
  user_id: string;
  day_number: number;
  cycle_number: number;
  workout_code: "A" | "B" | "C" | "D" | null;
  workout_type: "light" | "heavy" | null;
  is_rest_day: boolean;
  scheduled_date: string;
  completed: boolean;
  completed_at: string | null;
}

export interface WorkoutSessionRow {
  id: string;
  user_id: string;
  programme_day_id: string;
  started_at: string | null;
  completed_at: string | null;
  notes: string | null;
}

export interface ExerciseSetRow {
  id?: string;
  user_id: string;
  workout_session_id: string;
  exercise_code: string;
  set_number: number;
  weight_kg: number | string | null; // numeric comes back as number or string depending on size
  reps: number | null;
  notes?: string | null;
  completed: boolean;
}

export interface ExerciseNoteRow {
  user_id: string;
  workout_session_id: string;
  exercise_code: string;
  notes: string;
}

export interface BodyWeightRow {
  id?: string;
  user_id: string;
  recorded_at: string;
  weight: number | string;
  unit: "kg" | "lb";
  notes: string | null;
}

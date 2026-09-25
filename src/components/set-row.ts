import { esc } from "../lib/utils";
import { fmtW, unit, type SetLog } from "../lib/state";
import { ICON } from "./icons";

interface SetRowProps {
  exerciseName: string;
  index: number;
  set: SetLog;
  /** Previous weight (display units) shown as placeholder; ticking an empty field logs it. */
  weightPlaceholder: string;
  /** Target reps (or previous reps for to-failure sets). */
  repsPlaceholder: string;
}

function stepper(field: "weight" | "reps", i: number, name: string, value: string, placeholder: string) {
  const isW = field === "weight";
  const label = isW ? `${name} set ${i + 1} weight in ${unit()}` : `${name} set ${i + 1} reps`;
  return `
    <div class="stepper">
      <button type="button" class="stepper__btn" data-action="step" data-field="${field}" data-dir="-1" aria-label="Decrease set ${i + 1} ${field}" tabindex="-1">${ICON.minus}</button>
      <input class="stepper__input" data-field="${field}" ${isW ? 'inputmode="decimal"' : 'inputmode="numeric" pattern="[0-9]*"'}
        enterkeyhint="${isW ? "next" : "done"}" autocomplete="off" aria-label="${esc(label)}"
        placeholder="${esc(placeholder || "–")}" value="${esc(value)}">
      <button type="button" class="stepper__btn" data-action="step" data-field="${field}" data-dir="1" aria-label="Increase set ${i + 1} ${field}" tabindex="-1">${ICON.plus}</button>
    </div>`;
}

export function setRow({ exerciseName, index: i, set, weightPlaceholder, repsPlaceholder }: SetRowProps) {
  return `
    <div class="set ${set.done ? "is-done" : ""}" data-set="${i}">
      <span class="set__n" aria-hidden="true">${i + 1}</span>
      ${stepper("weight", i, exerciseName, fmtW(set.weight), weightPlaceholder)}
      ${stepper("reps", i, exerciseName, set.reps != null ? String(set.reps) : "", repsPlaceholder)}
      <button type="button" class="set__check" data-action="toggle-set" aria-pressed="${set.done}" aria-label="${esc(exerciseName)} set ${i + 1} done">${ICON.check}</button>
      <p class="set__err" role="alert" hidden></p>
    </div>`;
}

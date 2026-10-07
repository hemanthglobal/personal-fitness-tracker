import { BREATHING, videoFor } from "../data/exercise-guide";
import type { ProgramExercise } from "../data/programs";
import { INTENSITY } from "../data/workout-data";
import type { Intensity } from "../types/workout";
import { esc, fmtDate } from "../lib/utils";
import { findPrevious, fmtSet, fmtW, unit, type Session } from "../lib/state";
import { ICON } from "./icons";
import { setRow } from "./set-row";

export const exerciseStatus = (done: number, total: number) =>
  done >= total && total > 0 ? `${ICON.check}<span>Done</span>` : `<span>${done}/${total}</span>`;

interface CardOpts {
  session: Session | null;
  workoutKey: string | null;
  intensity?: Intensity;
  /** Free workouts: the exercise can be removed. */
  removable: boolean;
}

export function exerciseCard(ex: ProgramExercise, index: number, o: CardOpts) {
  const log = o.session?.logs[ex.code];
  const sets = log?.sets ?? [];
  const total = Math.max(ex.sets, sets.length);
  const reps = ex.reps;
  const prev = findPrevious(o.session, ex.code, o.workoutKey);
  const doneCount = sets.filter((s) => s.done).length;
  const samePrev = prev && (!o.workoutKey || prev.session.workoutKey === o.workoutKey) ? prev : null;
  const I = o.intensity ? INTENSITY[o.intensity] : null;
  const breath = BREATHING[ex.code];
  const video = videoFor(ex.code);

  const prevHtml = prev
    ? `<div class="ex__prev">
        <p class="label">Previous <span class="muted">· ${esc(fmtDate(prev.session.date, { day: "numeric", month: "short" }))}${samePrev ? "" : ` · ${esc(prev.session.title)}`}</span></p>
        <ul class="chips">${prev.sets.map((s) => `<li>${esc(fmtSet(s))}</li>`).join("")}</ul>
      </div>`
    : `<div class="ex__prev ex__prev--empty"><p class="label">Previous</p><p class="muted">No earlier sets logged</p></div>`;

  const rows: string[] = [];
  for (let i = 0; i < total; i++) {
    const p = samePrev ? samePrev.sets[i] ?? samePrev.sets[samePrev.sets.length - 1] : undefined;
    const today = sets.slice(0, i).reverse().find((s) => s.done && s.weight != null);
    rows.push(setRow({
      exerciseName: ex.name,
      index: i,
      set: sets[i] ?? { weight: null, reps: null, done: false },
      weightPlaceholder: p && p.weight != null ? fmtW(p.weight) : today ? fmtW(today.weight) : "",
      repsPlaceholder: reps != null ? String(reps) : p?.reps != null ? String(p.reps) : "",
    }));
  }

  return `
    <article class="ex ${doneCount >= total ? "is-done" : ""}" data-index="${index}" id="ex-${index}" aria-labelledby="ex-name-${index}">
      <header class="ex__head">
        <span class="ex__num" aria-hidden="true">${index + 1}</span>
        <div class="ex__id">
          <h2 class="ex__name" id="ex-name-${index}">${esc(ex.name)}</h2>
          <p class="ex__target"><strong>${ex.sets}</strong> sets × <strong>${reps == null ? "to failure" : reps}</strong>${reps == null ? "" : " reps"}</p>
          ${I ? `<p class="ex__meta"><span>${I.tempo}</span> · <span>Rest ${I.restTarget}</span></p>` : ""}
        </div>
        <span class="ex__status">${exerciseStatus(doneCount, total)}</span>
      </header>
      ${breath ? `<div class="ex__breath">
        <p class="label">Breathing <span class="tag tag--quiet">General tip</span></p>
        <dl>
          <div><dt><span aria-hidden="true">↓</span> In</dt><dd>${esc(breath.in)}</dd></div>
          <div><dt><span aria-hidden="true">↑</span> Out</dt><dd>${esc(breath.out)}</dd></div>
        </dl>
      </div>` : ""}
      ${video ? `<a class="ex__video" href="${esc(video)}" target="_blank" rel="noopener noreferrer" data-video
        aria-label="Watch ${esc(ex.name)} demo (opens in a new tab)">${ICON.play}<span>Watch exercise demo</span>${ICON.link}</a>` : ""}
      ${prevHtml}
      <div class="sets">
        <div class="sets__head" aria-hidden="true"><span>Set</span><span>${unit()}</span><span>Reps</span><span></span></div>
        ${rows.join("")}
      </div>
      <div class="ex__tools">
        ${total < 10 ? `<button type="button" class="link-btn" data-action="add-set">${ICON.plus}<span>Add set</span></button>` : ""}
        ${o.removable ? `<button type="button" class="link-btn link-btn--danger" data-action="remove-exercise">${ICON.close}<span>Remove</span></button>` : ""}
      </div>
      <details class="ex__notes" ${log?.notes ? "open" : ""}>
        <summary>Notes</summary>
        <label class="sr-only" for="notes-${index}">Notes for ${esc(ex.name)}</label>
        <textarea id="notes-${index}" class="input" data-field="notes" rows="2" maxlength="2000" placeholder="Seat height, grip, how it felt…">${esc(log?.notes ?? "")}</textarea>
      </details>
    </article>`;
}

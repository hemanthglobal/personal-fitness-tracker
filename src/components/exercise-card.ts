import { BREATHING, videoFor } from "../data/exercise-guide";
import { getTargetReps, INTENSITY } from "../data/workout-data";
import type { Exercise, WorkoutSchedule } from "../types/workout";
import { esc } from "../lib/utils";
import { findPrevious, fmtSet, fmtW, getLog, unit } from "../lib/state";
import { ICON } from "./icons";
import { setRow } from "./set-row";

export const exerciseStatus = (done: number, total: number) =>
  done >= total ? `${ICON.check}<span>Done</span>` : `<span>${done}/${total}</span>`;

export function exerciseCard(sched: WorkoutSchedule, ex: Exercise, index: number) {
  const log = getLog(sched.day, ex.code);
  const sets = log?.sets ?? [];
  const reps = getTargetReps(sched.intensity, sched.cycle, ex);
  const prev = findPrevious(sched.day, ex.code, sched.intensity);
  const doneCount = sets.slice(0, ex.sets).filter((s) => s.done).length;
  const samePrev = prev && prev.intensity === sched.intensity ? prev : null;

  const prevHtml = prev
    ? `<div class="ex__prev">
        <p class="label">Previous <span class="muted">· Day ${prev.day}${prev.intensity !== sched.intensity ? ` (${prev.intensity})` : ""}</span></p>
        <ul class="chips">${prev.sets.map((s) => `<li>${esc(fmtSet(s))}</li>`).join("")}</ul>
      </div>`
    : `<div class="ex__prev ex__prev--empty"><p class="label">Previous</p><p class="muted">No earlier sets logged</p></div>`;

  const rows: string[] = [];
  for (let i = 0; i < ex.sets; i++) {
    const p = samePrev ? samePrev.sets[i] ?? samePrev.sets[samePrev.sets.length - 1] : undefined;
    // No history: suggest the weight of today's latest ticked set.
    const today = sets.slice(0, i).reverse().find((s) => s.done && s.weight != null);
    rows.push(
      setRow({
        exerciseName: ex.name,
        index: i,
        set: sets[i] ?? { weight: null, reps: null, done: false },
        weightPlaceholder: p && p.weight != null ? fmtW(p.weight) : today ? fmtW(today.weight) : "",
        repsPlaceholder: reps != null ? String(reps) : p?.reps != null ? String(p.reps) : "",
      }),
    );
  }

  const I = INTENSITY[sched.intensity];
  const breath = BREATHING[ex.code];
  const video = videoFor(ex.code);
  // Supplementary guidance (not from the PDF) — labelled as a general tip.
  const guideHtml = `
      ${breath ? `<div class="ex__breath">
        <p class="label">Breathing <span class="tag tag--quiet">General tip</span></p>
        <dl>
          <div><dt><span aria-hidden="true">↓</span> In</dt><dd>${esc(breath.in)}</dd></div>
          <div><dt><span aria-hidden="true">↑</span> Out</dt><dd>${esc(breath.out)}</dd></div>
        </dl>
      </div>` : ""}
      ${video ? `<a class="ex__video" href="${esc(video)}" target="_blank" rel="noopener noreferrer" data-video
        aria-label="Watch ${esc(ex.name)} demo (opens in a new tab)">${ICON.play}<span>Watch exercise demo</span>${ICON.link}</a>` : ""}`;

  return `
    <article class="ex ${doneCount >= ex.sets ? "is-done" : ""}" data-index="${index}" id="ex-${index}" aria-labelledby="ex-name-${index}">
      <header class="ex__head">
        <span class="ex__num" aria-hidden="true">${index + 1}</span>
        <div class="ex__id">
          <h2 class="ex__name" id="ex-name-${index}">${esc(ex.name)}</h2>
          <p class="ex__target"><strong>${ex.sets}</strong> sets × <strong>${reps == null ? "to failure" : reps}</strong>${reps == null ? "" : " reps"}</p>
          <p class="ex__meta"><span>${I.tempo}</span> · <span>Rest ${I.restTarget}</span></p>
        </div>
        <span class="ex__status">${exerciseStatus(doneCount, ex.sets)}</span>
      </header>
      ${guideHtml}
      ${prevHtml}
      <div class="sets">
        <div class="sets__head" aria-hidden="true"><span>Set</span><span>${unit()}</span><span>Reps</span><span></span></div>
        ${rows.join("")}
      </div>
      <details class="ex__notes" ${log?.notes ? "open" : ""}>
        <summary>Notes</summary>
        <label class="sr-only" for="notes-${index}">Notes for ${esc(ex.name)}</label>
        <textarea id="notes-${index}" class="input" data-field="notes" rows="2" maxlength="2000" placeholder="Seat height, grip, how it felt…">${esc(log?.notes ?? "")}</textarea>
      </details>
    </article>`;
}

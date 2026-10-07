/*
 * Timed warm-up / stretching sessions.
 * Overview first (see what's coming), then a guided countdown: a short "get ready" gap before
 * each move, beeps in the last 3 seconds, auto-advance. The screen is kept awake while it runs.
 * Timing uses wall-clock end times, so it stays accurate even if the browser throttles timers.
 */
import { expandSteps, getRoutine, PREP_SECONDS, routineMinutes, STRETCHES, WARMUPS, type Routine, type Step } from "../data/routines";
import { WORKOUTS } from "../data/workout-data";
import { ICON } from "../components/icons";
import { emptyState, listLink, pageHeader } from "../components/ui";
import { cue, unlockAudio } from "../lib/sound";
import { changed, store } from "../lib/state";
import { $, esc, plural } from "../lib/utils";
import { holdScreenOn, isScreenKeptOn, onWakeLockChange, wakeLockBlocked, wakeLockSupported } from "../lib/wake-lock";

const fmt = (sec: number) => `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, "0")}`;
const sound = () => store.state.settings.sound;

/* ---------------------------------------------------------------------------
 * Routes
 * ------------------------------------------------------------------------- */

/** #/routines — every warm-up and stretch. */
export function renderRoutines(): string {
  const row = (r: Routine) => listLink(`#/session/${r.kind}/${r.key}`, r.kind === "warmup" ? ICON.play : ICON.leaf,
    esc(r.title), `${routineMinutes(r)} min · ${plural(r.moves.length, "move")}`);
  return `
    ${pageHeader("Warm-up & stretching", { back: "#/more", sub: "Guided timers. The screen stays on while a session runs." })}
    <h2 class="section__title">Warm-ups <span class="tag tag--quiet">General routine</span></h2>
    <ul class="card list-rows">${(["full", "A", "B", "C", "D"] as const).map((k) => row(WARMUPS[k])).join("")}</ul>
    <h2 class="section__title section__title--spaced">Stretching <span class="tag tag--quiet">General routine</span></h2>
    <ul class="card list-rows">${(["A", "B", "C", "D", "full"] as const).map((k) => row(STRETCHES[k])).join("")}</ul>
    <p class="fineprint">These routines are general guidance added to this app. They are not part of the programme PDF.</p>`;
}

/** #/session/<kind>/<key>[/<day>] — overview; pressing Start runs the timer in place. */
export function renderSession(kind?: string, key?: string, dayParam?: string): string {
  stopSession();
  const routine = kind && key ? getRoutine(kind, key) : null;
  // Third segment: a program day number, or "log:<sessionId>" for a free / logged session.
  const fromLog = dayParam?.startsWith("log:") ? dayParam.slice(4) : null;
  const day = fromLog ? null : Number(dayParam) || null;
  const back = fromLog ? `#/log/${fromLog}` : day ? `#/day/${day}` : "#/routines";
  if (!routine) {
    return `${pageHeader("Session not found", { back: "#/routines" })}
      ${emptyState("That routine doesn't exist.", "Pick one from the list.", '<a class="btn btn--primary" href="#/routines">Warm-up & stretching</a>')}`;
  }
  const forWhat = routine.key === "full" ? "Any day" : `Workout ${routine.key} · ${WORKOUTS[routine.key].name}`;
  pending = { routine, day: day ?? (fromLog ? -1 : null), back };

  return `
    <section class="session session--overview" id="session">
      ${pageHeader(esc(routine.title), { back, backLabel: back === "#/routines" ? "Back" : "Workout", eyebrow: `${routine.kind === "warmup" ? "Warm-up" : "Stretching"} · ${esc(forWhat)}` })}
      <div class="session__summary">
        <div><strong>${routineMinutes(routine)}</strong><span>min</span></div>
        <div><strong>${routine.moves.length}</strong><span>moves</span></div>
        <div><strong>${PREP_SECONDS}s</strong><span>get ready</span></div>
      </div>
      <ol class="card list-rows session__moves">
        ${routine.moves.map((m, i) => `<li class="list-row">
          <span class="list-row__day">${i + 1}</span>
          <span class="list-row__main">${esc(m.name)}<small>${esc(m.cue)}</small></span>
          <span class="list-row__value">${m.seconds}s${m.eachSide ? '<small class="muted"> ×2</small>' : ""}</span>
        </li>`).join("")}
      </ol>
      <p class="fineprint">${ICON.info} General routine added to this app, not from the programme PDF. ${routine.moves.some((m) => m.eachSide) ? "“×2” means once per side." : ""}</p>
      <div class="session__start">
        <button class="btn btn--primary btn--lg btn--block" data-action="session-start">${ICON.play}<span>Start ${routine.kind === "warmup" ? "warm-up" : "stretching"}</span></button>
        <p class="session__awake">${awakeText(false)}</p>
      </div>
    </section>`;
}

function awakeText(active: boolean) {
  if (!wakeLockSupported() || (!active && wakeLockBlocked() && run)) return `${ICON.alert}<span>This browser won't keep the screen on. Turn off auto-lock while training.</span>`;
  return active ? `${ICON.check}<span>Screen will stay on</span>` : `<span>The screen stays on while the timer runs</span>`;
}

/* ---------------------------------------------------------------------------
 * Engine
 * ------------------------------------------------------------------------- */

interface Run {
  routine: Routine;
  steps: Step[];
  day: number | null;
  back: string;
  i: number;
  phase: "prep" | "work";
  duration: number;
  endsAt: number;
  pausedLeft: number | null;
  lastSec: number;
  interval: ReturnType<typeof setInterval>;
  release: () => void;
  unwatch: () => void;
}

let pending: { routine: Routine; day: number | null; back: string } | null = null;
let run: Run | null = null;

export function startSession() {
  if (!pending) return;
  stopSession();
  unlockAudio(); // this runs inside the Start tap, so audio is allowed
  const steps = expandSteps(pending.routine);
  run = {
    ...pending, steps, i: 0, phase: "prep", duration: PREP_SECONDS, endsAt: 0, pausedLeft: null, lastSec: -1,
    interval: setInterval(tick, 200),
    release: holdScreenOn(),
    unwatch: onWakeLockChange(() => { const el = $(".session__awake"); if (el) el.innerHTML = awakeText(isScreenKeptOn()); }),
  };
  document.body.classList.add("is-session");
  setPhase("prep");
}

export function stopSession() {
  if (!run) return;
  clearInterval(run.interval);
  run.release();
  run.unwatch();
  run = null;
  document.body.classList.remove("is-session");
}

function setPhase(phase: "prep" | "work") {
  if (!run) return;
  run.phase = phase;
  run.duration = phase === "prep" ? PREP_SECONDS : run.steps[run.i]!.seconds;
  run.endsAt = Date.now() + run.duration * 1000;
  run.pausedLeft = null;
  run.lastSec = run.duration;
  if (phase === "work") cue.go(sound());
  paint();
  announce();
}

function tick() {
  if (!run || run.pausedLeft != null) return;
  const left = Math.ceil((run.endsAt - Date.now()) / 1000);
  if (left <= 0) return advance();
  if (left !== run.lastSec) {
    run.lastSec = left;
    if (left <= 3) cue.tick(sound());
    paintClock();
  }
}

function advance() {
  if (!run) return;
  if (run.phase === "prep") return setPhase("work");
  goTo(run.i + 1);
}

function goTo(i: number) {
  if (!run) return;
  if (i >= run.steps.length) return finish();
  run.i = Math.max(0, i);
  setPhase("prep");
}

export function sessionControl(what: string) {
  if (!run) return;
  if (what === "pause") {
    if (run.pausedLeft == null) run.pausedLeft = Math.max(0, run.endsAt - Date.now());
    else { run.endsAt = Date.now() + run.pausedLeft; run.pausedLeft = null; }
    paint();
  } else if (what === "next") {
    goTo(run.i + 1);
  } else if (what === "prev") {
    // Early in a move → previous move; otherwise restart this one.
    const elapsed = run.duration - Math.ceil((run.endsAt - Date.now()) / 1000);
    goTo(run.phase === "prep" || elapsed < 3 ? run.i - 1 : run.i);
  } else if (what === "sound") {
    store.state.settings.sound = !store.state.settings.sound;
    changed("local");
    if (store.state.settings.sound) unlockAudio();
    paint();
  }
}

function finish() {
  if (!run) return;
  const { routine, day, back } = run;
  cue.done(sound());
  stopSession();
  const el = $("#session");
  if (!el) return;
  const toWorkout = day != null; // came from a workout (program day or logged session)
  const next = routine.kind === "warmup" && toWorkout
    ? `<a class="btn btn--primary btn--lg btn--block" href="${back}">Go to workout</a>`
    : `<a class="btn btn--primary btn--lg btn--block" href="${toWorkout ? back : "#/today"}">${toWorkout ? "Back to workout" : "Back to Today"}</a>`;
  el.className = "session session--done";
  el.innerHTML = `
    <div class="session__done">
      <span class="session__done-icon">${ICON.check}</span>
      <p class="eyebrow">${routine.kind === "warmup" ? "Warm-up" : "Stretching"} complete</p>
      <h1 class="page-title">Nice work.</h1>
      <p class="muted">${esc(routine.finishTip)}</p>
      ${next}
      <button class="btn btn--ghost btn--block" data-action="session-restart">Do it again</button>
    </div>`;
  $("#session-live")!.textContent = `${routine.title} complete.`;
}

/* ---------------------------------------------------------------------------
 * Painting (full paint on step/pause changes, clock-only paint each second)
 * ------------------------------------------------------------------------- */

const R = 88, C = 2 * Math.PI * R;

function paint() {
  const el = $("#session");
  if (!run || !el) return;
  const s = run.steps[run.i]!;
  const next = run.steps[run.i + 1];
  const paused = run.pausedLeft != null;
  el.className = `session session--running is-${run.phase}${paused ? " is-paused" : ""}`;
  el.innerHTML = `
    <header class="session__top">
      <a class="icon-btn session__close" href="${run.back}" aria-label="End session">${ICON.close}</a>
      <p class="session__count">${run.i + 1} <span>/ ${run.steps.length}</span></p>
      <button class="icon-btn session__sound" data-action="session-sound" aria-pressed="${sound()}" aria-label="Sound ${sound() ? "on" : "off"}">${sound() ? ICON.soundOn : ICON.soundOff}</button>
    </header>
    <div class="session__bar" aria-hidden="true">${run.steps.map((_, k) => `<span class="${k < run!.i ? "is-done" : k === run!.i ? "is-now" : ""}"></span>`).join("")}</div>
    <div class="session__stage">
      <p class="session__phase">${paused ? "Paused" : run.phase === "prep" ? (s.side === "Right" && run.i > 0 && run.steps[run.i - 1]!.name === s.name ? "Switch sides" : "Get ready") : "Go"}</p>
      <div class="session__ring" role="timer" aria-live="off">
        <svg viewBox="0 0 200 200" aria-hidden="true">
          <circle class="session__track" cx="100" cy="100" r="${R}"/>
          <circle class="session__arc" cx="100" cy="100" r="${R}" stroke-dasharray="${C}"/>
        </svg>
        <span class="session__time"></span>
      </div>
      <h1 class="session__name">${esc(s.name)}</h1>
      ${s.side ? `<p class="session__side">${s.side} side</p>` : ""}
      <p class="session__cue">${esc(s.cue)}</p>
    </div>
    <p class="session__next">${next ? `Next: <b>${esc(next.name)}${next.side ? ` · ${next.side}` : ""}</b>` : "Last one"}</p>
    <div class="session__controls">
      <button class="session__ctrl" data-action="session-prev" aria-label="Previous">${ICON.skipBack}</button>
      <button class="session__ctrl session__ctrl--main" data-action="session-pause" aria-label="${paused ? "Resume" : "Pause"}">${paused ? ICON.playSolid : ICON.pause}</button>
      <button class="session__ctrl" data-action="session-next" aria-label="Skip">${ICON.skipNext}</button>
    </div>
    <p class="session__awake">${awakeText(isScreenKeptOn())}</p>`;
  paintClock();
}

function paintClock() {
  if (!run) return;
  const left = run.pausedLeft != null ? Math.ceil(run.pausedLeft / 1000) : Math.max(0, Math.ceil((run.endsAt - Date.now()) / 1000));
  const t = $(".session__time");
  if (t) t.textContent = fmt(left);
  const arc = $<SVGCircleElement>(".session__arc");
  if (arc) arc.style.strokeDashoffset = String(C * (1 - left / run.duration));
}

function announce() {
  const live = $("#session-live");
  if (!run || !live) return;
  const s = run.steps[run.i]!;
  live.textContent = run.phase === "prep"
    ? `Get ready: ${s.name}${s.side ? `, ${s.side} side` : ""}. ${s.seconds} seconds.`
    : "Go.";
}

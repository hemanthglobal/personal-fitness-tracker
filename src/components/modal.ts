import { esc, $ } from "../lib/utils";

interface ConfirmOptions {
  title: string;
  body: string;
  confirmLabel?: string;
  danger?: boolean;
}

/** Confirmation dialog for destructive / overwriting actions only. Resolves true on confirm. */
export function confirmDialog({ title, body, confirmLabel = "Confirm", danger = false }: ConfirmOptions): Promise<boolean> {
  const dlg = $<HTMLDialogElement>("#dialog");
  if (!dlg || typeof dlg.showModal !== "function") return Promise.resolve(window.confirm(`${title}\n\n${body}`));
  dlg.innerHTML = `
    <form method="dialog" class="dialog__panel">
      <h2 id="dialog-title" class="dialog__title">${esc(title)}</h2>
      <p class="dialog__body">${esc(body)}</p>
      <div class="dialog__actions">
        <button class="btn btn--ghost" value="cancel" autofocus>Cancel</button>
        <button class="btn ${danger ? "btn--danger" : "btn--primary"}" value="confirm">${esc(confirmLabel)}</button>
      </div>
    </form>`;
  dlg.returnValue = "";
  return new Promise((resolve) => {
    let settled = false;
    const done = (ok: boolean) => { if (!settled) { settled = true; resolve(ok); } };
    // Resolve from the submitting button directly; `close` is the fallback (Esc / backdrop).
    dlg.querySelector("form")!.addEventListener("submit", (e) => done((e.submitter as HTMLButtonElement | null)?.value === "confirm"), { once: true });
    dlg.addEventListener("close", () => done(dlg.returnValue === "confirm"), { once: true });
    // Tap on the backdrop cancels.
    dlg.onclick = (e) => { if (e.target === dlg) dlg.close("cancel"); };
    dlg.showModal();
  });
}

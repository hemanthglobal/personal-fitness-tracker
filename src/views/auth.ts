/* Sign up / log in / forgot password / set new password. */

export type AuthScreen = "login" | "signup" | "forgot" | "reset";

const brand = `<div class="onboard__mark" aria-hidden="true"><span class="brand-mark brand-mark--lg">60</span></div>`;

const emailField = (id: string) => `
  <div class="field">
    <label for="${id}">Email</label>
    <input id="${id}" name="email" type="email" class="input" autocomplete="email" inputmode="email" required>
  </div>`;

const passwordField = (id: string, label: string, autocomplete: string) => `
  <div class="field">
    <label for="${id}">${label}</label>
    <input id="${id}" name="password" type="password" class="input" autocomplete="${autocomplete}" minlength="8" required>
  </div>`;

const errorSlot = `<p class="field__err" id="auth-err" role="alert" hidden></p><p class="field__ok" id="auth-ok" role="status" hidden></p>`;

export function renderAuth(screen: AuthScreen): string {
  if (screen === "signup") {
    return `<section class="onboard">${brand}
      <h1 class="onboard__title">Create your account</h1>
      <p class="onboard__lede">Your workouts sync privately across your devices.</p>
      <form class="card form" data-form="signup" novalidate>
        ${emailField("su-email")}
        ${passwordField("su-password", "Password", "new-password")}
        <p class="field__help">At least 8 characters.</p>
        ${errorSlot}
        <button class="btn btn--primary btn--block btn--lg" type="submit">Create account</button>
      </form>
      <p class="auth-switch">Already have an account? <a href="#/login">Log in</a></p>
    </section>`;
  }
  if (screen === "forgot") {
    return `<section class="onboard">${brand}
      <h1 class="onboard__title">Reset password</h1>
      <p class="onboard__lede">We'll email you a link to set a new password.</p>
      <form class="card form" data-form="forgot" novalidate>
        ${emailField("fp-email")}
        ${errorSlot}
        <button class="btn btn--primary btn--block btn--lg" type="submit">Send reset link</button>
      </form>
      <p class="auth-switch"><a href="#/login">Back to log in</a></p>
    </section>`;
  }
  if (screen === "reset") {
    return `<section class="onboard">${brand}
      <h1 class="onboard__title">Set a new password</h1>
      <form class="card form" data-form="reset" novalidate>
        ${passwordField("rp-password", "New password", "new-password")}
        ${errorSlot}
        <button class="btn btn--primary btn--block btn--lg" type="submit">Save password</button>
      </form>
    </section>`;
  }
  return `<section class="onboard">${brand}
    <p class="eyebrow">60 Days to Fit</p>
    <h1 class="onboard__title">Welcome back.</h1>
    <form class="card form" data-form="login" novalidate>
      ${emailField("li-email")}
      ${passwordField("li-password", "Password", "current-password")}
      ${errorSlot}
      <button class="btn btn--primary btn--block btn--lg" type="submit">Log in</button>
      <a class="auth-link" href="#/forgot">Forgot password?</a>
    </form>
    <p class="auth-switch">New here? <a href="#/signup">Create an account</a></p>
  </section>`;
}

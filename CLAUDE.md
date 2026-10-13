# 60 Days Tracker

Personal fitness training log (Vite + TypeScript + Tailwind v4, Supabase Auth/Postgres/RLS, GitHub Pages).
**Read `docs/HANDOFF.md` first.** It has the full history, decisions, code map, data model, environment
notes and next steps.

Key rules:
- `docs/agent-instructions.md` lists the product rules and the user's later decisions (programs model, flexible plan).
- The source PDF is the truth for the built-in 60 Days to Fit program. Never invent exercises, reps or video URLs.
- Never print or commit `.env.local`. Never grant table access to `anon`.
- Schema changes go in a new `supabase/migrations/000N_*.sql`. The user runs it in the Supabase SQL Editor before the code is pushed.
- Node is at `C:\Program Files\nodejs` (`export PATH="/c/Program Files/nodejs:$PATH"` in Git Bash). Checks: `npm run typecheck && npm test && npm run build`.
- Commit/push only when asked. End each task with short step-by-step instructions for the user.

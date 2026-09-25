# GitHub + Supabase Architecture & Deployment Instructions
## Second Instruction File for the AI Coding Agent

> **Important:** This file is a separate deployment/architecture instruction document.
>
> Do **not** modify or replace the previously supplied fitness UI/UX instruction file. Treat both files as complementary:
>
> 1. `fitness_tracker_agent_instructions.md` = product, workout logic and UI/UX requirements.
> 2. This file = technology architecture, Supabase database, GitHub repository, GitHub Pages deployment, custom domain and CI/CD.
>
> If the two files appear to conflict, preserve the workout programme requirements and the premium UI/UX requirements from the first file while following this file for infrastructure and deployment.

---

# 1. Recommended Architecture

Build the application as:

```text
Frontend
    ↓
Vite
    ↓
TypeScript
    ↓
HTML
    ↓
Tailwind CSS
    ↓
Supabase JS client
    ↓
Supabase Auth
    ↓
Supabase Postgres
```

Hosting:

```text
GitHub Repository
        ↓
GitHub Actions
        ↓
Vite production build
        ↓
GitHub Pages
        ↓
Custom Domain
```

Database:

```text
Supabase
├── Authentication
├── PostgreSQL
├── Row Level Security
└── Database migrations
```

This is the preferred architecture for this project.

GitHub Pages is a static hosting service and can publish HTML/CSS/JavaScript from a repository, including sites that use a build process. It also supports custom domains. citeturn0search11turn0search4

---

# 2. Important Answer: Can GitHub Pages Use Supabase?

## Yes.

GitHub Pages can host the frontend while the browser communicates directly with Supabase.

The architecture is:

```text
User's Browser
       │
       ├── HTTPS
       ↓
GitHub Pages
       │
       │ loads the static application
       ↓
Frontend JavaScript
       │
       │ HTTPS requests
       ↓
Supabase
       │
       ├── Auth
       └── PostgreSQL
```

GitHub Pages does **not** need to "install" or "configure Supabase" as a server.

Supabase is an external backend service.

The frontend simply uses `@supabase/supabase-js` to communicate with the Supabase project. Supabase officially supports creating a browser client using the project URL and publishable key. citeturn0search0turn0search7

---

# 3. Critical Security Rule

There is an important distinction:

## Safe to expose in browser

```text
Supabase project URL
Supabase publishable key
```

## NEVER expose in browser

```text
Supabase secret key
service_role key
database password
GitHub personal access token
Supabase access token with administrative privileges
```

Supabase explicitly states that secret/service-role credentials must remain server-side and must never be exposed to customers or browser code. citeturn0search2

The frontend must therefore use only the Supabase **publishable key**.

---

# 4. Why Authentication Is Required

This is a personal fitness application.

The database contains personal information such as:

- Workout history
- Weight logs
- Exercise performance
- Notes
- Programme progress

Therefore, do **not** build the production version as:

```text
Public website
    ↓
Anyone can read/write one shared database
```

Instead use:

```text
User
 ↓
Supabase Auth
 ↓
Authenticated Supabase session
 ↓
Postgres + Row Level Security
 ↓
Only that user's rows
```

This is essential.

Supabase recommends combining Auth with Row Level Security for end-to-end browser-to-database security. citeturn0search2

---

# 5. Recommended Authentication

Use Supabase Auth.

Start with:

```text
Email + password
```

Optionally add:

```text
Magic link
```

Do not add Google, Apple or other OAuth providers unless explicitly requested.

Keep authentication simple.

Required flows:

```text
Sign Up
Log In
Log Out
Forgot Password
Session Restore
```

The app should remain logged in after a page refresh.

Supabase's browser client supports persisted sessions. citeturn0search7

---

# 6. Frontend Technology

Use:

```text
Vite
TypeScript
HTML
Tailwind CSS
Supabase JS
```

Do NOT use:

```text
React
Next.js
Vue
Angular
Svelte
```

unless explicitly requested later.

The goal is a lightweight application.

Use TypeScript for application logic because the data model is structured enough that type safety is useful.

---

# 7. Suggested Project Structure

Create:

```text
fitness-tracker/
│
├── index.html
├── package.json
├── tsconfig.json
├── vite.config.ts
├── tailwind.config.ts
├── postcss.config.js
│
├── src/
│   ├── main.ts
│   ├── app.ts
│   │
│   ├── styles/
│   │   └── main.css
│   │
│   ├── components/
│   │   ├── navigation.ts
│   │   ├── day-card.ts
│   │   ├── workout-card.ts
│   │   ├── exercise-card.ts
│   │   ├── set-row.ts
│   │   ├── progress-card.ts
│   │   ├── modal.ts
│   │   └── toast.ts
│   │
│   ├── views/
│   │   ├── login.ts
│   │   ├── signup.ts
│   │   ├── today.ts
│   │   ├── calendar.ts
│   │   ├── workout.ts
│   │   ├── progress.ts
│   │   ├── nutrition.ts
│   │   └── settings.ts
│   │
│   ├── lib/
│   │   ├── supabase.ts
│   │   ├── auth.ts
│   │   ├── database.ts
│   │   ├── storage.ts
│   │   └── utils.ts
│   │
│   ├── data/
│   │   └── workout-data.ts
│   │
│   └── types/
│       ├── database.ts
│       └── workout.ts
│
├── public/
│   └── icons/
│
├── supabase/
│   ├── migrations/
│   └── seed.sql
│
├── .github/
│   └── workflows/
│       └── deploy.yml
│
├── .env.example
├── .gitignore
├── README.md
└── CNAME
```

The exact file structure may be adjusted if the agent has a better lightweight organisation, but the separation of concerns must remain.

---

# 8. Package Requirements

Install only what is actually needed.

Core:

```bash
npm install @supabase/supabase-js
```

Development/build:

```bash
npm install -D vite typescript tailwindcss
```

Supabase officially provides `@supabase/supabase-js` as the JavaScript client package. citeturn0search1

Do not install a large component library.

Do not install a state-management framework.

Do not install a routing framework unless genuinely required.

---

# 9. Environment Variables

Use:

```text
VITE_SUPABASE_URL
VITE_SUPABASE_PUBLISHABLE_KEY
```

Example `.env.example`:

```env
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=sb_publishable_xxxxxxxxx
```

Never commit the real `.env`.

`.gitignore` must include:

```text
.env
.env.local
.env.*.local
```

Important:

Vite environment variables prefixed with `VITE_` are bundled into browser code.

That is acceptable only for values that are intentionally public.

Therefore:

```text
VITE_SUPABASE_URL                SAFE
VITE_SUPABASE_PUBLISHABLE_KEY    SAFE
SUPABASE_SECRET_KEY              NEVER
SUPABASE_DB_PASSWORD             NEVER
```

---

# 10. Supabase Client

Create:

```text
src/lib/supabase.ts
```

Use the browser client.

Conceptually:

```typescript
import { createClient } from "@supabase/supabase-js";

export const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY
);
```

Do not put secrets in this file.

---

# 11. Database Design

Use PostgreSQL in Supabase.

The database should be designed around the user rather than around one shared fitness programme.

Recommended tables:

```text
profiles
programmes
programme_days
workout_sessions
exercise_sets
body_weight_entries
```

The static programme definition can remain in TypeScript because it comes from the source PDF and doesn't need to be user-editable.

The database should primarily store:

```text
user-specific data
```

rather than duplicating all programme metadata.

---

# 12. Profiles Table

Create:

```sql
profiles
```

Suggested fields:

```text
id UUID PRIMARY KEY
display_name TEXT
weight_unit TEXT
created_at TIMESTAMPTZ
updated_at TIMESTAMPTZ
```

`id` should reference:

```text
auth.users(id)
```

Use UUID.

Do not store passwords.

Supabase Auth handles authentication credentials.

---

# 13. Programmes Table

Create:

```sql
programmes
```

Suggested fields:

```text
id UUID PRIMARY KEY
user_id UUID NOT NULL
name TEXT NOT NULL
start_date DATE NOT NULL
status TEXT NOT NULL
created_at TIMESTAMPTZ
updated_at TIMESTAMPTZ
```

Example status:

```text
active
completed
cancelled
```

A user can eventually have multiple programme records.

Do not assume there can only ever be one programme.

---

# 14. Programme Days Table

Create:

```sql
programme_days
```

Suggested fields:

```text
id UUID PRIMARY KEY
programme_id UUID NOT NULL
day_number INTEGER NOT NULL
cycle_number INTEGER NOT NULL
workout_code TEXT
workout_type TEXT
is_rest_day BOOLEAN NOT NULL
scheduled_date DATE NOT NULL
completed BOOLEAN NOT NULL DEFAULT FALSE
completed_at TIMESTAMPTZ
```

Example:

```text
day_number = 17
cycle_number = 2
workout_code = D
workout_type = heavy
is_rest_day = false
scheduled_date = 2026-10-11
```

The actual schedule should still be generated from the source programme logic.

Do not manually enter 60 unrelated database rows.

---

# 15. Workout Sessions Table

Create:

```sql
workout_sessions
```

Suggested fields:

```text
id UUID PRIMARY KEY
user_id UUID NOT NULL
programme_day_id UUID NOT NULL
started_at TIMESTAMPTZ
completed_at TIMESTAMPTZ
notes TEXT
created_at TIMESTAMPTZ
updated_at TIMESTAMPTZ
```

This represents an actual workout attempt/session.

Do not treat the programme day itself as the workout log.

---

# 16. Exercise Sets Table

Create:

```sql
exercise_sets
```

Suggested fields:

```text
id UUID PRIMARY KEY
workout_session_id UUID NOT NULL
exercise_code TEXT NOT NULL
set_number INTEGER NOT NULL
weight NUMERIC
reps INTEGER
notes TEXT
completed BOOLEAN NOT NULL DEFAULT FALSE
created_at TIMESTAMPTZ
updated_at TIMESTAMPTZ
```

Use an exercise code rather than relying only on display names.

Example:

```text
shoulder_db_lateral_raise
```

This prevents problems if display text changes later.

---

# 17. Body Weight Table

Create:

```sql
body_weight_entries
```

Suggested fields:

```text
id UUID PRIMARY KEY
user_id UUID NOT NULL
recorded_at DATE NOT NULL
weight NUMERIC NOT NULL
unit TEXT NOT NULL
notes TEXT
created_at TIMESTAMPTZ
updated_at TIMESTAMPTZ
```

---

# 18. Foreign Keys

Use proper foreign keys.

Conceptually:

```text
profiles
  ↓
programmes
  ↓
programme_days
  ↓
workout_sessions
  ↓
exercise_sets
```

And:

```text
profiles
  ↓
body_weight_entries
```

Use cascading deletes carefully.

If deleting a programme should delete its programme days and workout sessions, implement that deliberately.

Do not accidentally allow orphaned records.

---

# 19. Unique Constraints

Add appropriate uniqueness.

Examples:

```text
programme_days:
UNIQUE(programme_id, day_number)

exercise_sets:
UNIQUE(workout_session_id, exercise_code, set_number)
```

This helps prevent duplicate records when the user double-clicks Save or a request is retried.

---

# 20. Row Level Security

**RLS is mandatory.**

Enable RLS on every user-data table.

At minimum:

```text
profiles
programmes
programme_days
workout_sessions
exercise_sets
body_weight_entries
```

Supabase states that tables exposed through the API should have RLS enabled, with policies defining which rows each role can access. citeturn0search2turn0search9

---

# 21. RLS Policy Model

The basic rule is:

```text
A logged-in user can access only their own data.
```

For example:

```text
auth.uid() = user_id
```

For child tables where `user_id` is not directly present, use relationships or include `user_id` where it materially simplifies secure policies.

Do not create:

```text
Allow authenticated users to select everything
```

Do not create:

```text
Allow anon users to modify workout data
```

Do not create a shared public policy.

---

# 22. Profiles RLS

Policies should allow:

```text
SELECT own profile
INSERT own profile
UPDATE own profile
```

and reject other users.

The application must never be able to read another user's profile.

---

# 23. Programme RLS

Allow an authenticated user to:

```text
SELECT own programmes
INSERT own programmes
UPDATE own programmes
DELETE own programmes
```

Only where:

```text
programmes.user_id = auth.uid()
```

---

# 24. Programme Day RLS

A user should only access programme days belonging to programmes they own.

Do not use a policy such as:

```text
authenticated users can read programme_days
```

unless the table is genuinely public.

These are personal programme records.

---

# 25. Workout Session RLS

Allow access only when:

```text
workout_sessions.user_id = auth.uid()
```

The user must not be able to access another user's workout sessions by changing a UUID in a request.

---

# 26. Exercise Set RLS

Exercise sets belong to workout sessions.

Policies must ensure that:

```text
exercise_sets
    ↓
workout_sessions
    ↓
same authenticated user
```

Do not trust the frontend to supply the correct `user_id`.

The database policy must enforce it.

---

# 27. Body Weight RLS

Allow:

```text
SELECT own entries
INSERT own entries
UPDATE own entries
DELETE own entries
```

Only for:

```text
user_id = auth.uid()
```

---

# 28. Never Trust the Frontend

This is critical.

The frontend is controlled by the user.

Never rely on:

```typescript
if (user.id === record.user_id)
```

as the security mechanism.

That is only a UX convenience.

The actual security boundary must be:

```text
Supabase Auth
+
Postgres RLS
```

---

# 29. Supabase Secret Keys

Never put these into:

```text
index.html
src/
public/
GitHub repository
GitHub Pages
browser localStorage
browser session storage
```

Never send them to the browser.

Supabase documents that secret/service-role keys bypass RLS and must remain server-side. citeturn0search2

If a future administrative backend is required, use a server-side environment such as a Supabase Edge Function.

---

# 30. GitHub Repository

Create one repository.

Suggested name:

```text
personal-fitness-tracker
```

Recommended branch:

```text
main
```

The repository should contain:

```text
Source code
Supabase migrations
GitHub Actions workflow
Documentation
```

Do not commit:

```text
.env
real API secrets
database passwords
personal exported workout data
```

---

# 31. GitHub Pages Deployment

Use GitHub Actions.

Do not rely on manually uploading `dist/`.

Every push to `main` should:

```text
1. Checkout repository
2. Install Node dependencies
3. Run type checking
4. Run tests
5. Build production application
6. Deploy dist/ to GitHub Pages
```

The deployment should fail if the build fails.

---

# 32. GitHub Actions

Create:

```text
.github/workflows/deploy.yml
```

The workflow should:

```text
on:
  push:
    branches:
      - main
```

Then:

```text
checkout
setup-node
npm ci
npm run typecheck
npm run test
npm run build
deploy to GitHub Pages
```

Use GitHub's supported Pages deployment actions rather than inventing a custom deployment mechanism.

---

# 33. Build Configuration

The Vite build should produce:

```text
dist/
```

The production site must contain only the generated frontend assets.

Do not deploy:

```text
.env
supabase secrets
local development files
node_modules
tests
```

---

# 34. GitHub Actions Environment Variables

For a static browser application, remember:

```text
VITE_* variables become part of the browser bundle.
```

Therefore, only place intentionally public values there.

The Supabase project URL and publishable key can be used by the browser, provided RLS is correctly configured. Supabase explicitly supports use of the publishable key in client-side code. citeturn0search0

Do NOT put a Supabase secret key into GitHub Actions simply to pass it to the frontend.

That would expose it in the final bundle.

---

# 35. Supabase Database Migrations

Database schema changes must be stored in:

```text
supabase/migrations/
```

Do not rely on manually clicking around the Supabase dashboard for production schema changes.

The repository should become the source-controlled definition of the database.

Example:

```text
supabase/
└── migrations/
    ├── 001_initial_schema.sql
    ├── 002_rls_policies.sql
    └── 003_indexes.sql
```

Use sequential migration files.

---

# 36. Supabase CLI

If the agent has access to the Supabase CLI, use it for migrations.

The development workflow should be:

```text
Local code
    ↓
Migration
    ↓
Test
    ↓
Commit
    ↓
Apply to Supabase
```

Do not make random schema changes without recording them in migrations.

---

# 37. Database Seed Data

The static workout programme should primarily live in:

```text
src/data/workout-data.ts
```

Do not duplicate the entire exercise programme unnecessarily inside Postgres.

The database is for user state.

The TypeScript data is for programme definition.

This keeps the system simpler.

---

# 38. What Goes Into Supabase

Store:

```text
User account
Profile
Programme start date
Programme status
Scheduled programme days
Workout sessions
Exercise set logs
Exercise notes
Body-weight entries
```

Do NOT store unnecessarily:

```text
CSS
UI layout
Static workout definitions
Icons
Page HTML
Tailwind styles
```

---

# 39. What Stays in the Frontend

Keep these in TypeScript:

```text
Workout A/B/C/D definitions
Exercise names
Exercise codes
Set counts
Light/heavy rules
Rep progression
Tempo rules
Superset relationships
60-day programme pattern
Nutrition reference data
Shopping list
```

These are programme definitions.

---

# 40. Synchronisation Strategy

The frontend should use Supabase as the persistent source of truth.

Recommended behaviour:

```text
User opens app
    ↓
Restore Auth session
    ↓
Load profile
    ↓
Load active programme
    ↓
Load today's workout data
    ↓
Render UI
```

When the user changes data:

```text
User changes set
    ↓
Update local UI immediately
    ↓
Save to Supabase
    ↓
Show success/error state
```

Do not make the interface feel slow by waiting for the network before updating obvious UI state.

---

# 41. Optimistic UI

For routine actions such as:

```text
Set completed
Weight changed
Reps changed
Note saved
```

use optimistic UI where safe.

Example:

```text
User enters 10 kg
       ↓
UI immediately shows 10 kg
       ↓
Supabase save runs
       ↓
Success → keep state
Failure → show error + allow retry
```

Do not silently lose data if a network request fails.

---

# 42. Offline Strategy

Because the application is personal and workout environments may have poor internet connectivity, retain a local cache.

Use:

```text
localStorage
```

or an appropriate lightweight browser persistence layer.

The local cache is a UX/offline layer.

Supabase remains the cloud source of truth.

Do not treat localStorage as a security boundary.

---

# 43. Offline Conflict Strategy

If the user changes data offline and later reconnects:

```text
local change
    ↓
queued
    ↓
network restored
    ↓
sync
```

For the initial version, keep conflict handling simple.

If the same set was changed on two devices, prefer the latest timestamp and do not attempt complicated merge logic.

Document this behaviour.

---

# 44. Auth State

Listen for Supabase auth state changes.

The UI should react to:

```text
SIGNED_IN
SIGNED_OUT
TOKEN_REFRESHED
USER_UPDATED
```

When signed out:

```text
Show login screen.
```

When signed in:

```text
Load application.
```

Do not briefly expose another user's cached data.

Clear user-specific in-memory state when the user signs out.

---

# 45. Route Handling

Because GitHub Pages is static hosting, avoid depending on server-side route handling.

For the initial version, use simple client-side view state such as:

```text
#today
#calendar
#progress
#settings
```

or another GitHub-Pages-safe approach.

Do not assume that `/workout/17` will be served by GitHub Pages as if a Node server exists.

---

# 46. GitHub Pages Base Path

The app must work correctly when deployed as a GitHub Pages project.

Configure Vite correctly.

If the repository is:

```text
username.github.io
```

the base can be:

```text
/
```

If the repository is:

```text
username/personal-fitness-tracker
```

the GitHub Pages project URL normally includes:

```text
/personal-fitness-tracker/
```

However, because the final deployment uses a custom domain, configure the project deliberately and test both local development and production.

Do not hard-code `/`.

---

# 47. Custom Domain

The final public URL should be:

```text
https://your-domain.com
```

GitHub Pages supports:

- Apex domains
- `www` subdomains
- Other custom subdomains. citeturn0search4

Recommended setup:

```text
your-domain.com
        ↓
GitHub Pages

www.your-domain.com
        ↓
GitHub Pages
```

Use GitHub's custom-domain configuration rather than trying to point the domain directly at Supabase.

---

# 48. DNS Configuration

For an apex domain, GitHub documents using the appropriate GitHub Pages A/AAAA records or an ALIAS/ANAME record where supported.

For a `www` subdomain, use a CNAME pointing to the GitHub Pages hostname. citeturn0search3

Do not invent DNS values.

The actual DNS records should be copied from the current GitHub Pages documentation/settings when configuring the real domain.

---

# 49. Custom Domain Security

Verify the custom domain with GitHub before using it where possible.

GitHub recommends verifying a custom domain to reduce the risk of domain takeover. citeturn0search3turn0search4

Enable:

```text
Enforce HTTPS
```

when GitHub makes it available.

Do not use wildcard DNS records unless there is a specific reason.

GitHub explicitly warns against wildcard DNS records for Pages domains. citeturn0search3

---

# 50. Supabase Auth URL Configuration

Once the custom domain is known, configure Supabase Auth:

```text
Site URL
Redirect URLs
```

The production URL should be the real custom domain.

Example:

```text
https://your-domain.com
```

If authentication uses redirects, explicitly allow only the required production and local-development URLs.

Do not use:

```text
*
```

as a production redirect URL.

---

# 51. Local Development URL

Use:

```text
http://localhost:5173
```

during Vite development.

Configure Supabase Auth to allow it during development.

Production should use:

```text
https://your-domain.com
```

Keep development and production URLs clearly separated.

---

# 52. Supabase API Access

The frontend communicates with Supabase using:

```text
HTTPS
```

and:

```text
@supabase/supabase-js
```

Supabase's Data API provides access to Postgres tables/functions according to database grants and RLS policies. citeturn0search1turn0search6

Before deployment:

- Expose only required tables/functions.
- Enable RLS.
- Create explicit policies.
- Test allowed operations.
- Test denied operations.

---

# 53. Database Indexes

Add indexes where appropriate.

At minimum consider:

```text
programmes.user_id
programme_days.programme_id
programme_days.scheduled_date
workout_sessions.user_id
workout_sessions.programme_day_id
exercise_sets.workout_session_id
body_weight_entries.user_id
body_weight_entries.recorded_at
```

Do not blindly add indexes to every column.

---

# 54. Database Timestamps

Use PostgreSQL timestamps:

```text
TIMESTAMPTZ
```

for:

```text
created_at
updated_at
started_at
completed_at
```

Use `DATE` for calendar dates where a time is not meaningful.

Avoid storing dates as arbitrary text.

---

# 55. UUIDs

Use UUID primary keys for user-owned records.

Do not use:

```text
1
2
3
4
```

as database primary keys for user records.

Use PostgreSQL-generated UUIDs.

---

# 56. Validation

Validate both:

## Frontend

For user experience:

```text
Weight must be numeric.
Reps must be a positive integer.
Date must be valid.
```

## Database

For security and data integrity:

```text
NOT NULL
CHECK constraints
FOREIGN KEYS
UNIQUE constraints
RLS
```

Do not rely solely on frontend validation.

---

# 57. Workout Data Integrity

The frontend must not be able to create:

```text
negative reps
negative weight
set number 9999
unknown exercise codes
workout sessions belonging to another user
programme days belonging to another programme
```

Use appropriate validation and constraints.

---

# 58. Error Handling

If Supabase fails:

Do not display raw database errors to the user.

Instead:

```text
Couldn't save that set.
Your local changes are still here.
Try again.
```

Log useful technical information during development.

Do not expose:

- SQL
- database internals
- tokens
- keys
- stack traces

to the user.

---

# 59. Network Status

Display a subtle status when useful:

```text
● Synced
```

or:

```text
○ Offline
```

If a save is pending:

```text
Saving...
```

After success:

```text
Saved
```

Do not make network status visually dominant.

---

# 60. Sync UX

The user should never wonder:

> "Did my workout actually save?"

For important actions, provide clear feedback.

Example:

```text
Set saved ✓
```

For failures:

```text
Couldn't sync.
Retry
```

Keep the local value visible.

---

# 61. Delete Behaviour

For destructive actions:

```text
Delete set
Delete workout
Delete programme
Delete account data
```

require confirmation where appropriate.

Never make destructive actions one accidental tap away.

---

# 62. Account Deletion

If account deletion is implemented, treat it as a serious destructive action.

The UI should clearly explain what is removed.

Do not implement account deletion by simply deleting the `profiles` row if Auth data remains.

If true account deletion is required, use a secure server-side mechanism such as a Supabase Edge Function or another approved server-side administrative mechanism.

Never expose an administrative Supabase key to the browser.

---

# 63. Testing

Create automated tests for programme logic.

At minimum test:

```text
Day 1
Day 2
Day 3
Day 12
Day 13
Day 24
Day 25
Day 36
Day 37
Day 48
Day 49
Day 60
```

Verify:

```text
Workout code
Light/heavy
Rest
Cycle
Target reps
```

---

# 64. Database Security Tests

Before production, verify:

### User A

Can:

```text
read own programme
write own programme
read own workout
write own workout
read own weight
write own weight
```

Cannot:

```text
read User B's programme
modify User B's workout
read User B's body weight
```

### Anonymous visitor

Cannot:

```text
read private workout data
write private workout data
```

This test is mandatory.

---

# 65. Production Security Checklist

Before deployment:

- [ ] RLS enabled on every user-data table.
- [ ] Policies tested.
- [ ] No service-role/secret key in frontend.
- [ ] No database password in repository.
- [ ] `.env` ignored.
- [ ] GitHub repository checked for accidental secrets.
- [ ] Supabase Auth configured.
- [ ] Production redirect URL configured.
- [ ] HTTPS enabled.
- [ ] Custom domain verified.
- [ ] GitHub Pages deployment works.
- [ ] Database migrations are committed.
- [ ] Production build succeeds.
- [ ] Anonymous access tested.
- [ ] Cross-user access tested.

Supabase's production guidance specifically recommends checking RLS and security configuration before going live. citeturn0search9

---

# 66. GitHub Secrets

Only create GitHub Actions secrets when the workflow genuinely needs them.

Do NOT store the public Supabase publishable key as a "secret" for security theatre.

It is designed to be used client-side.

Do protect any genuinely secret deployment credentials.

If future Supabase migrations are automatically deployed by GitHub Actions, any required Supabase access token must be stored as a GitHub Actions secret and must never be placed in source code.

---

# 67. CI/CD Pipeline

Desired flow:

```text
Developer changes code
        ↓
git commit
        ↓
git push origin main
        ↓
GitHub Actions
        ↓
Install dependencies
        ↓
Typecheck
        ↓
Tests
        ↓
Build
        ↓
Deploy GitHub Pages
        ↓
Production website
```

The deployment should fail if:

```text
TypeScript errors
Tests fail
Build fails
```

Do not deploy broken builds.

---

# 68. Development Commands

README should provide commands such as:

```bash
npm install
npm run dev
npm run typecheck
npm run test
npm run build
npm run preview
```

The exact scripts may be adjusted to the chosen tooling.

---

# 69. Recommended package.json Scripts

Use something similar to:

```json
{
  "scripts": {
    "dev": "vite",
    "build": "tsc && vite build",
    "preview": "vite preview",
    "typecheck": "tsc --noEmit",
    "test": "..."
  }
}
```

Do not add fake scripts.

Every documented command must actually work.

---

# 70. README Requirements

The README must explain:

## Local development

```text
npm install
npm run dev
```

## Environment

Explain:

```text
VITE_SUPABASE_URL
VITE_SUPABASE_PUBLISHABLE_KEY
```

## Supabase

Explain:

- Create project.
- Run migrations.
- Configure Auth.
- Configure redirect URLs.
- Enable/check RLS.

## GitHub

Explain:

- Push to main.
- GitHub Actions builds.
- GitHub Pages deploys.

## Custom domain

Explain where to configure:

```text
GitHub Pages
DNS provider
HTTPS
```

---

# 71. Do Not Commit Personal Data

Never commit:

```text
workout history
body weight
personal notes
Supabase exported database
production `.env`
browser storage dumps
```

The repository should contain code and schema, not personal records.

---

# 72. Supabase Backups

The agent should not pretend GitHub is a database backup.

GitHub contains:

```text
code
migrations
configuration
```

Supabase contains:

```text
live user data
```

If backups become important, use Supabase's supported backup/export facilities.

Do not build a fake backup system that merely downloads frontend data unless explicitly requested.

---

# 73. Architecture Decision

Use this final architecture:

```text
                 ┌──────────────────┐
                 │   Custom Domain  │
                 └────────┬─────────┘
                          │
                          ▼
                 ┌──────────────────┐
                 │   GitHub Pages   │
                 │ Static Frontend  │
                 └────────┬─────────┘
                          │
                     HTTPS│
                          ▼
              ┌───────────────────────┐
              │ Supabase JS Client    │
              └───────────┬───────────┘
                          │
             ┌────────────┴────────────┐
             ▼                         ▼
     ┌───────────────┐        ┌────────────────┐
     │ Supabase Auth │        │ PostgreSQL DB  │
     └───────────────┘        │ + RLS          │
                              └────────────────┘
```

This is the architecture the agent should implement.

---

# 74. Important: Do Not Over-Engineer

This is still a personal application.

Do NOT introduce:

```text
Kubernetes
Docker
microservices
Redis
GraphQL
separate backend server
Express
NestJS
Next.js
React
Redux
complex state management
```

unless the requirements change significantly.

The simple architecture is a strength.

---

# 75. Future Scalability

The architecture should still allow future additions such as:

```text
Multiple programmes
Exercise history
Personal records
Progress photos
Workout templates
Multiple devices
PWA installation
Notifications
Analytics
Social login
AI workout analysis
```

But do not implement these now unless requested.

Build a clean foundation instead.

---

# 76. Final Agent Instruction

Build the application using:

```text
HTML
Tailwind CSS
TypeScript
Vite
Supabase
GitHub
GitHub Pages
Custom Domain
```

Use:

```text
Supabase Auth
+
PostgreSQL
+
Row Level Security
```

for secure personal data.

Use:

```text
GitHub Actions
```

for automated deployment.

The production architecture must be:

```text
GitHub Pages = frontend hosting
Supabase = authentication + database
Custom domain = public website address
GitHub = source control + CI/CD
```

Do not treat GitHub Pages as a backend.

Do not expose Supabase secret credentials.

Do not create a public shared database.

Do not skip RLS.

Do not store personal fitness data in GitHub.

Do not replace the premium UI/UX requirements from the first instruction file with a generic dashboard.

The final application must combine:

```text
Correct 60-day programme
+
Premium UI/UX
+
Type-safe frontend
+
Secure Supabase database
+
Authenticated personal data
+
GitHub Pages deployment
+
Custom domain
+
Automated CI/CD
+
Simple architecture
```

---

# 77. Definition of Done

The project is not complete until:

## Frontend

- [ ] Vite works.
- [ ] TypeScript works.
- [ ] Tailwind CSS works.
- [ ] Production build succeeds.
- [ ] Mobile UI is polished.
- [ ] Desktop UI is polished.
- [ ] Premium UI/UX requirements from the first MD file are satisfied.

## Supabase

- [ ] Supabase project created.
- [ ] Auth configured.
- [ ] Database migrations created.
- [ ] RLS enabled.
- [ ] RLS policies tested.
- [ ] Cross-user access blocked.
- [ ] Anonymous access blocked for private data.

## GitHub

- [ ] Repository created.
- [ ] `.gitignore` configured.
- [ ] No secrets committed.
- [ ] GitHub Actions configured.
- [ ] Build/test/deploy pipeline works.

## GitHub Pages

- [ ] Pages enabled.
- [ ] Production build deployed.
- [ ] Custom domain configured.
- [ ] HTTPS enabled.
- [ ] Production site tested.

## Application

- [ ] Sign up works.
- [ ] Login works.
- [ ] Logout works.
- [ ] Session persistence works.
- [ ] Today's workout loads.
- [ ] Calendar loads.
- [ ] Workout logging works.
- [ ] Data saves to Supabase.
- [ ] Previous performance loads.
- [ ] Progress loads.
- [ ] Body weight loads/saves.
- [ ] Errors are handled gracefully.
- [ ] Offline/local cache behaviour is reasonable.

Only after all of the above pass should the agent describe the project as production-ready.

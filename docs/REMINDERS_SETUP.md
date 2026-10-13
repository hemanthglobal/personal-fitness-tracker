# Reminders setup (one time, about 10 minutes)

Reminders are sent by a small Supabase function that runs every 5 minutes. It works out each
person's local time and sends:

| When (default) | What |
| --- | --- |
| 6:00 pm | Daily motivation quote |
| 7:30 pm (30 min before 8:00 pm gym time) | "Gym in 30 minutes. Hit the gym!" with today's workout. Not sent on rest days or if you already logged a workout. |
| 10:00 pm | "Nothing logged today. Did you skip?" Only if nothing is logged. |
| Sunday 9:00 pm | Weekly summary (workouts vs goal, skipped days) |

All times can be changed in the app under **More → Reminders**.

Your keys are already generated in `fitness-tracker/.env.push.local`. Keep that file private and
never commit it (git ignores it). If it's missing, run `npm run push:keys` in `fitness-tracker/`.

---

## Step 1: Database

Supabase → **SQL Editor** → paste all of `supabase/migrations/0005_reminders_and_habits.sql` → **Run**.

## Step 2: Function secrets

Supabase → **Edge Functions** → **Secrets** → add these four, copying each value from `.env.push.local`:

- `VAPID_PUBLIC_KEY`
- `VAPID_PRIVATE_KEY`
- `VAPID_SUBJECT`
- `CRON_SECRET`

## Step 3: Deploy the function

**Option A: Dashboard (no tools needed)**
1. Supabase → **Edge Functions** → **Deploy a new function** → **Via Editor**.
2. Name it exactly `send-reminders`.
3. Replace the sample code with the whole contents of `supabase/functions/send-reminders/index.ts`.
4. Click **Deploy**.
5. Open the function's **Details / Settings** and turn **OFF** "Enforce JWT verification" (also
   called "Verify JWT"). Then **Save**. The function checks its own secret instead.

**Option B: Command line** (in `fitness-tracker/`)
```bash
npx supabase login
```
```bash
npx supabase functions deploy send-reminders --no-verify-jwt --project-ref YOUR_PROJECT_REF
```

## Step 4: Schedule it every 5 minutes

1. Open `supabase/cron_setup.sql.example`.
2. Copy its contents into Supabase → **SQL Editor**.
3. Replace `<PROJECT_URL>` with your project URL, e.g. `https://abcdefgh.supabase.co`.
4. Replace `<CRON_SECRET>` with the `CRON_SECRET` value from `.env.push.local`.
5. Click **Run**.

If it says an extension is missing, enable **pg_cron** and **pg_net** under **Database →
Extensions**, then run it again.

## Step 5: GitHub variable

GitHub repo → **Settings → Secrets and variables → Actions → Variables** → **New repository variable**:
`VITE_VAPID_PUBLIC_KEY` = the `VITE_VAPID_PUBLIC_KEY` value from `.env.push.local`.
This one is public, so a Variable is right; it isn't a secret.

## Step 6: Publish the app

Push the code (or ask Claude to). The site updates in about a minute.

## Step 7: Turn on each device

- **iPhone/iPad:** open the site in Safari → Share → **Add to Home Screen**. Open the app from the
  Home Screen, because iPhone only allows notifications for installed apps.
- **Android / laptop:** just open the site (installing it is optional).

Then: **More → Reminders → Turn on notifications** → allow → **Send a test**.

---

### Troubleshooting

- **"The reminder function isn't deployed yet"**: Step 3 hasn't been done, or the name isn't exactly `send-reminders`.
- **Test says "No devices are subscribed"**: tap *Turn on notifications* on that device first.
- **Nothing arrives at 6 pm**: in SQL Editor run `select * from cron.job_run_details order by start_time desc limit 5;`.
  Every run should show `succeeded`. Also check the function's **Logs** in Supabase.
- **Blocked**: if you tapped "Block" by mistake, allow notifications for the site in your browser's
  site settings, then reload.

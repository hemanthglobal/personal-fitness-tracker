/*
 * Daily motivation lines (original, written for this app).
 * Must stay identical to QUOTES in supabase/functions/send-reminders/index.ts (a test checks this),
 * so the 6 pm notification and the quote on Today match.
 */
export const QUOTES: string[] = [
  "Show up today. Your future self is counting the reps.",
  "You don't need motivation. You need to start the first set.",
  "Strong is built one ordinary day at a time.",
  "The hardest part is walking in. You've done harder things.",
  "Small weights, done consistently, beat big plans done never.",
  "Today's workout is a vote for the person you're becoming.",
  "Discipline is remembering what you want most.",
  "Tired is temporary. Skipping lasts longer.",
  "One good session can turn the whole day around.",
  "You won't always feel like it. Go anyway.",
  "Progress hides in the sessions you almost skipped.",
  "Lift the weight, not the excuses.",
  "Every rep is a deposit. Keep investing.",
  "Your body keeps score of the days you show up.",
  "Do it for the version of you that finishes the program.",
  "Consistency beats intensity, and you can have both.",
  "Make today's set better than yesterday's, even by one rep.",
  "Start where you are. Use what you have. Do what you can.",
  "The plan works when you work the plan.",
  "Earn the rest day.",
  "A short workout still counts. Zero doesn't.",
  "Be stubborn about the goal and flexible about the method.",
  "You're one workout away from a better mood.",
  "Breathe, brace, lift. Repeat until strong.",
  "Nobody regrets the workout once it's done.",
  "Build the habit first. The results follow.",
  "Show your excuses the door and your shoes the floor.",
  "Strength is a skill. Practise it today.",
  "Trust the process, and log the process.",
  "Your only competition is last week's you.",
  "Hard days build strong people.",
  "Ten minutes of warm-up beats ten days of injury.",
  "Train like the next rep matters, because it does.",
  "You made a plan for a reason. Honour it today.",
  "Motivation gets you started. Routine keeps you going.",
  "The weights don't care about your mood. Lift anyway.",
  "Keep the promise you made to yourself.",
  "Little by little, then all at once.",
  "Momentum loves a streak. Don't break it.",
  "Finish strong. Then rest like you earned it.",
];

/** Same quote for the same date everywhere (app + notification). */
export function quoteForDate(isoDate: string): string {
  const [y, m, d] = isoDate.split("-").map(Number) as [number, number, number];
  const day = Math.floor(Date.UTC(y, m - 1, d) / 86400000);
  return QUOTES[((day % QUOTES.length) + QUOTES.length) % QUOTES.length]!;
}

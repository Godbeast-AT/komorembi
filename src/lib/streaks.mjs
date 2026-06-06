import { TIMELINE_PROMPT_DAYS } from "./canvas2Contracts.mjs";

export const STREAK_TIME_ZONE = "Asia/Kolkata";

export function toIstDateKey(input) {
  const date = input instanceof Date ? input : new Date(input);
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: STREAK_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

function previousDateKey(dateKey) {
  const [year, month, day] = dateKey.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  date.setUTCDate(date.getUTCDate() - 1);
  return date.toISOString().slice(0, 10);
}

export function countMutualDailyStreak(dayRows, endingDateKey) {
  const qualifyingDays = new Set(
    dayRows
      .filter((row) => Boolean(row.user1Sent) && Boolean(row.user2Sent))
      .map((row) => row.dateKey),
  );

  let streak = 0;
  let cursor = endingDateKey;
  while (qualifyingDays.has(cursor)) {
    streak += 1;
    cursor = previousDateKey(cursor);
  }
  return streak;
}

export function nextMeetPromptDay(currentPromptDay) {
  const day = Number(currentPromptDay) || 0;
  if (day < 7) return 7;
  if (day < 14) return 14;
  if (day < 30) return 30;
  return day + 30;
}

export function resolveTimelinePromptDay(timelinePreference) {
  const value = String(timelinePreference || "one_week").trim().toLowerCase();
  return TIMELINE_PROMPT_DAYS[value] || TIMELINE_PROMPT_DAYS.one_week;
}

export function resolveConversationPromptDay(user1TimelinePreference, user2TimelinePreference) {
  return Math.min(
    resolveTimelinePromptDay(user1TimelinePreference),
    resolveTimelinePromptDay(user2TimelinePreference),
  );
}

export function resolveMeetPromptOutcome(user1Response, user2Response, currentPromptDay = 7) {
  if (!user1Response || !user2Response) return { status: "waiting" };
  if (user1Response === "yes" && user2Response === "yes") {
    return { status: "both_yes", planningBannerDays: 7 };
  }
  if (user1Response === "yes" || user2Response === "yes") {
    return { status: "one_yes", privateNoteFor: user1Response === "yes" ? "user1" : "user2" };
  }
  return { status: "keep_chatting", nextPromptDay: nextMeetPromptDay(currentPromptDay) };
}

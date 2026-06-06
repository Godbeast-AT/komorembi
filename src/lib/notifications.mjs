export const NOTIFICATION_TIME_ZONE = "Asia/Kolkata";

export const DEFAULT_MVP_NOTIFICATION_PREFERENCES = Object.freeze({
  messages: true,
  streaks: true,
  waitlist: true,
  app_updates: true,
  quiet_hours_enabled: true,
});

export function canDisableNotificationCategory(category) {
  return category !== "account_security";
}

export function normalizeMvpNotificationPreferences(preferences) {
  const normalized = { ...DEFAULT_MVP_NOTIFICATION_PREFERENCES };
  if (!preferences || typeof preferences !== "object") return normalized;

  for (const key of Object.keys(DEFAULT_MVP_NOTIFICATION_PREFERENCES)) {
    if (typeof preferences[key] === "boolean") normalized[key] = preferences[key];
  }

  return normalized;
}

export function shouldDeliverNotificationCategory(category, preferences = {}) {
  if (!canDisableNotificationCategory(category)) return true;
  const normalized = normalizeMvpNotificationPreferences(preferences);
  return normalized[category] !== false;
}

export function getIstHour(input) {
  const date = input instanceof Date ? input : new Date(input);
  const hour = new Intl.DateTimeFormat("en-US", {
    timeZone: NOTIFICATION_TIME_ZONE,
    hour: "2-digit",
    hourCycle: "h23",
  }).format(date);
  return Number(hour);
}

export function isQuietHourIst(input, preferences = {}) {
  const normalized = normalizeMvpNotificationPreferences(preferences);
  if (!normalized.quiet_hours_enabled) return false;
  const hour = getIstHour(input);
  return hour >= 23 || hour < 8;
}

export function canSendWithinHourlyCap(sentInLastHour, pendingIndex) {
  return Number(sentInLastHour) + Number(pendingIndex) <= 3;
}

export const USERNAME_CHANGE_COOLDOWN_DAYS = 30;
export const CITY_CHANGE_DELAY_HOURS = 1;
export const MIN_EDITABLE_PROFILE_PHOTOS = 2;

export const SENSITIVE_PROFILE_FIELDS = Object.freeze([
  "intention",
  "gender",
  "gender_preference",
]);

export function isSensitiveProfileField(field) {
  return SENSITIVE_PROFILE_FIELDS.includes(String(field || ""));
}

export function calculateCompletenessScore({ bio = "", photos = [], city = "" }) {
  const photoCount = Array.isArray(photos) ? photos.filter(Boolean).slice(0, 6).length : 0;
  return Math.min(
    100,
    (String(bio).trim() ? 20 : 0) +
      Math.min(photoCount, 6) * 10 +
      (String(city).trim() ? 20 : 0) +
      (photoCount >= MIN_EDITABLE_PROFILE_PHOTOS ? 20 : 0),
  );
}

export function canChangeUsername(lastChangedAt, now = new Date()) {
  if (!lastChangedAt) return true;
  const lastChangedMs = new Date(lastChangedAt).getTime();
  if (!Number.isFinite(lastChangedMs)) return true;
  const cooldownMs = USERNAME_CHANGE_COOLDOWN_DAYS * 24 * 60 * 60 * 1000;
  return now.getTime() - lastChangedMs >= cooldownMs;
}

export function cityChangeEffectiveAt(now = new Date()) {
  return new Date(now.getTime() + CITY_CHANGE_DELAY_HOURS * 60 * 60 * 1000);
}

export function canDeleteProfilePhoto(photos) {
  const photoCount = Array.isArray(photos) ? photos.filter(Boolean).length : 0;
  return photoCount > MIN_EDITABLE_PROFILE_PHOTOS;
}

export function normalizeSensitiveFieldValue(field, value) {
  const normalized = String(value || "").trim().toLowerCase().replace(/\s+/g, "_").replace(/-/g, "_");
  if (field === "gender_preference") {
    if (normalized === "men" || normalized === "man") return "men";
    if (normalized === "women" || normalized === "woman") return "women";
    if (normalized === "everyone" || normalized === "all") return "everyone";
  }
  if (field === "gender") {
    if (normalized === "non_binary" || normalized === "nonbinary") return "non_binary";
    if (normalized === "man" || normalized === "woman") return normalized;
  }
  if (field === "intention") {
    if (normalized === "long_term" || normalized === "short_term") return normalized;
  }
  return normalized;
}

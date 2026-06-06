import { calculateAge } from "./onboardingProfile.mjs";
import { normalizeDatingPreference } from "./canvas2Contracts.mjs";

export const WAITLIST_CAP_RATIO = 1.3;
export const WAITLIST_REFERRAL_BOOST = 5;
export const WAITLIST_PREVIEW_ALLOWED_KEYS = new Set([
  "label",
  "age_bucket",
  "city",
  "intention",
]);

export function isMaleGender(gender) {
  return ["male", "man", "men"].includes(String(gender || "").trim().toLowerCase());
}

export function isFemaleGender(gender) {
  return ["female", "woman", "women"].includes(String(gender || "").trim().toLowerCase());
}

export function preferenceDemandWeight(preference, pool) {
  const normalized = normalizeDatingPreference(preference);
  if (normalized === "everyone") return 0.5;
  if (pool === "female_seekers") return normalized === "women" ? 1 : 0;
  if (pool === "male_seekers") return normalized === "men" ? 1 : 0;
  throw new Error("invalid_preference_pool");
}

export function shouldWaitlistPreferenceSeeker({
  genderPreference,
  femaleSeekers,
  maleSeekers,
}) {
  const preference = normalizeDatingPreference(genderPreference);
  const incomingFemaleWeight = preferenceDemandWeight(preference, "female_seekers");
  if (incomingFemaleWeight === 0) return false;

  const safeFemaleSeekers = Math.max(0, Number(femaleSeekers) || 0);
  const safeMaleSeekers = Math.max(0, Number(maleSeekers) || 0);

  return (safeFemaleSeekers + incomingFemaleWeight) / Math.max(safeMaleSeekers, 1) > WAITLIST_CAP_RATIO;
}

export function shouldWaitlistNewMale({ gender, maleCount, femaleCount }) {
  if (!isMaleGender(gender)) return false;
  const safeMaleCount = Math.max(0, Number(maleCount) || 0);
  const safeFemaleCount = Math.max(0, Number(femaleCount) || 0);

  return (safeMaleCount + 1) / Math.max(safeFemaleCount, 1) > WAITLIST_CAP_RATIO;
}

export function ageBucketFromBirthDate(birthDate, today = new Date()) {
  const age = calculateAge(birthDate, today);
  if (age < 20) return "18-19";
  if (age < 30) return "20s";
  if (age < 40) return "30s";
  if (age < 50) return "40s";
  return "50+";
}

export function redactWaitlistPreviewCard(profile, today = new Date()) {
  return {
    label: "Someone nearby",
    age_bucket: profile?.age_bucket || ageBucketFromBirthDate(profile?.date_of_birth, today),
    city: String(profile?.city || ""),
    intention: String(profile?.intention || ""),
  };
}

export function assertWaitlistPreviewIsRedacted(card) {
  const leakedKey = Object.keys(card || {}).find((key) => !WAITLIST_PREVIEW_ALLOWED_KEYS.has(key));
  if (leakedKey) throw new Error(`waitlist_preview_leaked_${leakedKey}`);
  if (card?.label && card.label !== "Someone nearby") {
    throw new Error("waitlist_preview_leaked_name");
  }
  return true;
}

export function applyReferralAcceleration(queuePosition, boost = WAITLIST_REFERRAL_BOOST) {
  return Math.max(1, Number(queuePosition) - boost);
}

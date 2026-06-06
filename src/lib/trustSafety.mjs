import { REPORT_REASONS_MVP } from "./mvpContracts.mjs";

export const REPORT_DETAILS_MAX_LENGTH = 300;

export const REPORT_REASON_LABELS = Object.freeze({
  fake_profile: "Fake profile",
  harassment: "Harassment",
  inappropriate_photos: "Inappropriate photos",
  scammer: "Scammer",
  underage_user: "Underage user",
  other: "Other",
});

export const REPORT_REASONS = Object.freeze([...REPORT_REASONS_MVP]);

export const REPORT_REASON_OPTIONS = Object.freeze(
  REPORT_REASONS.map((value) => ({
    value,
    label: REPORT_REASON_LABELS[value] || value,
  })),
);

export function isReportReason(reason) {
  return REPORT_REASONS.includes(String(reason || ""));
}

export function getReportReasonLabel(reason) {
  return REPORT_REASON_LABELS[reason] || "Other";
}

export function normalizeReportDetails(details) {
  if (typeof details !== "string") return null;
  const trimmed = details.trim();
  if (!trimmed) return null;
  return trimmed.slice(0, REPORT_DETAILS_MAX_LENGTH);
}

export function isReportDetailsWithinLimit(details) {
  if (details == null) return true;
  return String(details).length <= REPORT_DETAILS_MAX_LENGTH;
}

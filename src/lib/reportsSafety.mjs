export const SUPPORT_EMAIL = "support@komorembi.app";

export const APPEAL_COMBINED_MAX_LENGTH = 500;

export const REPORT_SUBMISSION_CONFIRMATION =
  "Thank you for helping keep our community safe. We take every report seriously and will review this within 24 hours. We may not be able to share specific details about the action we took, but we act on every report we receive.";

export const REPORT_ACTION_FOLLOW_UP =
  "An account you reported has been reviewed and action has been taken. Thank you for helping keep the community safe.";

export const APPEAL_OVERTURNED_COPY =
  "We reviewed your appeal and have reinstated your account. We apologise for the inconvenience.";

export const APPEAL_UPHELD_COPY =
  `We reviewed your appeal and have determined the suspension was appropriate. If you believe there is additional context we have not considered, please email ${SUPPORT_EMAIL}.`;

export function reportRestrictionForConfirmedCount(count) {
  const confirmed = Number.isFinite(Number(count)) ? Number(count) : 0;
  if (confirmed >= 30) {
    return {
      level: "report_30_permanent",
      kind: "permanent_ban",
      permanentlyBlockPhoneHash: true,
      highRiskFlag: true,
    };
  }
  if (confirmed >= 20) {
    return {
      level: "report_20_7d",
      kind: "temporary_ban",
      durationHours: 24 * 7,
      permanentlyBlockPhoneHash: false,
      highRiskFlag: true,
    };
  }
  if (confirmed >= 5) {
    return {
      level: "report_5_24h",
      kind: "temporary_ban",
      durationHours: 24,
      permanentlyBlockPhoneHash: false,
      highRiskFlag: false,
    };
  }
  return {
    level: "none",
    kind: "none",
    permanentlyBlockPhoneHash: false,
    highRiskFlag: false,
  };
}

export function countUniqueConfirmedReporters(reports) {
  if (!Array.isArray(reports)) return 0;
  const reporters = new Set();

  for (const report of reports) {
    if (!report?.reporter_user_id) continue;
    if (report.status === "dismissed" || report.status === "archived") continue;
    reporters.add(report.reporter_user_id);
  }

  return reporters.size;
}

export function createTemporaryBanMessage(until, supportEmail = SUPPORT_EMAIL) {
  const untilText = until ? new Date(until).toLocaleString() : "[date and time]";
  return `Your account has been temporarily suspended until ${untilText}. This happened because multiple members of our community reported your account. If you believe this is a mistake, you can contact us at ${supportEmail}. Your account will be automatically reinstated after the suspension period.`;
}

export function createPermanentBanMessage(supportEmail = SUPPORT_EMAIL) {
  return `Your account has been permanently suspended due to repeated violations of our community guidelines. This decision was made after multiple reports from community members. If you believe this is a mistake, please contact us at ${supportEmail}.`;
}

export function appealCharacterCount({ whatHappened = "", whyWrong = "" }) {
  return String(whatHappened).length + String(whyWrong).length;
}

export function canSubmitAppeal(input) {
  return appealCharacterCount(input) <= APPEAL_COMBINED_MAX_LENGTH &&
    String(input?.whatHappened || "").trim().length > 0 &&
    String(input?.whyWrong || "").trim().length > 0;
}

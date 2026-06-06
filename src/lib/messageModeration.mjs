export const MESSAGE_MODERATION_TIMEOUT_MS = 5000;

export function normalizeModerationVerdict(verdict) {
  const value = String(verdict || "").toLowerCase();
  if (value === "safe" || value === "warn" || value === "block") return value;
  return "block";
}

export function strikeDeltaForVerdict(verdict) {
  const normalized = normalizeModerationVerdict(verdict);
  return normalized === "warn" || normalized === "block" ? 1 : 0;
}

export function verdictDeliversToRecipient(verdict) {
  return normalizeModerationVerdict(verdict) !== "block";
}

export function moderationRestrictionForStrikeCount(strikeCount, now = new Date()) {
  const count = Number(strikeCount) || 0;
  if (count >= 10) return { type: "permanent_ban" };
  if (count >= 8) {
    return {
      type: "message_ban",
      until: new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString(),
    };
  }
  if (count >= 5) {
    return {
      type: "message_ban",
      until: new Date(now.getTime() + 24 * 60 * 60 * 1000).toISOString(),
    };
  }
  if (count >= 3) return { type: "warning" };
  return { type: "none" };
}

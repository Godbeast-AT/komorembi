export const DAILY_MESSAGE_CAP = 10;
export const MESSAGE_MAX_CHARACTERS = 500;
export const PENDING_REPLY_DAYS = 3;
export const EXPIRED_RETRY_DAYS = 7;

export function validateMessageContent(content) {
  const text = String(content || "").trim();
  if (text.length < 1) return { ok: false, reason: "empty" };
  if (text.length > MESSAGE_MAX_CHARACTERS) return { ok: false, reason: "too_long" };
  return { ok: true, text };
}

export function canSendToday(messagesSentToday) {
  return Number(messagesSentToday) < DAILY_MESSAGE_CAP;
}

export function canRetryExpiredConversation(expiredAt, now = new Date()) {
  if (!expiredAt) return true;
  const retryAt = new Date(expiredAt).getTime() + EXPIRED_RETRY_DAYS * 24 * 60 * 60 * 1000;
  return now.getTime() >= retryAt;
}

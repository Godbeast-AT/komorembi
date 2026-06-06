const INDIAN_LOCAL_PHONE_LENGTH = 10;
const SOFT_DELETE_GRACE_DAYS = 14;

export function normalizePhoneNumber(input) {
  if (typeof input !== "string") return "";

  let digits = input.replace(/\D/g, "");
  if (digits.startsWith("00")) {
    digits = digits.slice(2);
  }
  if (digits.startsWith("91") && digits.length === 12) {
    return `+${digits}`;
  }
  if (digits.length === INDIAN_LOCAL_PHONE_LENGTH && /^[6-9]/.test(digits)) {
    return `+91${digits}`;
  }

  return "";
}

export function isSixDigitOtp(token) {
  return typeof token === "string" && /^\d{6}$/.test(token);
}

export function buildPhoneOtpRequest(phoneInput) {
  const phone = normalizePhoneNumber(phoneInput);
  if (!phone) {
    throw new Error("invalid_phone_number");
  }

  return { phone };
}

export function buildPhoneOtpVerification(phoneInput, tokenInput) {
  const phone = normalizePhoneNumber(phoneInput);
  const token = typeof tokenInput === "string" ? tokenInput.trim() : "";

  if (!phone) {
    throw new Error("invalid_phone_number");
  }
  if (!isSixDigitOtp(token)) {
    throw new Error("invalid_otp");
  }

  return {
    phone,
    token,
    type: "sms",
  };
}

export async function hashPhoneNumberForAppTables(phoneInput) {
  const phone = normalizePhoneNumber(phoneInput);
  if (!phone) {
    throw new Error("invalid_phone_number");
  }
  if (!globalThis.crypto?.subtle) {
    throw new Error("crypto_subtle_unavailable");
  }

  const digest = await globalThis.crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(phone),
  );

  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

export function normalizeContactIdentifier({ type, value }) {
  const contactType = String(type || "").trim().toLowerCase();
  if (contactType === "phone") {
    const normalized = normalizePhoneNumber(value);
    if (!normalized) throw new Error("invalid_phone_number");
    return { type: "phone", normalized };
  }

  if (contactType === "email") {
    const normalized = String(value || "").trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized)) {
      throw new Error("invalid_email");
    }
    return { type: "email", normalized };
  }

  throw new Error("invalid_contact_type");
}

export async function hashContactIdentifierForAppTables(contact) {
  const { type, normalized } = normalizeContactIdentifier(contact);
  if (!globalThis.crypto?.subtle) {
    throw new Error("crypto_subtle_unavailable");
  }

  const digest = await globalThis.crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(`${type}:${normalized}`),
  );

  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

export function buildGoogleOAuthSignInPayload(redirectTo) {
  return {
    provider: "google",
    options: {
      redirectTo,
    },
  };
}

export function buildAuthIdentityMergePlan({
  primaryUserId,
  duplicateUserId,
  primaryWaitlistPosition = null,
  duplicateWaitlistPosition = null,
}) {
  const positions = [primaryWaitlistPosition, duplicateWaitlistPosition]
    .map((position) => Number(position))
    .filter((position) => Number.isFinite(position) && position > 0);
  const waitlistPositionToKeep = positions.length > 0 ? Math.min(...positions) : null;
  const retiredWaitlistPosition = positions.length > 1 ? Math.max(...positions) : null;

  return {
    primary_user_id: primaryUserId,
    duplicate_user_id: duplicateUserId,
    waitlist_position_to_keep: waitlistPositionToKeep,
    retired_waitlist_position: retiredWaitlistPosition,
    merge_steps: [
      "merge_profile",
      "merge_sessions",
      "merge_photos",
      "merge_waitlist_entry",
      "merge_conversations",
      "merge_reports",
    ],
  };
}

export function buildDeviceSessionPayload({
  userId,
  deviceId,
  platform = "web",
  now = new Date().toISOString(),
}) {
  return {
    user_id: userId,
    device_id: deviceId,
    platform,
    last_seen_at: now,
    revoked_at: null,
  };
}

export function createSoftDeletionPlan({
  userId,
  peerId,
  requestedAt = new Date().toISOString(),
}) {
  const requestedDate = new Date(requestedAt);
  const purgeDate = new Date(requestedDate.getTime());
  purgeDate.setUTCDate(purgeDate.getUTCDate() + SOFT_DELETE_GRACE_DAYS);

  return {
    user_id: userId,
    peer_id: peerId,
    requested_at: requestedDate.toISOString(),
    purge_after: purgeDate.toISOString(),
    status: "pending_grace_period",
    immediate_actions: [
      "close_active_conversations",
      "hide_profile_from_feed",
      "delete_profile_photos",
      "anonymize_sender_display",
    ],
  };
}

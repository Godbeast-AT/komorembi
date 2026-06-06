export const MAX_PROFILE_PHOTOS = 6;
export const REQUIRED_PROFILE_PHOTOS = 2;

function parseBirthDate(dateString) {
  if (typeof dateString !== "string") return null;

  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateString);
  if (!match) return null;

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const parsed = new Date(Date.UTC(year, month - 1, day));

  if (
    parsed.getUTCFullYear() !== year ||
    parsed.getUTCMonth() !== month - 1 ||
    parsed.getUTCDate() !== day
  ) {
    return null;
  }

  return { year, month, day };
}

function photoToPath(photo) {
  if (typeof photo === "string") return photo.trim();
  if (photo && typeof photo.name === "string") throw new Error("unprocessed_photo");
  return "";
}

export function calculateAge(dateString, today = new Date()) {
  const birthDate = parseBirthDate(dateString);
  if (!birthDate) return 0;

  let age = today.getFullYear() - birthDate.year;
  const currentMonth = today.getMonth() + 1;
  const currentDay = today.getDate();

  if (
    currentMonth < birthDate.month ||
    (currentMonth === birthDate.month && currentDay < birthDate.day)
  ) {
    age -= 1;
  }

  return age;
}

export function canCompleteAgeGate(dateString, today = new Date()) {
  return calculateAge(dateString, today) >= 18;
}

export function hasRequiredPhotos(photos) {
  const populated = photos.filter(Boolean);
  return populated.length >= REQUIRED_PROFILE_PHOTOS && populated.length <= MAX_PROFILE_PHOTOS;
}

export function validateUsername(username, bannedWords = []) {
  if (typeof username !== "string") return { status: "invalid" };

  const normalized = username.trim().toLowerCase();
  if (!/^[a-z][a-z0-9_]{2,19}$/.test(normalized)) {
    return { status: "invalid" };
  }

  const banned = new Set(bannedWords.map((word) => String(word).trim().toLowerCase()));
  if (banned.has(normalized)) {
    return { status: "banned" };
  }

  return {
    status: "valid",
    username: normalized,
  };
}

export function buildCompleteOnboardingPayload({
  peerId,
  username,
  displayName,
  birthDate,
  gender,
  genderPreference,
  intention,
  city,
  state,
  bio = "",
  photos,
}) {
  const usernameResult = validateUsername(username);
  if (usernameResult.status !== "valid") {
    throw new Error("invalid_username");
  }
  if (!canCompleteAgeGate(birthDate)) {
    throw new Error("underage");
  }
  if (!hasRequiredPhotos(photos)) {
    throw new Error("insufficient_photos");
  }

  return {
    p_peer_id: peerId,
    p_username: usernameResult.username,
    p_display_name: displayName.trim(),
    p_date_of_birth: birthDate,
    p_gender: gender.trim(),
    p_gender_preference: genderPreference.trim(),
    p_intention: intention.trim(),
    p_city: city.trim(),
    p_state: state.trim(),
    p_bio: bio,
    p_photo_paths: photos
      .map(photoToPath)
      .filter((photo) => photo.length > 0)
      .slice(0, MAX_PROFILE_PHOTOS),
  };
}

export function buildProfileInsertPayload({
  peerId,
  userId,
  displayName,
  birthDate,
  gender,
  photos,
  interests = [],
  bio = "",
  createdAt = new Date().toISOString(),
}) {
  return {
    peer_id: peerId,
    user_id: userId,
    display_name: displayName.trim(),
    birth_date: birthDate,
    gender: gender.trim(),
    photos: photos.slice(0, MAX_PROFILE_PHOTOS),
    interests: interests ?? [],
    bio,
    trust_score: 100,
    created_at: createdAt,
  };
}

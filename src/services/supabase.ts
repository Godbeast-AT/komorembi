import { createClient } from "@supabase/supabase-js";
import {
  buildGoogleOAuthSignInPayload,
  hashContactIdentifierForAppTables,
  hashPhoneNumberForAppTables,
} from "@/lib/authLifecycle.mjs";
import { buildCompleteOnboardingPayload, validateUsername } from "@/lib/onboardingProfile.mjs";
import {
  buildInterestReminderNotification,
  normalizeHobbySelections,
  normalizeMovieSelections,
  normalizeMusicSelections,
} from "@/lib/canvas2Interests.mjs";
import { buildAiEnhancementRequest } from "@/lib/canvas2Premium.mjs";
import {
  DISCOVERY_PAGE_SIZE,
  DEFAULT_FEED_FILTERS,
  normalizeFeedFilters,
  sanitizeDiscoveryProfile,
} from "@/lib/discoveryFeed.mjs";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://placeholder-url.supabase.co";
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "placeholder-key";

export const supabase = createClient(supabaseUrl, supabaseKey);

export async function signInWithGoogle() {
  const redirectTo = process.env.NEXT_PUBLIC_AUTH_REDIRECT_URL || `${globalThis.location?.origin || ""}/auth/callback`;
  const googlePayload = {
    ...buildGoogleOAuthSignInPayload(redirectTo),
    provider: "google" as const,
  };
  const { data, error } = await supabase.auth.signInWithOAuth(googlePayload);

  if (error) throw error;
  return data;
}

export async function upsertCurrentUserAuthRecord({
  userId,
  phone,
  email,
}: {
  userId: string;
  phone?: string;
  email?: string;
}) {
  const phone_hash = phone ? await hashPhoneNumberForAppTables(phone) : null;
  const contact_hash = await hashContactIdentifierForAppTables(
    email
      ? { type: "email", value: email }
      : { type: "phone", value: phone || "" },
  );

  const { error } = await supabase
    .from("user_auth_records")
    .upsert(
      {
        user_id: userId,
        phone_hash,
        contact_hash,
      },
      { onConflict: "user_id" },
    );

  if (error) throw error;
}

export async function recordCurrentDeviceSession(deviceId: string, platform = "web") {
  const { error } = await supabase.rpc("record_device_session", {
    p_device_id: deviceId,
    p_platform: platform,
  });

  if (error) throw error;
}

export async function invalidateAllDeviceSessions() {
  const { error } = await supabase.rpc("invalidate_all_sessions");
  if (error) throw error;
  await supabase.auth.signOut({ scope: "global" });
}

export async function requestSoftAccountDeletion(peerId?: string | null) {
  const { error } = await supabase.rpc("request_account_deletion", {
    p_peer_id: peerId || null,
  });

  if (error) throw error;
  await supabase.auth.signOut({ scope: "global" });
}

export type UsernameAvailability = "checking" | "available" | "taken" | "invalid" | "banned";

export async function checkUsernameAvailability(username: string): Promise<UsernameAvailability> {
  const localValidation = validateUsername(username);
  if (localValidation.status === "invalid") return "invalid";

  const { data, error } = await supabase.rpc("check_username_availability", {
    p_username: username,
  });
  if (error) throw error;

  const status = typeof data === "object" && data && "status" in data
    ? String((data as { status: string }).status)
    : "taken";

  if (status === "available" || status === "taken" || status === "invalid" || status === "banned") {
    return status;
  }

  return "taken";
}

export async function loadOnboardingProgress(userId: string) {
  const { data, error } = await supabase
    .from("onboarding_progress")
    .select("current_step, completed_steps, draft_profile")
    .eq("user_id", userId)
    .maybeSingle();

  if (error) throw error;
  return data;
}

export async function saveOnboardingProgress({
  userId,
  currentStep,
  draftProfile,
}: {
  userId: string;
  currentStep: string;
  draftProfile: Record<string, unknown>;
}) {
  const { error } = await supabase
    .from("onboarding_progress")
    .upsert(
      {
        user_id: userId,
        current_step: currentStep,
        draft_profile: draftProfile,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id" },
    );

  if (error) throw error;
}

export type MediaInterestSelection = {
  provider?: string;
  provider_id: string;
  title?: string;
  name?: string;
  year?: number | null;
  genre?: string | null;
  poster_url?: string | null;
  image_url?: string | null;
};

export async function searchMovieInterests(query: string) {
  const { data, error } = await supabase.functions.invoke("search-movies", {
    body: { query },
  });

  if (error) throw error;
  return data;
}

export async function searchMusicInterests(query: string) {
  const { data, error } = await supabase.functions.invoke("search-music", {
    body: { query },
  });

  if (error) throw error;
  return data;
}

export async function saveProfileInterests({
  hobbies,
  movies,
  musicArtists,
}: {
  hobbies: string[];
  movies: MediaInterestSelection[];
  musicArtists: MediaInterestSelection[];
}) {
  const { data, error } = await supabase.rpc("save_profile_interests", {
    p_hobbies: normalizeHobbySelections(hobbies),
    p_movies: normalizeMovieSelections(movies),
    p_music_artists: normalizeMusicSelections(musicArtists),
  });

  if (error) throw error;
  return data;
}

export async function setTimelinePreference(timelinePreference: string) {
  const { data, error } = await supabase.rpc("set_timeline_preference", {
    p_timeline_preference: timelinePreference,
  });

  if (error) throw error;
  return data;
}

export async function queueOnboardingInterestReminder({
  userId,
  signupCompletedAt,
  skippedMovies,
  skippedMusic,
}: {
  userId: string;
  signupCompletedAt: string;
  skippedMovies: boolean;
  skippedMusic: boolean;
}) {
  const event = buildInterestReminderNotification({
    userId,
    signupCompletedAt,
    skippedMovies,
    skippedMusic,
  });
  const eventType = "onboarding_interest_reminder";
  const { error } = await supabase.from("notifications").insert({
    user_id: event.user_id,
    category: event.category,
    event_type: eventType,
    title: "Add movies and music",
    body: "Add movies or music to make your profile easier to start a conversation from.",
    payload: event.payload,
    send_after: event.scheduled_for,
  });

  if (error) throw error;
}

export type ProcessedProfilePhoto = {
  image_path: string;
  thumbnail_path: string;
  moderation_status: "approved" | "held";
  verified_camera: boolean;
};

export type DatingMode = "long_term" | "short_term";

export type WaitlistPreviewCard = {
  label: string;
  age_bucket: string;
  city: string;
  intention: string;
  dating_mode?: "long_term" | "short_term";
};

export type CompletedProfileResult = {
  peer_id: string;
  is_waitlisted: boolean;
  dating_mode?: "long_term" | "short_term";
};

export type OwnWaitlistEntry = {
  queue_position: number;
  status: "waiting" | "admitted" | "left";
  dating_mode?: "long_term" | "short_term";
};

export type FeedFilters = typeof DEFAULT_FEED_FILTERS;

export type DiscoveryProfile = {
  peer_id: string;
  display_name: string;
  dating_mode?: "long_term" | "short_term";
  birth_date?: string | null;
  city?: string;
  photos?: string[];
  profile_prompt?: string;
  bio?: string;
  last_seen_at?: string | null;
  created_at?: string | null;
};

function isProfilePhotoFile(photo: unknown): photo is File {
  return typeof File !== "undefined" && photo instanceof File;
}

export async function processProfilePhotoUpload({
  photo,
  slot,
  source = "gallery",
  photoRejectionsThisSession = 0,
}: {
  photo: File;
  slot: number;
  source?: "gallery" | "native_camera";
  photoRejectionsThisSession?: number;
}): Promise<ProcessedProfilePhoto> {
  const formData = new FormData();
  formData.set("file", photo);
  formData.set("slot", String(slot));
  formData.set("source", source);
  formData.set("photo_rejections_this_session", String(photoRejectionsThisSession));

  const { data, error } = await supabase.functions.invoke("process-photo", {
    body: formData,
  });

  if (error) throw error;
  if (!data || typeof data !== "object" || "error" in data) {
    throw new Error(String((data as { error?: unknown } | null)?.error || "Photo processing failed."));
  }

  const photoData = data as Partial<ProcessedProfilePhoto>;
  if (!photoData.image_path || !photoData.thumbnail_path || !photoData.moderation_status) {
    throw new Error("Photo processing returned an invalid response.");
  }

  return {
    image_path: photoData.image_path,
    thumbnail_path: photoData.thumbnail_path,
    moderation_status: photoData.moderation_status,
    verified_camera: Boolean(photoData.verified_camera),
  };
}

export async function processProfilePhotos(photos: unknown[]) {
  const processedPhotoPaths: string[] = [];

  for (let index = 0; index < photos.slice(0, 6).length; index += 1) {
    const photo = photos[index];
    if (typeof photo === "string" && photo.trim()) {
      processedPhotoPaths.push(photo.trim());
      continue;
    }

    if (isProfilePhotoFile(photo)) {
      const processed = await processProfilePhotoUpload({
        photo,
        slot: index + 1,
      });
      processedPhotoPaths.push(processed.image_path);
    }
  }

  return processedPhotoPaths;
}

export async function discoverWaitlistPreview(
  limit = 20,
  datingMode?: "long_term" | "short_term",
): Promise<WaitlistPreviewCard[]> {
  const { data, error } = await supabase.rpc("discover_waitlist_preview", {
    p_limit: limit,
    p_dating_mode: datingMode,
  });

  if (error) throw error;
  if (!Array.isArray(data)) return [];

  return data.map((card: Record<string, unknown>) => ({
    label: "Someone nearby",
    age_bucket: String(card.age_bucket || ""),
    city: String(card.city || ""),
    intention: String(card.intention || ""),
    dating_mode: (card.intention === "short_term" ? "short_term" : "long_term") as DatingMode,
  }));
}

export async function loadOwnWaitlistEntry(
  datingMode: DatingMode = "long_term",
): Promise<OwnWaitlistEntry | null> {
  const { data, error } = await supabase
    .from("waitlist_entries")
    .select("queue_position, status, dating_mode")
    .eq("dating_mode", datingMode)
    .eq("status", "waiting")
    .maybeSingle();

  if (error) throw error;
  return data as OwnWaitlistEntry | null;
}

export async function leaveWaitlist() {
  const { error } = await supabase.rpc("leave_waitlist");
  if (error) throw error;
}

export async function loadFeedFilters(datingMode: DatingMode = "long_term"): Promise<FeedFilters> {
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) return DEFAULT_FEED_FILTERS;

  const { data, error } = await supabase
    .from("feed_filters")
    .select("min_age, max_age, city")
    .eq("user_id", userData.user.id)
    .eq("dating_mode", datingMode)
    .maybeSingle();

  if (error) throw error;
  if (!data) return DEFAULT_FEED_FILTERS;

  return normalizeFeedFilters({
    minAge: data.min_age,
    maxAge: data.max_age,
    city: data.city,
  });
}

export async function saveFeedFilters(filters: FeedFilters, datingMode: DatingMode = "long_term"): Promise<FeedFilters> {
  const normalized = normalizeFeedFilters(filters);
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) return normalized;

  const { error } = await supabase
    .from("feed_filters")
    .upsert(
      {
        user_id: userData.user.id,
        dating_mode: datingMode,
        min_age: normalized.minAge,
        max_age: normalized.maxAge,
        city: normalized.city || null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id,dating_mode" },
    );

  if (error) throw error;
  return normalized;
}

export async function discoverProfiles({
  filters = DEFAULT_FEED_FILTERS,
  sessionId,
  limit = DISCOVERY_PAGE_SIZE,
  datingMode,
}: {
  filters?: FeedFilters;
  sessionId: string;
  limit?: number;
  datingMode?: "long_term" | "short_term";
}): Promise<DiscoveryProfile[]> {
  const normalized = normalizeFeedFilters(filters);
  const { data, error } = await supabase.rpc("discover_profiles", {
    p_limit: limit,
    p_city: normalized.city || null,
    p_min_age: normalized.minAge,
    p_max_age: normalized.maxAge,
    p_session_id: sessionId,
    p_dating_mode: datingMode,
  });

  if (error) throw error;
  if (!Array.isArray(data)) return [];

  return data.map((row) => {
    const profile = sanitizeDiscoveryProfile(row) as DiscoveryProfile;
    return {
      ...profile,
      bio: profile.profile_prompt,
    };
  });
}

export async function sendOpeningMessage(peerId: string, content: string) {
  const { data, error } = await supabase.rpc("send_opening_message", {
    p_recipient_peer_id: peerId,
    p_content: content,
  });

  if (error) throw error;
  return data;
}

export async function sendChatMessage(conversationId: string, content: string) {
  const { data, error } = await supabase.rpc("send_chat_message", {
    p_conversation_id: conversationId,
    p_content: content,
  });

  if (error) throw error;
  return data;
}

export async function recordMeetPromptResponse(
  conversationId: string,
  response: "yes" | "keep_chatting",
) {
  const { data, error } = await supabase.rpc("record_meet_prompt_response", {
    p_conversation_id: conversationId,
    p_response: response,
  });

  if (error) throw error;
  return data;
}

export async function enhanceMessageDraft({
  roughIdea,
  senderProfile,
  recipientProfile,
}: {
  roughIdea: string;
  senderProfile: Record<string, unknown>;
  recipientProfile: Record<string, unknown>;
}) {
  const { data, error } = await supabase.functions.invoke("enhance-message", {
    body: buildAiEnhancementRequest({
      roughIdea,
      senderProfile,
      recipientProfile,
    }),
  });

  if (error) throw error;
  return data;
}

export async function createPremiumCheckoutSession() {
  const { data, error } = await supabase.rpc("create_premium_checkout_session");
  if (error) throw error;
  return data;
}

export async function recordProfileView(viewedPeerId: string) {
  const { data, error } = await supabase.rpc("record_profile_view", {
    p_viewed_peer_id: viewedPeerId,
  });

  if (error) throw error;
  return data;
}

export async function getProfileViewers() {
  const { data, error } = await supabase.rpc("get_profile_viewers");
  if (error) throw error;
  return data || [];
}

export async function blockUser(blockedPeerId: string) {
  const { data, error } = await supabase.rpc("block_user", {
    p_blocked_peer_id: blockedPeerId,
  });

  if (error) throw error;
  return data;
}

export async function unblockUser(blockedPeerId: string) {
  const { data, error } = await supabase.rpc("unblock_user", {
    p_blocked_peer_id: blockedPeerId,
  });

  if (error) throw error;
  return data;
}

export async function submitReport({
  reportedPeerId,
  reason,
  details,
}: {
  reportedPeerId: string;
  reason: string;
  details?: string | null;
}) {
  const { data, error } = await supabase.rpc("submit_report", {
    p_reported_peer_id: reportedPeerId,
    p_reason: reason,
    p_details: details || null,
  });

  if (error) throw error;
  return data;
}

export type AccountSafetyStatus = {
  is_banned: boolean;
  flagged_for_review: boolean;
  account_banned_until?: string | null;
  ban_level?: string | null;
  ban_reason?: string | null;
};

export async function loadOwnAccountSafetyStatus(): Promise<AccountSafetyStatus | null> {
  const { data, error } = await supabase
    .from("profiles")
    .select("is_banned, flagged_for_review, account_banned_until, ban_level, ban_reason")
    .maybeSingle();

  if (error) throw error;
  return data as AccountSafetyStatus | null;
}

export async function submitAccountAppeal({
  whatHappened,
  whyWrong,
}: {
  whatHappened: string;
  whyWrong: string;
}) {
  const { data, error } = await supabase.rpc("submit_account_appeal", {
    p_what_happened: whatHappened,
    p_why_wrong: whyWrong,
  });

  if (error) throw error;
  return data;
}

export async function submitPreBanContext({
  reportId,
  contextText,
}: {
  reportId?: string | null;
  contextText: string;
}) {
  const { data, error } = await supabase.rpc("submit_pre_ban_context", {
    p_report_id: reportId || null,
    p_context_text: contextText,
  });

  if (error) throw error;
  return data;
}

export async function updateProfilePublicFields({
  bio,
  photos,
  displayPreferences,
  isVisible,
}: {
  bio?: string | null;
  photos?: string[] | null;
  displayPreferences?: Record<string, unknown> | null;
  isVisible?: boolean | null;
}) {
  const { data, error } = await supabase.rpc("update_profile_public_fields", {
    p_bio: bio ?? null,
    p_photo_paths: photos ?? null,
    p_display_preferences: displayPreferences ?? null,
    p_is_visible: isVisible ?? null,
  });

  if (error) throw error;
  return data;
}

export async function changeUsername(username: string) {
  const { data, error } = await supabase.rpc("change_username", {
    p_username: username,
  });

  if (error) throw error;
  return data;
}

export async function requestCityChange(city: string, state?: string | null) {
  const { data, error } = await supabase.rpc("request_city_change", {
    p_city: city,
    p_state: state || null,
  });

  if (error) throw error;
  return data;
}

export async function changeSensitiveProfileField({
  field,
  value,
  warningAcknowledged,
}: {
  field: "intention" | "gender" | "gender_preference";
  value: string;
  warningAcknowledged: boolean;
}) {
  const { data, error } = await supabase.rpc("change_sensitive_profile_field", {
    p_field: field,
    p_value: value,
    p_warning_acknowledged: warningAcknowledged,
  });

  if (error) throw error;
  return data;
}

export async function requestDataExport() {
  const { data, error } = await supabase.rpc("request_data_export");
  if (error) throw error;
  return data;
}

export async function completeOnboardingProfile(input: {
  peerId: string;
  username: string;
  displayName: string;
  birthDate: string;
  gender: string;
  genderPreference: string;
  intention: string;
  city: string;
  state: string;
  bio?: string;
  photos: unknown[];
}) {
  const processedPhotoPaths = await processProfilePhotos(input.photos);
  const payload = buildCompleteOnboardingPayload({
    ...input,
    photos: processedPhotoPaths,
  });
  const { data, error } = await supabase.rpc("complete_onboarding_profile", payload);

  if (error) throw error;
  return data as CompletedProfileResult | null;
}

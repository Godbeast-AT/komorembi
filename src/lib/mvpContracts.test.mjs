import test from "node:test";
import assert from "node:assert/strict";

import {
  CONTRACT_VERSION,
  LEGACY_DELETION_TARGETS,
  WAITLIST_PREVIEW_ALLOWED_KEYS,
  WAITLIST_PREVIEW_FORBIDDEN_KEYS,
  isWaitlistPreviewCardRedacted,
} from "./mvpContracts.mjs";

test("phase 0 contract exposes a stable version", () => {
  assert.equal(CONTRACT_VERSION, "2026-06-04-intention-mvp-phase-0");
});

test("legacy deletion targets include the old live-video and guest/mock architecture", () => {
  assert.deepEqual(LEGACY_DELETION_TARGETS, [
    "src/components/VideoCallRoom.tsx",
    "src/hooks/useWebRTC.ts",
    "src/hooks/useVideoCall.ts",
    "src/components/PermissionView.tsx",
    "peerjs",
    "mock-discovery-fallback",
    "guest-only-flow",
    "waiting_room-live-matching",
    "call-history-active-ui",
  ]);
});

test("waitlist preview contract only allows redacted fields", () => {
  assert.deepEqual(WAITLIST_PREVIEW_ALLOWED_KEYS, [
    "preview_id",
    "label",
    "age_bucket",
    "city",
    "state",
    "intention",
    "card_style",
  ]);
  assert.deepEqual(WAITLIST_PREVIEW_FORBIDDEN_KEYS, [
    "peer_id",
    "user_id",
    "username",
    "display_name",
    "name",
    "bio",
    "prompt_answer",
    "photos",
    "photo_url",
    "avatar_url",
    "exact_age",
    "birth_date",
    "can_open_profile",
    "can_message",
    "can_report",
  ]);
});

test("waitlist preview accepts only server-redacted cards", () => {
  assert.equal(
    isWaitlistPreviewCardRedacted({
      preview_id: "preview-1",
      label: "Someone nearby",
      age_bucket: "20s",
      city: "Indore",
      state: "Madhya Pradesh",
      intention: "long_term",
      card_style: "blurred_preview",
    }),
    true,
  );

  assert.equal(
    isWaitlistPreviewCardRedacted({
      preview_id: "preview-2",
      label: "Someone nearby",
      age_bucket: "20s",
      city: "Indore",
      intention: "long_term",
      card_style: "blurred_preview",
      peer_id: "real-user-id",
    }),
    false,
  );
});

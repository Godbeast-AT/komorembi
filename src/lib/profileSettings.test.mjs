import test from "node:test";
import assert from "node:assert/strict";

import {
  DEFAULT_NOTIFICATION_PREFERENCES,
  BLOCK_LIST_TABLES,
  movePhoto,
  normalizeBlockedAccounts,
  normalizeNotificationPreferences,
  removePhotoAt,
  toPhotoSlots,
} from "./profileSettings.mjs";

test("toPhotoSlots always returns exactly six visible profile slots", () => {
  assert.deepEqual(toPhotoSlots(["a.jpg", "b.jpg"]), [
    "a.jpg",
    "b.jpg",
    null,
    null,
    null,
    null,
  ]);

  assert.deepEqual(toPhotoSlots(["1", "2", "3", "4", "5", "6", "7"]), [
    "1",
    "2",
    "3",
    "4",
    "5",
    "6",
  ]);
});

test("movePhoto reorders populated photos without leaving blank gaps", () => {
  assert.deepEqual(movePhoto(["a.jpg", "b.jpg", "c.jpg"], 0, 2), [
    "b.jpg",
    "c.jpg",
    "a.jpg",
  ]);

  assert.deepEqual(movePhoto(["a.jpg", "b.jpg", "c.jpg"], 2, 0), [
    "c.jpg",
    "a.jpg",
    "b.jpg",
  ]);
});

test("removePhotoAt removes one photo and compacts remaining photos", () => {
  assert.deepEqual(removePhotoAt(["a.jpg", "b.jpg", "c.jpg"], 1), [
    "a.jpg",
    "c.jpg",
  ]);
});

test("normalizeNotificationPreferences fills missing preference switches", () => {
  assert.deepEqual(normalizeNotificationPreferences(undefined), DEFAULT_NOTIFICATION_PREFERENCES);
  assert.deepEqual(normalizeNotificationPreferences({ messages: false, quiet_hours_enabled: false, live_matches: false }), {
    messages: false,
    streaks: true,
    waitlist: true,
    app_updates: true,
    quiet_hours_enabled: false,
  });
});

test("normalizeBlockedAccounts accepts MVP and legacy block row shapes", () => {
  assert.deepEqual(BLOCK_LIST_TABLES, ["blocks", "user_blocks", "blocked_users"]);

  const rows = normalizeBlockedAccounts([
    {
      source_table: "blocks",
      blocker_peer_id: "me",
      blocked_peer_id: "peer-mvp",
      created_at: "2026-06-04T00:00:00.000Z",
      blocked_profile: {
        peer_id: "peer-mvp",
        display_name: "Mira",
        photos: ["mira.jpg"],
      },
    },
    {
      source_table: "user_blocks",
      blocker_peer_id: "me",
      blocked_peer_id: "peer-a",
      created_at: "2026-05-29T00:00:00.000Z",
      blocked_profile: {
        peer_id: "peer-a",
        display_name: "Ari",
        photos: ["ari.jpg"],
      },
    },
    {
      source_table: "blocked_users",
      blocker_peer_id: "me",
      blocked_peer_id: "peer-b",
      profiles: {
        peer_id: "peer-b",
        display_name: "Bo",
        photos: ["bo.jpg"],
      },
    },
  ], "me");

  assert.deepEqual(rows, [
    {
      id: "blocks:me:peer-mvp",
      sourceTable: "blocks",
      blockerPeerId: "me",
      blockedPeerId: "peer-mvp",
      displayName: "Mira",
      photos: ["mira.jpg"],
      createdAt: "2026-06-04T00:00:00.000Z",
    },
    {
      id: "user_blocks:me:peer-a",
      sourceTable: "user_blocks",
      blockerPeerId: "me",
      blockedPeerId: "peer-a",
      displayName: "Ari",
      photos: ["ari.jpg"],
      createdAt: "2026-05-29T00:00:00.000Z",
    },
    {
      id: "blocked_users:me:peer-b",
      sourceTable: "blocked_users",
      blockerPeerId: "me",
      blockedPeerId: "peer-b",
      displayName: "Bo",
      photos: ["bo.jpg"],
      createdAt: undefined,
    },
  ]);
});

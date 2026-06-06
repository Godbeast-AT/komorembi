import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

const ROOT = process.cwd();

function read(path) {
  return readFileSync(join(ROOT, path), "utf8");
}

test("legacy live media modules and PeerJS dependency are removed", () => {
  const deletedPaths = [
    "src/providers/MediaProvider.tsx",
    "src/hooks/useWebRTC.ts",
    "src/hooks/useVideoCall.ts",
    "src/hooks/useMediaPermission.ts",
    "src/components/VideoCallRoom.tsx",
    "src/components/PermissionView.tsx",
    "src/components/SafetyToggle.tsx",
    "src/lib/waitingRoomChannel.js",
  ];

  for (const path of deletedPaths) {
    assert.equal(existsSync(join(ROOT, path)), false, `${path} should stay deleted`);
  }

  const packageJson = read("package.json");
  const packageLock = read("package-lock.json");
  assert.doesNotMatch(packageJson, /"peerjs"/i);
  assert.doesNotMatch(packageLock, /node_modules\/peerjs|"peerjs"/i);
});

test("active app shell no longer imports legacy media or waiting-room runtime", () => {
  const activeFiles = [
    "src/app/layout.tsx",
    "src/app/page.tsx",
    "src/components/DiscoveryFeed.tsx",
    "src/components/ProfileView.tsx",
    "src/components/SettingsView.tsx",
    "src/components/ChatView.tsx",
    "src/components/UserProfileDetail.tsx",
  ];

  const combined = activeFiles.map((path) => read(path)).join("\n");
  assert.doesNotMatch(
    combined,
    /MediaProvider|useWebRTC|useVideoCall|useMediaPermission|VideoCallRoom|PermissionView|waitingRoomChannel|waiting_room|match_by_vibe|ALL_MOCK_PROFILES|vibelink_mock_chats|vibelink_profile_cache|startMatching/i,
  );
});

test("active user-facing policy copy describes the MVP safety model", () => {
  const combined = [
    read("src/components/PrivacyPolicy.tsx"),
    read("src/components/TermsOfService.tsx"),
    read("src/components/SettingsView.tsx"),
  ].join("\n");

  assert.doesNotMatch(combined, /Trust Score|Vector Embeddings|peer-to-peer|P2P|private video calls|live video sessions|Guest accounts/i);
  assert.match(combined, /Messages are reviewed before delivery/i);
  assert.match(combined, /profile is hidden immediately and final purge is scheduled after the 14-day grace period/i);
});

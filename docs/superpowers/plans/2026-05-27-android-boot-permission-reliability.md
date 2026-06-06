# Android Boot And Permission Reliability Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make Android launch resolve quickly, move camera/mic into an explicit early onboarding checkpoint, and allow browsing when media permission is denied while blocking live matching.

**Architecture:** Introduce small readiness helpers plus focused hooks for boot and media permission state, then wire the root page to render from explicit boot and match-readiness state instead of mixed booleans. Keep the current product flow, but make native permission and launch behavior deterministic and testable.

**Tech Stack:** Next.js App Router, React hooks, TypeScript, Capacitor plugins, Supabase, Node `node:test`, ESLint

---

### Task 1: Add readiness and permission tests first

**Files:**
- Create: `src/lib/appReadiness.ts`
- Create: `src/lib/appReadiness.test.mjs`
- Create: `src/lib/notificationPermission.ts`

- [ ] **Step 1: Write the failing readiness tests**

```js
import test from "node:test";
import assert from "node:assert/strict";

import {
  createBootState,
  createMatchReadiness,
  shouldScheduleNotification,
} from "./appReadiness.js";

test("createBootState resolves to limited when native boot work times out", () => {
  assert.deepEqual(
    createBootState({
      authResolved: false,
      guestResolved: true,
      bootTimedOut: true,
      isBanned: false,
    }),
    { bootState: "limited", bootReason: "timeout" },
  );
});

test("createMatchReadiness allows browsing while permission is denied", () => {
  assert.deepEqual(
    createMatchReadiness({
      mediaPermission: "denied",
      hasPeerId: true,
      hasActiveStream: false,
    }),
    {
      mediaPermission: "denied",
      canBrowse: true,
      canMatch: false,
      needsPermissionPrompt: false,
      missingRequirements: ["media_permission"],
    },
  );
});

test("shouldScheduleNotification only returns true for granted display permission", () => {
  assert.equal(shouldScheduleNotification({ display: "granted" }), true);
  assert.equal(shouldScheduleNotification({ display: "denied" }), false);
});
```

- [ ] **Step 2: Run the tests and verify they fail**

Run: `node --test src/lib/appReadiness.test.mjs`
Expected: FAIL because `appReadiness.js` exports do not exist yet

- [ ] **Step 3: Implement the minimal readiness helpers**

```ts
export type MediaPermissionState = "unknown" | "requesting" | "granted" | "denied";

export function createBootState(input: {
  authResolved: boolean;
  guestResolved: boolean;
  bootTimedOut: boolean;
  isBanned: boolean;
}) {
  if (input.isBanned) return { bootState: "blocked" as const, bootReason: "banned" as const };
  if (input.authResolved && input.guestResolved) return { bootState: "ready" as const };
  if (input.bootTimedOut) return { bootState: "limited" as const, bootReason: "timeout" as const };
  return { bootState: "booting" as const };
}

export function createMatchReadiness(input: {
  mediaPermission: MediaPermissionState;
  hasPeerId: boolean;
  hasActiveStream: boolean;
}) {
  const missingRequirements: string[] = [];
  if (input.mediaPermission !== "granted") missingRequirements.push("media_permission");
  if (!input.hasPeerId) missingRequirements.push("peer_id");
  if (!input.hasActiveStream && input.mediaPermission === "granted") {
    missingRequirements.push("media_stream");
  }

  return {
    mediaPermission: input.mediaPermission,
    canBrowse: true,
    canMatch: missingRequirements.length === 0,
    needsPermissionPrompt: input.mediaPermission === "unknown",
    missingRequirements,
  };
}

export function shouldScheduleNotification(permission: { display?: string }) {
  return permission.display === "granted";
}
```

- [ ] **Step 4: Re-run the tests and confirm they pass**

Run: `node --test src/lib/appReadiness.test.mjs`
Expected: PASS with all tests green

### Task 2: Add boot and permission hooks

**Files:**
- Create: `src/hooks/useAppBoot.ts`
- Create: `src/hooks/useMediaPermission.ts`
- Modify: `src/providers/MediaProvider.tsx`

- [ ] **Step 1: Add a failing permission-state test**

```js
test("createMatchReadiness marks unknown permission as needing an early prompt", () => {
  assert.deepEqual(
    createMatchReadiness({
      mediaPermission: "unknown",
      hasPeerId: true,
      hasActiveStream: false,
    }).needsPermissionPrompt,
    true,
  );
});
```

- [ ] **Step 2: Run the readiness test file again**

Run: `node --test src/lib/appReadiness.test.mjs`
Expected: FAIL on the new permission-prompt expectation if the helper is incomplete

- [ ] **Step 3: Implement the boot and permission hooks with focused responsibilities**

```ts
// useAppBoot.ts
export function useAppBoot(...) {
  // restore guest mode, run guarded device check, expose bootState/deviceId/isBanned
}

// useMediaPermission.ts
export function useMediaPermission() {
  // permission state, request/retry handlers, and browse/match readiness
}

// MediaProvider.tsx
// keep stream acquisition and track cleanup only
```

- [ ] **Step 4: Re-run the readiness test file**

Run: `node --test src/lib/appReadiness.test.mjs`
Expected: PASS

### Task 3: Integrate boot and permission flow into the root page

**Files:**
- Modify: `src/app/page.tsx`
- Modify: `src/hooks/useAuth.ts`
- Modify: `src/hooks/useVideoCall.ts`
- Modify: `src/hooks/useWebRTC.ts`

- [ ] **Step 1: Add a small root-flow regression test for notification scheduling policy**

```js
test("shouldScheduleNotification skips boot-time work for denied permission", () => {
  assert.equal(shouldScheduleNotification({ display: "prompt" }), false);
});
```

- [ ] **Step 2: Run the readiness test file again**

Run: `node --test src/lib/appReadiness.test.mjs`
Expected: FAIL if the helper still treats non-granted values as schedulable

- [ ] **Step 3: Refactor the root page to render from explicit boot and readiness state**

```ts
const { bootState, isGuest, setIsGuest, deviceId, isBanned } = useAppBoot(...);
const {
  mediaPermission,
  canMatch,
  needsPermissionPrompt,
  requestPermission,
  markPermissionDenied,
} = useMediaPermission();

if (bootState === "booting") return <LaunchShell />;
if (bootState === "blocked") return <BlockedDeviceScreen deviceId={deviceId} />;
```

Key behavior:

- boot-time welcome notifications only schedule when `shouldScheduleNotification(...)` returns true
- `startMatching()` exits early with a permission recovery path when `canMatch` is false
- canceling permission never flips readiness to granted
- waiting room writes only happen after peer and media prerequisites are met

- [ ] **Step 4: Re-run the readiness tests**

Run: `node --test src/lib/appReadiness.test.mjs`
Expected: PASS

### Task 4: Update user-facing permission and recovery UI

**Files:**
- Modify: `src/components/PermissionView.tsx`
- Modify: `src/components/SettingsView.tsx`
- Modify: `src/components/DiscoveryFeed.tsx`

- [ ] **Step 1: Make the permission view pure and explicit**

```ts
interface PermissionViewProps {
  status: "unknown" | "requesting" | "denied";
  onRequest: () => void;
  onContinueBrowsing: () => void;
}
```

- [ ] **Step 2: Add settings recovery entry points**

```ts
// SettingsView
// show current media status and a retry action for denied permission
```

- [ ] **Step 3: Show a clear live-match recovery CTA when permission is denied**

```ts
// DiscoveryFeed
// if matching is locked, render "Enable camera and mic" action instead of pretending matching is ready
```

- [ ] **Step 4: Verify lint and tests**

Run: `node --test src/lib/appReadiness.test.mjs`
Expected: PASS

Run: `npm run lint`
Expected: exit 0 with no lint errors

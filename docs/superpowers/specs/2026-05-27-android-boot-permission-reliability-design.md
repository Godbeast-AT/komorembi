# Android Boot And Permission Reliability Design

## Summary

This spec covers the first reliability-focused cleanup pass for Komorembi on Android/Capacitor. The goal is to make app launch feel fast and deterministic, move camera and microphone access into an explicit early onboarding checkpoint, and ensure denied native permissions do not block non-live browsing flows.

## Problem Statement

The current app start flow in [page.tsx](E:\IDE PROJECTS\dating app\src\app\page.tsx) mixes several unrelated responsibilities:

- auth and guest restoration
- cached profile hydration
- device-ban checks
- privacy-screen setup
- welcome notification scheduling
- camera and microphone gating
- matching readiness

That coupling creates Android-specific failure modes:

- loading states can hang or feel random because multiple async concerns compete to decide whether the UI can render
- notification work happens during boot, increasing startup noise and failure surface
- permission denial is handled as an exception instead of a supported product state
- canceling the permission prompt currently marks the user as permission-ready, which can push them into broken live-match flows later

## Goals

- Make boot resolve quickly to a usable screen on Android, even when native bridges are slow.
- Request camera and microphone access early in onboarding, as a deliberate product step.
- Allow users who deny camera or microphone access to continue browsing the app.
- Block live matching until media permission is explicitly granted and media initialization succeeds.
- Remove boot-time notification prompts and other non-essential native interruptions.
- Make readiness state explicit enough to test.

## Non-Goals

- Rebuild the entire app shell.
- Redesign discovery, chat, or monetization flows in this pass.
- Change product policy for safety mode or matching logic.
- Add a large state-management framework.

## Proposed Approach

Use a small boot coordinator plus an explicit media-permission readiness model.

This keeps the current product shape intact while separating startup concerns from live-match concerns. The app will render from explicit readiness states instead of inferring behavior from unrelated booleans spread across the root component.

## Architecture

### 1. Boot Coordinator

Add a focused boot hook responsible for app-start concerns only.

Suggested responsibilities:

- restore guest mode from local storage
- wait for auth hook resolution, with a guarded timeout
- restore cached profile data
- run device-id and banned-device check without blocking forever
- expose a normalized app readiness state

Suggested output shape:

```ts
type AppBootState =
  | "booting"
  | "ready"
  | "limited"
  | "blocked";

interface AppBootResult {
  bootState: AppBootState;
  isGuest: boolean;
  isGuestLoading: boolean;
  deviceId: string | null;
  isBanned: boolean;
  bootReason?: "timeout" | "native_unavailable" | "banned";
}
```

Behavior:

- `booting`: show launch/loading shell
- `ready`: normal app flow
- `limited`: render the app shell even if a native dependency was slow or unavailable
- `blocked`: banned-device state only

### 2. Media Permission Coordinator

Move permission truth out of [PermissionView.tsx](E:\IDE PROJECTS\dating app\src\components\PermissionView.tsx). The component should become a pure UI surface.

Suggested media permission states:

```ts
type MediaPermissionState =
  | "unknown"
  | "requesting"
  | "granted"
  | "denied";

interface MatchReadiness {
  mediaPermission: MediaPermissionState;
  canBrowse: boolean;
  canMatch: boolean;
  needsPermissionPrompt: boolean;
}
```

Behavior:

- `unknown`: user has not completed the early permission step yet
- `requesting`: permission request is in progress
- `granted`: live matching may proceed if other prerequisites are ready
- `denied`: browsing is allowed, live matching is locked behind a recovery CTA

### 3. Root Screen Rules

Keep [page.tsx](E:\IDE PROJECTS\dating app\src\app\page.tsx) as the composition layer, but reduce it to orchestration:

- boot state selection
- onboarding vs main app selection
- selected modal/full-screen overlays
- live match flow entry

It should no longer own implicit permission truth or use side effects during render-adjacent flow transitions.

## User Flow

### Launch

1. App mounts.
2. Boot coordinator starts guest restore, auth/session restore, cache restore, and device-ban check.
3. The app shows a lightweight launch shell while boot is unresolved.
4. If native work is slow, boot degrades to `limited` instead of keeping the user behind a spinner.
5. If the device is banned, render the blocked state immediately.
6. Otherwise render landing/onboarding/main shell as soon as the minimum state is known.

### Early Media Permission Step

1. During early onboarding, show a dedicated camera/microphone readiness step.
2. If the user grants permission, mark media permission as `granted`.
3. If the user denies or dismisses, mark media permission as `denied`.
4. Continue onboarding completion and allow browsing.
5. Show live-matching actions as locked until permission is later granted.

### Matching Entry

`startMatching()` may only proceed when:

- peer ID exists
- media permission is `granted`
- media initialization returns an active stream

If any prerequisite fails:

- do not enter searching state
- do not insert into the waiting room
- show a targeted recovery path instead

## UI And UX Changes

### Launch Shell

Keep the current launch/loading feel lightweight, but ensure it is tied only to `bootState === "booting"`.

### Permission Screen

Update [PermissionView.tsx](E:\IDE PROJECTS\dating app\src\components\PermissionView.tsx) to support:

- early-onboarding usage
- explicit denied state messaging
- retry action
- continue-browsing action

The "Maybe Later" path must not set permission to granted. It should mark the state as `denied` and return the user to browsing-safe flows.

### Live-Match Lock State

When media permission is denied:

- discovery, profile, and chats stay usable
- live-match CTA changes to a clear recovery action such as `Enable camera and mic`
- settings should offer a way to retry permission setup

## Notification And Native Policy

### Notifications

Boot should never trigger a notification permission prompt.

New rule:

- if notification permission is already granted, scheduling welcome/match notifications is allowed
- if permission is not granted, skip scheduling silently during boot
- if the product later wants notification onboarding, that should be a separate, explicit prompt

### Privacy Screen

Keep privacy-screen setup best-effort and non-blocking. Failures should only be logged.

### Device Check

Keep banned-device checking, but ensure failures degrade to `limited` instead of blocking app usage unless a real ban record is found.

## Code Changes

### New Files

- `src/hooks/useAppBoot.ts`
- `src/hooks/useMediaPermission.ts`
- `src/lib/appReadiness.ts`

### Modified Files

- [page.tsx](E:\IDE PROJECTS\dating app\src\app\page.tsx)
- [useAuth.ts](E:\IDE PROJECTS\dating app\src\hooks\useAuth.ts)
- [useVideoCall.ts](E:\IDE PROJECTS\dating app\src\hooks\useVideoCall.ts)
- [MediaProvider.tsx](E:\IDE PROJECTS\dating app\src\providers\MediaProvider.tsx)
- [PermissionView.tsx](E:\IDE PROJECTS\dating app\src\components\PermissionView.tsx)
- [SettingsView.tsx](E:\IDE PROJECTS\dating app\src\components\SettingsView.tsx)

### Responsibility Boundaries

- `useAuth`: session and presence only
- `useAppBoot`: Android-safe startup state
- `useMediaPermission`: permission state and retry helpers
- `MediaProvider`: obtain and release streams, not permission policy
- `page.tsx`: render decisions and action wiring
- `PermissionView`: presentational UI for permission messaging and actions

## Error Handling Rules

- Native bridge failures must not block browsing forever.
- Denied media permission must be represented as product state, not treated as an uncaught failure.
- Failed media initialization after permission grant should reset match readiness and surface a retry path.
- Notification scheduling failures should warn and exit silently.
- Waiting-room writes must never occur before match prerequisites are satisfied.

## Testing Strategy

### Unit Tests

Add focused tests for:

- boot readiness transitions
- media permission state transitions
- live-match gating logic

Suggested files:

- `src/lib/appReadiness.test.ts`
- `src/hooks/useMediaPermission.test.ts`

### Flow Tests

Update the existing Playwright flow and add Android-safe cases:

- boot resolves even if auth/native operations are slow
- denying camera or microphone still allows browsing
- live matching is blocked until permission is granted
- canceling the permission prompt does not mark the user ready for matching

## Rollout Notes

This spec only covers the first reliability pass. Once this is stable, the same cleanup pattern should be applied to:

- onboarding/profile cleanup
- matching/video hardening
- discovery/chat/likes consistency

## Success Criteria

- Android launch reaches a usable screen quickly and consistently.
- No boot-time notification prompt appears.
- Users can finish onboarding and browse even after denying media access.
- Matching never enters a broken half-ready state caused by fake permission success.
- The new readiness logic is covered by tests.

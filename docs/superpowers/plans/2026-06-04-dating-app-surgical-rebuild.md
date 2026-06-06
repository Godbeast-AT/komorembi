# Dating App Surgical Rebuild Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild the current Next.js + Capacitor + Supabase app into the intention-first dating MVP while removing the old guest-first, live-video, mock-profile, and vibe-matching architecture.

**Architecture:** Keep the existing mobile shell, Supabase client boundary, reusable profile/photo/discovery/chat UI, reports/blocks foundation, push token support, and Capacitor packaging. Replace the product core with server-enforced auth, onboarding, waitlist, discovery, messaging, moderation, streaks, notifications, admin, and privacy workflows.

**Tech Stack:** Next.js, React, TypeScript, Capacitor, Supabase Auth, Supabase Postgres/RLS/RPC, Supabase Edge Functions, Supabase Storage, Playwright, Node test scripts.

---

## Execution Rules

- [x] No later phase starts until every verification command from the previous phase passes.
- [x] If a test fails, the active bot stops phase handoff, fixes the source issue, reruns the full phase test set, and records the failure cause.
- [x] Each phase ends with `npm run lint`, `npm run build`, and targeted unit/SQL/Playwright checks unless the phase has no app code changes.
- [x] Destructive RPCs must be transactional. If any step fails, the whole operation rolls back.
- [x] Legacy objects are soft-retired first and deleted only after replacement paths pass regression tests.

## Phase 0: Architecture Contract Bot

- [x] Freeze shared contracts for profile, onboarding state, feed filters, waitlist, conversations, messages, moderation, reports, notifications, admin actions, and deletion requests.
- [x] Mark deletion targets: `VideoCallRoom`, `useWebRTC`, `useVideoCall`, camera/mic permission gate, PeerJS dependency, mock discovery fallback, guest-only flow, `waiting_room` live matching, and call history UI/schema from active paths.
- [x] Define waitlisted preview response: preview-only cards with no user ids, no names, no bios, no usernames, no exact ages, and no original photos.
- [x] Verification: contract document and Phase 0 contract tests reviewed.

## Phase 1: Auth, Sessions, And Account Lifecycle Bot

- [x] Replace guest login with Supabase Phone OTP auth.
- [x] Track session/device records tied to Supabase user id and Capacitor device id.
- [x] Store only `phone_hash` in app-owned tables.
- [x] Implement invalidate-all-sessions behavior from settings.
- [x] Implement 14-day soft deletion: close conversations, hide profile, delete photos, anonymize sender display, and schedule final purge.
- [x] Verification: OTP shell flow, session invalidation test, deletion request test.

## Phase 2: Core Database And RLS Bot

- [x] Create MVP tables for profiles, onboarding progress, photos, feed impressions, filters, waitlist, referrals, conversations, messages, moderation events, reports, appeals, pre-ban context submissions, blocks, notifications, admin actions, and deletion requests.
- [x] Enable RLS on all exposed tables.
- [x] Use RPCs and Edge Functions for privileged operations.
- [x] Add scheduled jobs for IST reset, pending expiry, expired purge, blocked-message purge, report archival, and deletion purge.
- [x] Make `change_sensitive_profile_field` transactional: validate warning acknowledgement, update profile field, close conversations, archive messages, invalidate feed eligibility, and write audit/admin event atomically.
- [x] Verification: SQL checks for RLS, atomic sensitive field change, and scheduled job existence.

## Phase 3: Onboarding Bot

- [x] Build resumable onboarding with stored step progress.
- [x] Require phone verified, intention, username, name, DOB, gender, preference, city/state, and at least 2 photos.
- [x] Add debounced username availability backed by server-side banned-word validation.
- [x] Save onboarding through one transactional RPC.
- [x] Ensure incomplete profiles never appear in discovery.
- [x] Verification: under-18 rejection, username states, onboarding resume, atomic profile creation.

## Phase 4: Photo Processing Bot

- [x] Keep the existing photo editor UI, but make production photo processing server-side.
- [x] Replace generic photo slots with intentional profile photo slots:
  - Slot 1: Clear face photo. Front facing, good lighting, no sunglasses, taken within the last year. Serve this as the primary verification photo and main profile avatar. Reject if no face is detected or if multiple faces are detected, with a message requesting a solo photo.
  - Slot 2: Hobby or interest photo 1. Show yourself doing something you love. Block group photos for this slot.
  - Slot 3: Hobby or interest photo 2. Must represent a different interest from Slot 2.
  - Slot 4: Candid or social photo. With friends, at an event, or somewhere real. This slot allows social context.
  - Slots 5 and 6: Open. Anything that represents the user, subject to safety and anti-fraud checks.
- [x] Show each slot's label and guide description during that slot's upload flow.
- [x] Verify real image content before permanent storage.
- [x] Resize approved images to max 1200px on the longest side.
- [x] Generate 400px thumbnails for feed and message lists.
- [x] Run content moderation for nudity, graphic violence, and faces of minors. Each category returns 0-100 confidence.
- [x] Apply moderation thresholds:
  - Above 85 percent nudity confidence: reject automatically.
  - Between 60 and 85 percent nudity confidence: hold photo for manual review, allow user to continue with other photos.
  - Below 60 percent nudity confidence: approve automatically.
- [x] Use the same hold/reject pattern for other severe unsafe categories where the moderation service supports it.
- [x] Show rejected-photo message: "This photo could not be uploaded because it may contain content that violates our guidelines. Please use a different photo."
- [x] Do not expose the exact moderation reason to the user.
- [x] Flag the account for manual review after 3 photo rejections in a single upload session.
- [x] Enforce raw photos only. Use image metadata and pixel analysis to detect heavy filters.
- [x] Give photos taken directly with the native in-app camera a visible verified-camera badge.
- [x] Permit gallery uploads, but do not give them the verified-camera badge.
- [x] Add AI-enhancement evaluation for excessive skin smoothing, artificial eye enlargement, and jaw reshaping.
- [x] If AI tampering or heavy filters are detected, reject instantly with: "Please use an unedited photo. Filters and AI enhancements are not allowed."
- [x] Store only processed image and thumbnail, never the original upload.
- [x] Enforce minimum 2 photos after onboarding.
- [x] Ensure Slot 1 is always the feed/message avatar.
- [x] Verification: accepted image, rejected image, held-for-review image, 3-rejection account flag, minimum photo count, Slot 1 face validation, group-photo blocking for Slots 1-3, verified-camera badge, and AI/filter rejection.

## Phase 5: Waitlist And Gender Cap Bot

- [x] Implement city-level gender cap using active, non-waitlisted men and women.
- [x] Waitlisted users can complete profiles and see only server-generated preview cards.
- [x] Preview contract:
  - Photos are never sent to the client.
  - Names are replaced with generic labels like "Someone nearby".
  - Age is bucketed, for example "20s".
  - City can be shown.
  - Intention badge can be shown.
  - No `peer_id`, username, bio, report action, profile open action, or message action is included.
  - Client blur/skeleton styling is cosmetic only and applies to already-redacted data.
- [x] Admit waitlisted men in order when ratio allows.
- [x] Referral acceleration moves referrer up 5 positions once per unique completed female signup.
- [x] Leaving waitlist loses position permanently.
- [x] Verification: gender cap, server-redacted preview, referral boost, leave/rejoin queue reset.

## Phase 6: Discovery And Feed Bot

- [x] Reuse discovery/profile UI but remove production mock fallback.
- [x] Feed eligibility enforces same intention, mutual gender preference, no block/report either way, target not waitlisted, complete, active, visible, and not banned.
- [x] Rank by same city, same state, preferred age, unseen this session, recent activity, new-user boost, and completeness boost.
- [x] Add 20-profile pagination and session-level impression memory.
- [x] Persist age/city filters.
- [x] Redesign home feed cards to prioritize substance over full-bleed images.
- [x] Display name, age, city, and exactly one profile prompt answer as the prominent primary content.
- [x] Move the Slot 1 profile photo to a smaller secondary element off to the side, not a full-bleed hero.
- [x] Remove all visible like counts and match counts from user-facing UI.
- [x] Ensure like-count and match-count metrics are absent from serialized feed payloads sent to the client.
- [x] Verification: compatibility filtering, no legacy mock fallback, pagination, filter persistence, prompt-first card layout, side thumbnail treatment, and zero visible like/match counts.

## Phase 7: Messaging And Conversation Bot

- [x] Replace like/request-first chat with first-message conversation creation.
- [x] Server checks sender standing, daily cap, pending duplicate, and 1-500 character limit.
- [x] Support conversation states: `pending`, `active`, `expired`, `locked`, `closed`.
- [x] Delivered first message starts 3-day pending timer.
- [x] Recipient reply activates conversation.
- [x] Expired conversations grey out for 7 days, then hide/delete.
- [x] Sender may retry only 7 days after expiry.
- [x] Verification: cap enforcement, duplicate pending prevention, delivery-based expiry timer, retry delay.
- [x] Gate failure recorded: `npm.cmd run build` initially failed because TypeScript could not prove `validation.text` was defined after importing the `.mjs` validator; fixed by extracting a definite `openingText`, then reran focused Phase 7 checks, full library tests, Playwright smoke, lint, and build successfully.

## Phase 8: AI Moderation Bot

- [x] Add `moderate-message` Edge Function.
- [x] Moderate every message before delivery.
- [x] Verdicts: `safe`, `warn`, `block`.
- [x] Timeout after 5 seconds queues the message; moderation is never skipped.
- [x] Strike escalation: 3 warning, 5 24-hour message ban, 8 7-day message ban, 10 permanent ban.
- [x] Store blocked messages for review and 90-day retention.
- [x] Add admin override to clear strike and manually deliver.
- [x] Verification: safe delivery, warn strike, block invisibility, timeout queue, threshold escalation.
- [x] Gate failure recorded: Playwright smoke initially failed with `net::ERR_NETWORK_CHANGED` because no local dev server was listening on port 3000. Started `npm.cmd run dev`, verified HTTP 200, reran Playwright successfully, then reran lint and build successfully.

## Phase 9: Streak And Meet Prompt Bot

- [x] Track streaks by IST calendar day.
- [x] Count a streak day only when both users send at least one message.
- [x] Reset if either user misses a full day.
- [x] Show badge, day 3/day 7 animations, and lock chat at day 7.
- [x] Meet prompt outcomes:
  - Both yes: celebration, unlock, 7-day planning banner.
  - One yes and one keep chatting: unlock, private note only for yes user.
  - Both keep chatting: unlock, prompt again at day 14, day 30, then monthly.
- [x] Add day 30/60/100 milestone notifications.
- [x] Verification: streak qualify/reset, day 7 lock, each prompt outcome, long-streak milestones.
- [x] Gate passed: focused Phase 9 tests, full library tests, Playwright smoke, lint, and build.
- [x] Gate failure recorded: `npm.cmd run build` failed because `next/font/google` could not fetch Inter and Syne. Removed the build-time Google Fonts dependency, defined local CSS font-stack variables, added a guard test, then reran focused checks, full library tests, Playwright smoke, lint, and build successfully.

## Phase 10: Notifications Bot

- [x] Expand notification event model and keep push token foundation.
- [x] Categories: account/security, messages, streaks, waitlist, app updates.
- [x] Security notifications cannot be disabled.
- [x] Enforce max 3 notifications per user per hour.
- [x] Enforce quiet hours 11pm-8am IST unless disabled.
- [x] Queue extra or quiet-hour notifications.
- [x] Verification: category preferences, security override, throttle, quiet-hour queue.
- [x] Gate passed: focused Phase 10 tests, full library tests, Playwright smoke, lint, and build.

## Phase 11: Reports, Blocking, And Admin Bot

- [x] Replace prompt-based report UI with bottom-sheet report form.
- [x] Report reasons: Fake profile, Harassment, Inappropriate photos, Scammer, Underage user, Other.
- [x] Optional report details max 300 characters.
- [x] Reporting does not auto-block.
- [x] Blocking is mutual in effect and closes any conversation.
- [x] Add blocklist/unblock settings.
- [x] Add admin views for users, reports, blocked messages, waitlists, signup stats, gender ratios, and message volume.
- [x] Deprioritize reports from users with more than 10 reports in 24 hours.
- [x] Count confirmed reports against a reported user only when the report has not been dismissed by admin.
- [x] One reporter can count only once per reported user for threshold purposes, regardless of how many reports they submit.
- [x] Dismissed reports do not count toward auto-ban thresholds.
- [x] Auto-ban thresholds:
  - 5 confirmed reports: 24-hour account ban.
  - 20 confirmed reports: 7-day account ban and permanent high-risk admin flag after reinstatement.
  - 30 confirmed reports: permanent ban and phone hash block.
- [x] At 5 and 20 reports, banned user cannot log in, send messages, or appear in feeds until the ban expires.
- [x] At 30 reports, banned user cannot create a new account with the same phone hash.
- [x] Immediate reporter confirmation after submission:
  - "Thank you for helping keep our community safe. We take every report seriously and will review this within 24 hours. We may not be able to share specific details about the action we took, but we act on every report we receive."
- [x] Reporter follow-up push notification when threshold action is taken:
  - "An account you reported has been reviewed and action has been taken. Thank you for helping keep the community safe."
- [x] Do not name the reported user or describe the action in reporter follow-up messages.
- [x] Temporary ban message shown to banned user on next open:
  - "Your account has been temporarily suspended until [date and time]. This happened because multiple members of our community reported your account. If you believe this is a mistake, you can contact us at [support email]. Your account will be automatically reinstated after the suspension period."
- [x] Permanent ban message shown to banned user on next open:
  - "Your account has been permanently suspended due to repeated violations of our community guidelines. This decision was made after multiple reports from community members. If you believe this is a mistake, please contact us at [support email]."
- [x] Add an Appeals section under Account Settings, visible only to users with an active ban or warning flag.
- [x] Appeal form has two fields: "What happened?" and "Why do you think this decision was wrong?"
- [x] Enforce a strict combined 500-character maximum across both appeal fields.
- [x] Route submitted appeals to a dedicated `appeals_queue` admin view, isolated from the primary reports queue.
- [x] Admins can mark appeals as `upheld` or `overturned`.
- [x] If appeal is overturned, immediately lift the account ban/warning and send: "We reviewed your appeal and have reinstated your account. We apologise for the inconvenience."
- [x] If appeal is upheld, maintain the penalty and send: "We reviewed your appeal and have determined the suspension was appropriate. If you believe there is additional context we have not considered, please email [support email]."
- [x] Immutably log every appeal submission, admin decision, decision maker, and timestamp for legal/audit protection.
- [x] Implement contextual pre-ban rule for human-reviewed bans longer than 24 hours.
- [x] Before a human-reviewed ban longer than 24 hours takes effect, notify the reported user and allow 48 hours to submit incident context.
- [x] Exclude automated 5-report threshold bans from the contextual pre-ban pause; they trigger instantly.
- [x] Verification: report submission confirmation, unique reporter counting, dismissed report exclusion, 5/20/30 thresholds, reporter follow-up, banned-user messages, high-risk flag, appeals visibility, 500-character appeal cap, appeal verdict effects, immutable appeal audit log, and 48-hour pre-ban context behavior.
- [x] Gate passed: focused Phase 11 tests, full library tests, Playwright smoke, lint, and build.

## Phase 12: Profile Editing And Privacy Bot

- [x] Editable anytime: bio, photos, display preferences, invisible mode.
- [x] Delayed edits: city within 1 hour, username once every 30 days.
- [x] Sensitive edits: intention, gender, gender preference.
- [x] Sensitive edits must call transactional `change_sensitive_profile_field`; do not split destructive work between client and multiple server calls.
- [x] Add completeness score for ranking.
- [x] Add data export request path with 48-hour preparation target.
- [x] Enforce retention rules for deleted accounts, expired conversations, blocked messages, and reports.
- [x] Verification: edit restrictions, sensitive edit atomicity, completeness boost, export request, retention jobs.
- [x] Gate passed: focused Phase 12 tests, full library tests, Playwright smoke, lint, and build.

## Phase 13: Legacy Deletion Bot

- [x] Remove PeerJS, WebRTC hooks, live video room, waiting-room runtime usage, call history UI, camera/mic gate, mock profile data, and old "vibe" user-facing copy.
- [x] Remove or archive legacy SQL only after MVP migrations and data paths are verified.
- [x] Run the full regression suite before deleting old files and again after deletion.
- [x] Verification: no imports from deleted modules, no PeerJS dependency, no mock profile fallback, full regression pass.
- [x] Gate failure recorded: full library regression initially failed after the page rewrite because the source renamed `feedSessionId`, kept an obsolete `permissions` onboarding state, and no longer matched static waitlist/onboarding assertions. Fixed by restoring `feedSessionId`, removing the camera-permission onboarding state, sending non-waitlisted completions directly to `completed`, and updating static assertions to the new no-camera-gate flow. Build then exposed stale `OnboardingView` and notification preference typing; fixed both and reran focused tests, full library tests, Playwright, lint, and build successfully.

## Phase 14: QA, Regression, And Launch Bot

- [x] Do not begin until Phases 0-13 passed their gated tests.
- [x] Build full regression suite covering MVP behavior, not just happy paths.
- [x] If any test fails:
  - Stop launch work immediately.
  - Assign failure back to owning phase bot.
  - Fix at source, not in the test unless the test is wrong.
  - Rerun that phase's tests.
  - Rerun the full Phase 14 regression suite.
- [x] Required checks:
  - Unit tests for validation, username rules, age rules, message caps, notification preferences, and completeness.
  - SQL/RPC verification for gender cap, waitlist admission, discovery eligibility, expiry, streaks, moderation escalation, sensitive-profile atomicity, report thresholds, and photo moderation outcomes.
  - Playwright flows for OTP shell, resumable onboarding, waitlist preview, admitted feed, filters, first message, pending reply, expiry, report/block, meet prompt, account deletion, photo rejection, and banned-account messaging.
  - `npm run lint`
  - `npm run build`
  - Android Capacitor build after web build passes.
- [x] Gate failure recorded: the first Phase 14 Playwright regression assertion for pending expiry was over-specific and failed even though the schema implements delivery-time expiry with `pending_expires_at = COALESCE(pending_expires_at, now() + interval '3 days')`; fixed the test to assert the actual contract and reran Playwright successfully. Android build then failed because Capacitor's library module requested Java 21 while only Java 17 is available locally; added an Android Gradle `afterEvaluate` compile-options override to Java 17 and reran `assembleDebug` successfully.

## Public Interfaces

### RPCs

- `check_username_availability`
- `complete_onboarding_profile`
- `change_sensitive_profile_field`
- `discover_profiles`
- `discover_waitlist_preview`
- `join_waitlist`
- `leave_waitlist`
- `apply_waitlist_referral`
- `admit_waitlisted_users_for_city`
- `send_opening_message`
- `send_chat_message`
- `mark_messages_read`
- `expire_pending_conversations`
- `update_conversation_streaks`
- `record_meet_prompt_response`
- `block_user`
- `submit_report`
- `apply_report_thresholds`
- `dismiss_report`
- `submit_appeal`
- `process_appeal_verdict`
- `submit_pre_ban_context`
- `request_account_deletion`
- `cancel_account_deletion`
- `request_data_export`

### Edge Functions

- `process-photo`
- `analyze_photo_metadata_and_ai`
- `moderate-message`
- `dispatch-notifications`
- `delete-account-finalizer`
- `prepare-data-export`

### Client Boundary

- Keep Supabase client access centralized through `src/services/supabase.ts`.
- Keep server-enforced decisions in RPCs or Edge Functions; client checks are convenience only.

## Cross-Phase Test Scenarios

- Under-18 user cannot complete onboarding.
- Username check returns checking, available, taken, invalid, and banned-word outcomes.
- Profile creation is atomic.
- Sensitive profile changes atomically update profile and close/archive conversations.
- Different-intention users never see each other.
- Waitlisted preview never leaks names, photos, bios, usernames, or profile ids.
- Waitlisted male cannot open profiles or message.
- Female referral moves waitlisted referrer up exactly 5 positions once.
- Photo nudity confidence above 85 percent rejects automatically.
- Photo nudity confidence from 60 to 85 percent is held for review.
- Three photo rejections in one session flags the account.
- Slot 1 rejects a photo containing 3 friends or a photo with zero faces.
- Slot 2 and Slot 3 reject group photos.
- An image with high AI skin-smoothing triggers the specified unedited-photo rejection copy.
- Native in-app camera uploads receive a verified-camera badge and gallery uploads do not.
- Home feed card displays prompt-answer text as primary content and renders the profile thumbnail restricted to the side.
- Like-count and match-count elements are absent from serialized payloads and frontend viewports.
- Message over 500 characters is rejected server-side.
- User cannot bypass 10/day message cap.
- Pending expiry starts from delivery time.
- Flagged message is invisible to recipient.
- Strike thresholds produce correct restrictions.
- Seven-day streak locks chat and prompt choices unlock correctly.
- Quiet hours and 3/hour notification throttle are enforced.
- Block closes conversation and hides both users mutually.
- Report threshold bans trigger at 5, 20, and 30 confirmed unique reporters.
- Reporter gets immediate thank-you message and action-taken follow-up without identifying the reported user.
- Banned user sees the correct temporary or permanent ban message.
- Banned or warned user can access the Appeals tab in settings, while clean accounts cannot.
- Appeal text locks exactly at the combined 500-character maximum.
- Overturning an appeal reinstates the user and dispatches the apology text.
- Human-reviewed ban greater than 24 hours holds for 48 hours to allow user context, while a 5-report threshold ban fires immediately.
- Deleted account is hidden immediately and purged after 14 days.

## Assumptions

- Keep Next.js + Capacitor, not Flutter.
- Use Supabase Auth for OTP; app-owned tables store only `phone_hash`.
- Use IST for counters, streaks, expiry reminders, and quiet hours.
- Server/RPC/Edge Function checks are source of truth.
- Waitlist preview redaction is server-side; client blur is cosmetic only.
- Photo moderation service will be AWS Rekognition or Google Cloud Vision.
- Support email is configured before Phase 11 ships.
- Legacy data is not trusted for production MVP behavior unless migrated explicitly.

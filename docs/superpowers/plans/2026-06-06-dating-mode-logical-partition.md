# Dating Mode Logical Partition Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Split long-term and short-term dating into isolated logical data pools inside one Supabase project, with independent preference-demand waitlists and no cross-mode discovery, messaging, notifications, or feed state.

**Architecture:** Keep one physical Supabase project and one set of app tables. Add a required `dating_mode` partition column to every mode-specific table and enforce it in RPCs, RLS-adjacent source-of-truth checks, indexes, admin views, and scheduled jobs. `profiles.intention` remains the user's active mode selector; profile/photos/interests carry across mode switches, while conversations, waitlist state, and feed state do not.

**Tech Stack:** Next.js, React, TypeScript, Supabase Postgres/RLS/RPC, Supabase Edge Functions, Node test scripts, Capacitor Android.

---

## Execution Rules

- [ ] No implementation phase starts until the previous phase's targeted tests pass.
- [ ] Every phase with app or schema changes ends with `node --test src\lib\*.test.mjs`, `npm.cmd run lint`, and `npm.cmd run build`.
- [ ] The final Android verification runs `npx.cmd cap sync android`, then Android `assembleDebug`.
- [ ] Before the next Android `assembleDebug`, run Gradle with warning output/report enabled and fix deprecation warnings that are owned by this app's Gradle config in the same PR.
- [ ] Destructive mode-switch work must be one database transaction. If any step fails, the entire intention change rolls back.

## Phase 0: Contract And Test Bot

- [ ] Add a mode contract in `src/lib/canvas2Contracts.mjs`:
  - `DATING_MODES = ["long_term", "short_term"]`
  - `MODE_PARTITIONED_TABLES`
  - `MODE_SPECIFIC_NOTIFICATION_CATEGORIES`
- [ ] Add contract tests proving:
  - only `long_term` and `short_term` are valid modes
  - no mode-specific table is missing from `MODE_PARTITIONED_TABLES`
  - notification events that reference conversations, waitlists, streaks, or expiry require `dating_mode`
- [ ] Add source tests proving the app still uses one active mode per account and does not introduce separate Supabase projects or duplicate schemas.

## Phase 1: Schema Partition Bot

- [ ] Add `dating_mode text NOT NULL CHECK (dating_mode IN ('long_term', 'short_term'))` to mode-specific tables:
  - `waitlist_entries`
  - `waitlist_referrals`
  - `feed_impressions`
  - `feed_filters`
  - `conversations`
  - `messages`
  - `moderation_events`
  - `message_moderation_queue`
  - `notifications`
- [ ] Backfill existing rows from the owning profile or conversation before setting `NOT NULL`.
- [ ] Add composite indexes now, not later:
  - `waitlist_entries(city, state, dating_mode, queue_position)` for admission scans
  - `conversations(dating_mode, status, last_message_at)` for expiry and inbox scans
  - `messages(dating_mode, delivery_state, created_at)` for moderation/admin scans
  - `feed_impressions(viewer_user_id, dating_mode, target_user_id)` for discovery exclusion
  - `feed_filters(user_id, dating_mode)` unique index for per-mode persisted filters
  - `notifications(user_id, dating_mode, status, scheduled_for)` for dispatch filtering
- [ ] Add SQL/source tests proving each new column, CHECK constraint, and composite index exists.

## Phase 2: Waitlist And Discovery Bot

- [ ] Update preference-demand waitlist functions to calculate independently per `city + state + dating_mode`:
  - `calculate_preference_waitlist_ratio(p_city, p_state, p_dating_mode)`
  - `should_waitlist_preference_for_city(p_city, p_state, p_dating_mode, p_gender_preference)`
  - `admit_waitlisted_users_for_city(p_city, p_state, p_dating_mode)`
- [ ] Update `complete_onboarding_profile` to copy `p_intention` into all mode-specific waitlist/feed writes.
- [ ] Update `join_waitlist`, `leave_waitlist`, and `apply_waitlist_referral` so queue positions and referral boosts only affect the active `dating_mode`.
- [ ] Update `discover_profiles` to scope feed impressions, target eligibility, and pagination memory by viewer `dating_mode`.
- [ ] Update `discover_waitlist_preview` separately from `discover_profiles`:
  - preview reads only the waitlisted user's active `dating_mode`
  - preview never returns profile ids, usernames, names, bios, or photo URLs
  - short-term previews never include long-term users, and long-term previews never include short-term users
- [ ] Add tests proving long-term imbalance does not affect short-term waitlisting, and short-term imbalance does not affect long-term waitlisting.
- [ ] Add explicit waitlist-preview leakage tests for both directions.

## Phase 3: Conversations, Messages, And Mode Switch Bot

- [ ] Update `send_opening_message` to reject cross-mode recipients server-side even if `p_recipient_peer_id` is known.
- [ ] Insert `dating_mode` into new `conversations`, `messages`, moderation queue rows, and moderation events.
- [ ] Update `send_chat_message`, `mark_messages_read`, `expire_pending_conversations`, `purge_expired_conversations`, `update_conversation_streaks`, and `record_meet_prompt_response` to operate only within each conversation's `dating_mode`.
- [ ] Expand `change_sensitive_profile_field` for `intention` changes so it atomically:
  - records `old_dating_mode`
  - records `new_dating_mode`
  - updates profile intention/theme
  - closes old-mode conversations
  - archives old-mode messages
  - clears old-mode feed impressions and feed filters
  - retires old-mode waitlist entry
  - applies the new-mode 1.3x waitlist rule
  - writes a structured admin audit event
- [ ] The admin audit event payload must include:
  - `user_id`
  - `old_dating_mode`
  - `new_dating_mode`
  - `conversations_closed`
  - `messages_archived`
  - `waitlist_entry_retired`
  - `new_mode_waitlisted`
  - `timestamp`
- [ ] Add double-switch regression test:
  - user switches `long_term -> short_term -> long_term`
  - no conversations are restored
  - no waitlist position is restored
  - no feed impressions or filters are restored from the first long-term period

## Phase 4: Notifications And Admin Bot

- [ ] Add `dating_mode` to mode-specific notification events.
- [ ] Update `dispatch-notifications` to skip delivery when `notification.dating_mode` does not match the recipient's current active `profiles.intention`.
- [ ] Keep account/security notifications deliverable without mode matching.
- [ ] Include `dating_mode` in waitlist admission, expiry warning, conversation expired, streak, locked chat, meet prompt, and planning banner notifications.
- [ ] Update admin views to group or filter by `dating_mode`:
  - waitlists
  - gender/preference ratios
  - daily signups
  - message volume
  - blocked messages
  - mode-switch audit events
- [ ] Add tests proving a queued short-term streak notification is suppressed after the user switches to long-term.

## Phase 5: Client And Verification Bot

- [ ] Update `src/services/supabase.ts` types to expose `dating_mode` for mode-specific rows.
- [ ] Persist feed filters separately for each mode.
- [ ] Update mode-switch UI copy:
  - profile/photos/interests carry forward
  - old conversations close
  - old waitlist position is lost
  - old feed state is not restored if the user switches back
- [ ] Add client/source tests for the copy and service boundaries.
- [ ] Run verification:
  - `node --test src\lib\*.test.mjs`
  - `npm.cmd run lint`
  - `npm.cmd run build`
  - `npx.cmd cap sync android`
  - Android `assembleDebug`
  - Gradle warning/deprecation report with app-owned warnings fixed or documented as third-party plugin warnings


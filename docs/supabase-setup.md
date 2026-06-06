# Supabase Setup

This repo expects the dating app schema to be applied in the order below.

## Apply Order

1. `supabase_schema.sql`
2. `supabase_schema_auth_security.sql`
3. `trust_engine_schema.sql`
4. `chat_approval_schema.sql`
5. `call_history_schema.sql`
6. `growth_notifications_schema.sql`

## Why This Order

- `supabase_schema.sql` creates the core tables and base RPCs.
- `supabase_schema_auth_security.sql` adds auth-related tables and account deletion helpers.
- `trust_engine_schema.sql` updates trust and matching behavior.
- `chat_approval_schema.sql` finalizes the chat approval flow and adds `send_chat_request`, `approve_chat`, and `decline_chat`.
- `call_history_schema.sql` applies the session-aware call history function and dedupe protection.
- `growth_notifications_schema.sql` adds waitlist referrals, invite queue movement, notification preferences, push-token storage, and notification event queue scaffolding.

## Verification Scripts

- Run `qa_discovery_engine_verification.sql` to verify discovery exclusions, action logging, reports, and Safety Mode filtering.
- Run `qa_chat_approval_verification.sql` to verify pending requests, priority super-likes, approval, and chat metadata updates.
- Run `qa_growth_notifications_verification.sql` to verify waitlist joins, referral queue bumps, notification preferences, and push event queuing.
- Run `qa_trust_safety_verification.sql` to verify Phase 6 trust brackets, report auto-flagging, block/report deductions, and skip-session penalties.
- Run `qa_safety_schema_verification.sql` to verify:
  - `blocked_users` exists and accepts inserts
  - `record_call` only writes one bilateral pair per session

## Runtime Expectations

The current app code expects these database objects to exist:

- `profiles`
- `waiting_room`
- `call_history`
- `likes`
- `chats`
- `messages`
- `blocked_users`
- `user_blocks`
- `banned_devices`
- `reports`
- `moderation_queue`
- `user_actions`
- `user_skip_sessions`
- `waitlist_entries`
- `waitlist`
- `waitlist_referrals`
- `notification_push_tokens`
- `notification_events`
- `discover_users`
- `match_by_vibe`
- `record_skip_session`
- `join_waitlist`
- `apply_invite_referral`
- `queue_notification_event`
- `handle_like`
- `approve_chat`
- `decline_chat`
- `record_call`
- `delete_current_user_account`

Phase 6 trust brackets are fixed at:

- High: `80` to `100`
- Medium: `50` to `79`
- Low: `0` to `49`

Safety Mode uses `trust_score >= 80` for eligible targets, while low-bracket users remain isolated to other low-bracket users.

If any of those are missing in the live project, parts of the app will fail even if the web build succeeds locally.

## Auth Settings

- Enable Google as an OAuth provider for `supabase.auth.signInWithOAuth({ provider: "google" })`.
- Enable Anonymous Sign-Ins for guest mode. Guest mode now calls `supabase.auth.signInAnonymously()`, so Supabase must allow anonymous users.
- Enable manual identity linking so anonymous guests can upgrade with `supabase.auth.linkIdentity({ provider: "google" })`.

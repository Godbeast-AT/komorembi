# Intention MVP Architecture Contract

This document freezes Phase 0 for the surgical rebuild. Later bots must not change these contracts without updating tests and this document in the same phase gate.

## Product Direction

- Keep Next.js, Capacitor, and Supabase.
- Replace guest-first, live-video, mock-profile, and vibe-matching product paths.
- Keep reusable photo, profile, discovery, chat, reports, blocks, push, and mobile-shell foundations where they fit the MVP.

## Legacy Deletion Targets

- `src/components/VideoCallRoom.tsx`
- `src/hooks/useWebRTC.ts`
- `src/hooks/useVideoCall.ts`
- `src/components/PermissionView.tsx`
- `peerjs`
- mock discovery fallback
- guest-only flow
- `waiting_room` live matching
- call-history active UI

## Shared MVP Terms

- Intentions: `long_term`, `short_term`
- Genders: `man`, `woman`, `non_binary`
- Preferences: `men`, `women`, `everyone`
- Conversation statuses: `pending`, `active`, `expired`, `locked`, `closed`
- Message moderation verdicts: `safe`, `warn`, `block`
- Notification categories: `account_security`, `messages`, `streaks`, `waitlist`, `app_updates`

## Waitlist Preview Contract

Waitlisted users may see preview cards only when the server has already redacted the payload. The client blur is cosmetic and must never be relied on for privacy.

Allowed preview fields:

- `preview_id`
- `label`
- `age_bucket`
- `city`
- `state`
- `intention`
- `card_style`

Forbidden preview fields:

- `peer_id`
- `user_id`
- `username`
- `display_name`
- `name`
- `bio`
- `prompt_answer`
- `photos`
- `photo_url`
- `avatar_url`
- `exact_age`
- `birth_date`
- `can_open_profile`
- `can_message`
- `can_report`

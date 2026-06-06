# Canvas 2 Additions Plan

## Summary

Extend the intention-first dating MVP with the Canvas 2 additions: dual app themes, Google OAuth, preference-based waitlisting at 1.3x, hobbies/movies/music profile signals, premium-only AI message enhancement, premium subscription scaffolding, and user-selected meet prompt timelines. This is a new app launch, so the implementation can shape the MVP before production deployment instead of migrating active users.

## Confirmed Constraints

- Target deployment is confirmed, but this is a new app launch.
- Do not assume or embed real API keys.
- Provider credentials live only in secure runtime config: Supabase Auth provider settings, Supabase Edge Function secrets, or local `.env.secrets`.
- Tracked files may contain placeholders only.
- Existing phase gates still apply: no later bot starts until the prior phase tests pass.
- Destructive RPCs remain transactional.

## Secret And Provider Contract

Add provider placeholders only:

- Google OAuth: `GOOGLE_OAUTH_CLIENT_ID`, `GOOGLE_OAUTH_CLIENT_SECRET`.
- Movies: `TMDB_API_KEY`.
- Music: `LASTFM_API_KEY`, `MUSIC_SEARCH_PROVIDER`.
- AI enhancement: `AI_MESSAGE_ENHANCEMENT_URL`, `AI_MESSAGE_ENHANCEMENT_API_KEY`.
- Premium billing: `PREMIUM_BILLING_PROVIDER`, `PREMIUM_BILLING_WEBHOOK_SECRET`, `PREMIUM_PRICE_INR_MONTHLY`.

No client-side code may receive these secrets. Movie, music, and AI requests go through Edge Functions or server-only routes. Public client config remains limited to Supabase URL, publishable key, and auth redirect URL.

## Execution Rules

- Run `npm run lint`, `npm run build`, relevant Node tests, relevant SQL/RPC checks, and relevant Playwright flows at each phase gate.
- If a test fails, stop that phase, fix the owning source, rerun the whole phase test set, document root cause, then continue.
- Any provider-dependent feature must support a placeholder/no-key state with a clear unavailable UI.
- No production crash path is allowed. The old "none preference crashes app" note is replaced with a graceful rejection/redirect rule.
- Premium gates must enforce access server-side; client badges and upsells are cosmetic.

## Phase 0A: Canvas 2 Contract Bot

- Add `theme_mode` contract derived from intention:
  - `long_term` maps to `calm`.
  - `short_term` maps to `bold`.
- Define theme tokens for color, typography, card layout, and animation timing.
- Lock the preference model to `men`, `women`, or `everyone`; remove/redirect `none`.
- Replace gender-cap vocabulary with preference-cap vocabulary.
- Add profile interest contracts for hobbies, movies, and music.
- Add timeline preference contract:
  - `daily` = 3 days
  - `one_week` = 7 days
  - `two_weeks` = 14 days
  - `one_month` = 30 days
  - `two_months` = 60 days
- Add premium contract:
  - AI message enhancement
  - profile views
  - immediate city change
  - priority feed boost
- Tests:
  - Contract tests for allowed theme, preference, timeline, and premium enums.
  - Source tests proving no `none` preference is accepted.

## Phase 1A: Auth Expansion Bot

- Add Google OAuth button beside Phone OTP.
- Use Supabase OAuth for Google sign-in.
- Track sessions identically for OTP and Google users.
- Store `contact_hash` rather than phone-specific-only meaning:
  - OTP users hash normalized phone.
  - Google users hash verified Google email.
- Keep optional phone collection for Google users during onboarding for security/recovery.
- Add account merge flow for duplicate Google/phone identities:
  - Detect duplicate contact signals.
  - Show merge explanation.
  - Confirm before merging.
  - Merge profile, sessions, photos, waitlist entry, conversations, and reports transactionally.
  - If both identities are waitlisted, keep the better lower-number waitlist position and retire the worse duplicate queue entry inside the same transaction.
- Tests:
  - OTP and Google auth both create device session payloads.
  - Google users do not require phone to start onboarding.
  - Optional recovery phone hash is stored separately from primary contact hash.
  - Merge RPC is transactional.
  - Merge RPC preserves the better waitlist position when both identities are queued.

## Phase 3A: Onboarding Expansion Bot

- Apply Calm or Bold theme immediately after intention selection.
- Add timeline preference step after intention/preference.
- Add hobbies grid:
  - At least 40 preset options.
  - Max 6 selected.
  - No custom free text.
- Add movie search step:
  - Optional.
  - Min 2 search chars.
  - Top 8 TMDB results.
  - Max 4 selected.
  - Store provider id, title, year, poster URL snapshot.
  - Selecting a fifth movie removes the least recently selected.
- Add music search step:
  - Optional.
  - Min 2 search chars.
  - Top 8 Last.fm results, or configured provider.
  - Max 4 selected.
  - Store provider id/MBID, artist name, genre if available, image URL snapshot.
- API unavailable behavior:
  - Show "Search is temporarily unavailable. You can skip this step and add it later from your profile."
  - Queue one `onboarding_interest_reminder` notification event 48 hours after signup if movies or music are skipped.
  - Add `onboarding_interest_reminder` to the notification event schema so `dispatch-notifications` can format and throttle it like other onboarding/account events.
- Tests:
  - Onboarding resumes across new steps.
  - Hobbies max 6 and reject custom values.
  - Movie/music selections max 4 and store provider ids.
  - Missing API keys show unavailable state and do not block completion.
  - Theme loads before post-intention screens render.
  - `onboarding_interest_reminder` is stored, throttled, and dispatched through the notification event model.

## Phase 4A: Theme System Bot

- Create shared theme provider that loads server profile theme before app shell renders.
- Add Calm Mode visual variants:
  - Muted purple/navy/soft white/grey palette.
  - 300ms transitions.
  - Larger readable type and relaxed spacing.
  - Profile cards emphasize text and prompt answer.
  - Header shield indicator visible.
- Add Bold Mode visual variants:
  - Saturated pink/red/orange/black palette.
  - 150ms transitions.
  - Bolder type and tighter spacing.
  - Full-bleed photo cards with bottom overlay.
  - No shield indicator.
- Features remain identical across themes.
- Tests:
  - No flash of wrong theme in boot path.
  - Theme switch after sensitive intention change updates all screens.
  - Calm and Bold card components render different layouts from same data.
  - Bold card parallax scroll is verified on a mid-range Android device profile without layout jank and with a 60fps target.

## Phase 5A: Preference-Based Waitlist Bot

- Change ratio threshold from 1.5 to 1.3.
- Count preference demand, not biological gender:
  - Users seeking women count in female-seeker pool.
  - Users seeking men count in male-seeker pool.
  - Users seeking everyone count 0.5 in each pool.
- If female-seekers / male-seekers exceeds 1.3, new female-seekers are waitlisted.
- Referral boost moves a waitlisted user up 5 positions when they refer a completed signup from the underrepresented preference pool.
- Admin dashboard labels ratio as preference demand ratio.
- Tests:
  - Threshold is 1.3 everywhere.
  - `everyone` contributes 0.5 to both pools.
  - Waitlist admission loops by preference ratio.
  - Admin views expose preference-ratio language and values.

## Phase 6A: Discovery And Profile Card Bot

- Add timeline compatibility as a soft ranking signal.
- Add premium priority boost for profiles the viewer has not yet seen.
- Render card layout by viewer theme:
  - Calm card: half-screen, medium photo, name/age/city/intention, full prompt answer, hobby pills, shared indicators.
  - Bold card: 70% screen height, full-bleed photo, gradient overlay, large name/age, teaser hobby/media item, subtle parallax.
- Add shared interest indicators:
  - Matching hobby pill highlight.
  - Matching movie poster ring.
  - Matching artist image ring.
- Tests:
  - Same data renders Calm and Bold layouts.
  - Shared movie/music/hobby indicators appear only when interests overlap.
  - Ranking includes timeline compatibility and premium boost without hard-filtering.

## Phase 7A: Premium Messaging Bot

- Split composer into:
  - Manual mode for all users.
  - AI enhanced mode for premium users only.
- Free users see an AI sparkle button with premium badge and tooltip.
- Free users tapping AI open the upgrade screen.
- Premium users can draft a rough idea and request an AI suggestion.
- AI suggestion uses shared hobbies, movies, music, bio, and prompt answers.
- AI never sends automatically; user edits/reviews then sends.
- Add Edge Function placeholder `enhance-message` with server-side premium check and provider-key placeholders.
- Tests:
  - Free users cannot call enhancement successfully server-side.
  - Premium users receive draft suggestion when provider is configured.
  - Missing provider config returns unavailable state, not a crash.
  - Final send still passes normal message moderation.

## Phase 8A: Premium Subscription Bot

- Add `premium_subscriptions` table and `is_premium` profile/account state.
- Add billing provider placeholder, not a hardcoded vendor.
- Add upgrade screen with monthly price placeholder defaulting to INR 299.
- Add webhook Edge Function placeholder with `PREMIUM_BILLING_WEBHOOK_SECRET`.
- Premium unlocks:
  - AI message enhancement.
  - Profile views.
  - Immediate city changes.
  - Priority feed boost.
- Tests:
  - Premium entitlements are server-derived.
  - Webhook rejects missing/invalid secret.
  - Non-premium users remain blocked from premium RPCs.

## Phase 9A: Timeline-Based Streak Bot

- Replace hardcoded 7-day first meet prompt trigger.
- Store each conversation's prompt trigger at creation using the stricter sooner timeline of both users.
- Changes to timeline preference affect new conversations only.
- Keep prompt repeat schedule relative to selected trigger:
  - First trigger at configured day count.
  - Then day 14, day 30, then monthly for users who keep chatting, unless the first trigger is later than those milestones.
- Preserve existing outcomes:
  - both yes
  - one yes/one keep chatting
  - both keep chatting
- Tests:
  - User A 7 days + User B 14 days locks at 7 days.
  - Timeline changes do not mutate active conversation trigger days.
  - Existing meet prompt unlock outcomes still pass.

## Phase 12A: Profile Editing Expansion Bot

- Add editable hobbies, movies, music, and timeline preference.
- Add media-interest edit flows with the same provider fallback behavior as onboarding.
- Add premium-controlled immediate city change:
  - Premium users apply city immediately.
  - Free users keep the 1-hour delay.
- Add profile views feature for premium users:
  - Store viewer, viewed user, timestamp.
  - Respect block/report/deleted/invisible rules.
- Tests:
  - Profile editing enforces hobby/movie/music limits.
  - Premium immediate city update works server-side.
  - Free city update remains delayed.
  - Profile views are hidden from non-premium users.

## Phase 14A: Full Regression Bot

- Extend the existing Phase 14 suite with:
  - Google OAuth shell and callback source checks.
  - Calm/Bold theme boot and card layout checks.
  - Preference-based waitlist 1.3 ratio SQL/RPC checks.
  - Hobbies/movie/music onboarding and edit checks.
  - Missing provider-key fallback checks.
  - Premium AI composer access checks.
  - Timeline-based meet prompt checks.
  - No accepted `none` preference checks.
- Android build remains required after web build passes.

## Public Interfaces To Add

RPCs:

- `merge_auth_identities`
- `search_movie_interests`
- `search_music_interests`
- `save_profile_interests`
- `set_timeline_preference`
- `calculate_preference_waitlist_ratio`
- `create_premium_checkout_session`
- `sync_premium_subscription`
- `record_profile_view`
- `get_profile_viewers`

Edge Functions:

- `search-movies`
- `search-music`
- `enhance-message`
- `premium-webhook`

Tables:

- `profile_hobbies`
- `profile_movies`
- `profile_music_artists`
- `premium_subscriptions`
- `profile_views`
- `auth_identity_merges`

Notification event types:

- `onboarding_interest_reminder`

## Launch Impact

Do not deploy the previous MVP as final production until this addendum is either implemented or explicitly deferred. Since this is a new app, the preferred path is to implement Canvas 2 before launch, then run the full Phase 14 plus Phase 14A regression suite.

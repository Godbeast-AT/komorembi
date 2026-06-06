# Supabase Deployment Runbook

This repo is locally complete for the first MVP rebuild pass. Use this runbook to move from local verification to a live Supabase project without reviving the deleted guest/mock/video paths.

Canvas 2 additions are tracked separately in `docs/superpowers/plans/2026-06-05-canvas-2-additions.md`. Because this is a new app launch, deploy after those additions are either implemented and verified or explicitly deferred.

## Target Confirmation

The local `.env.local` currently points at project URL `https://okfpqtzadbumqxthzdiv.supabase.co`. The user confirmed this target and clarified this is a new app launch.

Do not apply SQL until you have confirmed:

- The Supabase project ref.
- Whether this is staging or production.
- A current database backup exists for any project with real users.
- The service role key and internal function secret are available outside the browser environment.
- Canvas 2 provider keys are either configured in secure runtime settings or the feature is intentionally left in its no-provider fallback state.

## Required Secrets

Set these in Supabase Edge Function secrets, not as `NEXT_PUBLIC_*` values:

```bash
supabase secrets set \
  SUPABASE_URL="https://<project-ref>.supabase.co" \
  SUPABASE_ANON_KEY="<anon-key>" \
  SUPABASE_SERVICE_ROLE_KEY="<service-role-key>" \
  INTERNAL_FUNCTION_SECRET="<long-random-secret>" \
  MESSAGE_MODERATION_URL="<provider-url>" \
  MESSAGE_MODERATION_API_KEY="<provider-key>" \
  PHOTO_MODERATION_URL="<provider-url>" \
PHOTO_MODERATION_API_KEY="<provider-key>" \
  TMDB_API_KEY="<tmdb-key-or-token>" \
  LASTFM_API_KEY="<lastfm-key>" \
  AI_MESSAGE_ENHANCEMENT_URL="<provider-url>" \
  AI_MESSAGE_ENHANCEMENT_API_KEY="<provider-key>" \
  PREMIUM_BILLING_PROVIDER="<provider-name>" \
  PREMIUM_BILLING_WEBHOOK_SECRET="<webhook-secret>" \
  --project-ref <project-ref>
```

`MESSAGE_MODERATION_*`, `PHOTO_MODERATION_*`, `TMDB_*`, `LASTFM_*`, and `AI_MESSAGE_ENHANCEMENT_*` may be empty only for local/staging fallback behavior. Production should use real providers before enabling those flows.

## Deployment Order

1. Run the full local gate:

```bash
npm run lint
npm run build
node --test src/lib/*.test.mjs
npx playwright test ./src/tests
npx cap sync android
```

2. Apply database schema:

```bash
supabase db push --project-ref <project-ref>
```

If deploying manually through SQL editor, apply `supabase_schema_mvp_core.sql` first, then `storage_setup.sql`.

3. Deploy Edge Functions:

```bash
supabase functions deploy process-photo --project-ref <project-ref>
supabase functions deploy invite-referral --project-ref <project-ref>
supabase functions deploy moderate-message --project-ref <project-ref>
supabase functions deploy dispatch-notifications --project-ref <project-ref>
supabase functions deploy delete-account-finalizer --project-ref <project-ref>
supabase functions deploy prepare-data-export --project-ref <project-ref>
```

After Canvas 2 is implemented, deploy the added provider and premium functions in the same gate:

```bash
supabase functions deploy search-movies --project-ref <project-ref>
supabase functions deploy search-music --project-ref <project-ref>
supabase functions deploy enhance-message --project-ref <project-ref>
supabase functions deploy premium-webhook --project-ref <project-ref>
```

Do not deploy the legacy `delete-account` function for the MVP path unless you are explicitly testing legacy cleanup. The MVP uses `request_account_deletion` plus `delete-account-finalizer`.

## Function Auth Contract

User-callable functions keep JWT verification enabled in `supabase/config.toml`:

- `process-photo`
- `invite-referral`
- `delete-account` legacy only

Internal worker functions have JWT verification disabled and require `INTERNAL_FUNCTION_SECRET` in either `X-Internal-Function-Secret` or `Authorization: Bearer <secret>`:

- `moderate-message`
- `dispatch-notifications`
- `delete-account-finalizer`
- `prepare-data-export`

## Storage Contract

Apply `storage_setup.sql` to create:

- `profile-photos`, public read, owner-scoped authenticated writes/deletes.
- `data-exports`, private, owner-scoped authenticated reads.

The old `avatars` bucket is legacy-only and is not used by `process-photo`.

## Post-Deploy Verification

Run these after schema and functions deploy:

```bash
supabase functions list --project-ref <project-ref>
supabase db lint --project-ref <project-ref>
```

Then verify the MVP gates in app:

- OTP screen appears and no guest entry exists.
- Resumable onboarding can upload two processed photos.
- Waitlisted preview never returns ids, names, bios, usernames, or photo URLs.
- Admitted users can page/feed/filter and send a first message.
- Worker functions reject calls without `INTERNAL_FUNCTION_SECRET`.
- Account deletion hides the profile immediately and the finalizer purges due requests.

## Launch Blockers

Launch stays blocked if any required check fails. Fix the owning phase source, rerun that phase's targeted tests, then rerun the full Phase 14 regression suite before proceeding.

-- Phase 2: intention-first dating MVP core schema, RLS, RPC contracts, and jobs.
-- This file is designed to coexist with the legacy schema until Phase 13 removes old paths.

CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA extensions;

CREATE TABLE IF NOT EXISTS public.profiles (
    peer_id text PRIMARY KEY,
    user_id uuid UNIQUE REFERENCES auth.users(id) ON DELETE SET NULL,
    username text UNIQUE,
    display_name text NOT NULL DEFAULT '',
    date_of_birth date,
    gender text,
    gender_preference text,
    intention text,
    theme_mode text NOT NULL DEFAULT 'calm' CHECK (theme_mode IN ('calm', 'bold')),
    timeline_preference text NOT NULL DEFAULT 'one_week'
        CHECK (timeline_preference IN ('daily', 'one_week', 'two_weeks', 'one_month', 'two_months')),
    city text,
    state text,
    bio text NOT NULL DEFAULT '',
    photos text[] NOT NULL DEFAULT '{}',
    display_preferences jsonb NOT NULL DEFAULT '{}'::jsonb,
    is_complete boolean NOT NULL DEFAULT false,
    is_waitlisted boolean NOT NULL DEFAULT false,
    is_banned boolean NOT NULL DEFAULT false,
    is_visible boolean NOT NULL DEFAULT true,
    last_active_at timestamptz NOT NULL DEFAULT now(),
    messages_sent_today integer NOT NULL DEFAULT 0,
    messages_sent_reset_at timestamptz NOT NULL DEFAULT now(),
    message_banned_until timestamptz,
    account_banned_until timestamptz,
    ban_level text,
    ban_reason text,
    high_risk_flag boolean NOT NULL DEFAULT false,
    warning_count integer NOT NULL DEFAULT 0,
    flagged_for_review boolean NOT NULL DEFAULT false,
    photo_rejections_this_session integer NOT NULL DEFAULT 0,
    completeness_score integer NOT NULL DEFAULT 0,
    is_premium boolean NOT NULL DEFAULT false,
    username_changed_at timestamptz,
    pending_city text,
    pending_state text,
    city_change_effective_at timestamptz,
    feed_invalidated_at timestamptz,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.profiles
    ADD COLUMN IF NOT EXISTS username text,
    ADD COLUMN IF NOT EXISTS date_of_birth date,
    ADD COLUMN IF NOT EXISTS gender_preference text,
    ADD COLUMN IF NOT EXISTS intention text,
    ADD COLUMN IF NOT EXISTS theme_mode text NOT NULL DEFAULT 'calm',
    ADD COLUMN IF NOT EXISTS timeline_preference text NOT NULL DEFAULT 'one_week',
    ADD COLUMN IF NOT EXISTS city text,
    ADD COLUMN IF NOT EXISTS state text,
    ADD COLUMN IF NOT EXISTS display_preferences jsonb NOT NULL DEFAULT '{}'::jsonb,
    ADD COLUMN IF NOT EXISTS is_complete boolean NOT NULL DEFAULT false,
    ADD COLUMN IF NOT EXISTS is_waitlisted boolean NOT NULL DEFAULT false,
    ADD COLUMN IF NOT EXISTS is_banned boolean NOT NULL DEFAULT false,
    ADD COLUMN IF NOT EXISTS is_visible boolean NOT NULL DEFAULT true,
    ADD COLUMN IF NOT EXISTS last_active_at timestamptz NOT NULL DEFAULT now(),
    ADD COLUMN IF NOT EXISTS messages_sent_today integer NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS messages_sent_reset_at timestamptz NOT NULL DEFAULT now(),
    ADD COLUMN IF NOT EXISTS message_banned_until timestamptz,
    ADD COLUMN IF NOT EXISTS account_banned_until timestamptz,
    ADD COLUMN IF NOT EXISTS ban_level text,
    ADD COLUMN IF NOT EXISTS ban_reason text,
    ADD COLUMN IF NOT EXISTS high_risk_flag boolean NOT NULL DEFAULT false,
    ADD COLUMN IF NOT EXISTS warning_count integer NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS flagged_for_review boolean NOT NULL DEFAULT false,
    ADD COLUMN IF NOT EXISTS photo_rejections_this_session integer NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS completeness_score integer NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS is_premium boolean NOT NULL DEFAULT false,
    ADD COLUMN IF NOT EXISTS username_changed_at timestamptz,
    ADD COLUMN IF NOT EXISTS pending_city text,
    ADD COLUMN IF NOT EXISTS pending_state text,
    ADD COLUMN IF NOT EXISTS city_change_effective_at timestamptz,
    ADD COLUMN IF NOT EXISTS feed_invalidated_at timestamptz,
    ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

CREATE TABLE IF NOT EXISTS public.onboarding_progress (
    user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    current_step text NOT NULL DEFAULT 'phone_verified',
    completed_steps text[] NOT NULL DEFAULT '{}',
    draft_profile jsonb NOT NULL DEFAULT '{}'::jsonb,
    updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.profile_photos (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    peer_id text REFERENCES public.profiles(peer_id) ON DELETE CASCADE,
    slot integer NOT NULL CHECK (slot BETWEEN 1 AND 6),
    image_path text NOT NULL,
    thumbnail_path text NOT NULL,
    moderation_status text NOT NULL DEFAULT 'approved'
        CHECK (moderation_status IN ('approved', 'held', 'rejected')),
    verified_camera boolean NOT NULL DEFAULT false,
    is_primary boolean NOT NULL DEFAULT false,
    deleted_at timestamptz,
    created_at timestamptz NOT NULL DEFAULT now(),
    UNIQUE (user_id, slot)
);

ALTER TABLE public.profile_photos
    ADD COLUMN IF NOT EXISTS verified_camera boolean NOT NULL DEFAULT false;

CREATE TABLE IF NOT EXISTS public.feed_impressions (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    viewer_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    viewed_user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
    viewed_peer_id text,
    dating_mode text NOT NULL DEFAULT 'long_term' CHECK (dating_mode IN ('long_term', 'short_term')),
    session_id text NOT NULL,
    shown_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.feed_impressions
    ADD COLUMN IF NOT EXISTS dating_mode text NOT NULL DEFAULT 'long_term';

CREATE TABLE IF NOT EXISTS public.feed_filters (
    user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
    dating_mode text NOT NULL DEFAULT 'long_term' CHECK (dating_mode IN ('long_term', 'short_term')),
    min_age integer,
    max_age integer,
    city text,
    updated_at timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (user_id, dating_mode)
);

ALTER TABLE public.feed_filters
    ADD COLUMN IF NOT EXISTS dating_mode text NOT NULL DEFAULT 'long_term';

CREATE TABLE IF NOT EXISTS public.waitlist_entries (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
    peer_id text REFERENCES public.profiles(peer_id) ON DELETE CASCADE,
    city text NOT NULL,
    state text,
    dating_mode text NOT NULL DEFAULT 'long_term' CHECK (dating_mode IN ('long_term', 'short_term')),
    gender text NOT NULL,
    gender_preference text,
    queue_position integer NOT NULL,
    status text NOT NULL DEFAULT 'waiting' CHECK (status IN ('waiting', 'admitted', 'left')),
    joined_at timestamptz NOT NULL DEFAULT now(),
    admitted_at timestamptz,
    left_at timestamptz
);

ALTER TABLE public.waitlist_entries
    ADD COLUMN IF NOT EXISTS dating_mode text NOT NULL DEFAULT 'long_term';

CREATE TABLE IF NOT EXISTS public.waitlist_referrals (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    referrer_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    referred_user_id uuid NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
    dating_mode text NOT NULL DEFAULT 'long_term' CHECK (dating_mode IN ('long_term', 'short_term')),
    city text,
    applied_at timestamptz NOT NULL DEFAULT now(),
    boost_positions integer NOT NULL DEFAULT 5
);

ALTER TABLE public.waitlist_referrals
    ADD COLUMN IF NOT EXISTS dating_mode text NOT NULL DEFAULT 'long_term';

CREATE TABLE IF NOT EXISTS public.conversations (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user1_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    user2_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    user1_peer_id text,
    user2_peer_id text,
    dating_mode text NOT NULL DEFAULT 'long_term' CHECK (dating_mode IN ('long_term', 'short_term')),
    status text NOT NULL DEFAULT 'pending'
        CHECK (status IN ('pending', 'active', 'expired', 'locked', 'closed')),
    opening_sender_id uuid REFERENCES auth.users(id),
    delivered_at timestamptz,
    pending_expires_at timestamptz,
    expired_at timestamptz,
    closed_at timestamptz,
    locked_at timestamptz,
    current_streak integer NOT NULL DEFAULT 0,
    last_streak_date date,
    next_meet_prompt_day integer NOT NULL DEFAULT 7,
    meet_prompt_user1_response text,
    meet_prompt_user2_response text,
    meet_prompt_private_note_user_id uuid REFERENCES auth.users(id),
    planning_banner_until timestamptz,
    meet_prompt_due_at integer,
    created_at timestamptz NOT NULL DEFAULT now(),
    last_message_at timestamptz,
    updated_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT conversations_user_order CHECK (user1_id < user2_id),
    UNIQUE (user1_id, user2_id, dating_mode)
);

ALTER TABLE public.conversations
    ADD COLUMN IF NOT EXISTS dating_mode text NOT NULL DEFAULT 'long_term',
    ADD COLUMN IF NOT EXISTS last_streak_date date,
    ADD COLUMN IF NOT EXISTS next_meet_prompt_day integer NOT NULL DEFAULT 7,
    ADD COLUMN IF NOT EXISTS meet_prompt_user1_response text,
    ADD COLUMN IF NOT EXISTS meet_prompt_user2_response text,
    ADD COLUMN IF NOT EXISTS meet_prompt_private_note_user_id uuid REFERENCES auth.users(id),
    ADD COLUMN IF NOT EXISTS planning_banner_until timestamptz,
    ADD COLUMN IF NOT EXISTS last_message_at timestamptz;

CREATE TABLE IF NOT EXISTS public.messages (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    conversation_id uuid REFERENCES public.conversations(id) ON DELETE CASCADE,
    sender_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
    recipient_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
    sender_peer_id text,
    sender_display_name text,
    dating_mode text NOT NULL DEFAULT 'long_term' CHECK (dating_mode IN ('long_term', 'short_term')),
    content text NOT NULL CHECK (char_length(content) BETWEEN 1 AND 500),
    delivery_state text NOT NULL DEFAULT 'sent'
        CHECK (delivery_state IN ('sent', 'moderated', 'delivered', 'read', 'flagged')),
    moderation_verdict text CHECK (moderation_verdict IN ('safe', 'warn', 'block')),
    delivered_at timestamptz,
    read_at timestamptz,
    archived_at timestamptz,
    created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.messages
    ADD COLUMN IF NOT EXISTS conversation_id uuid REFERENCES public.conversations(id) ON DELETE CASCADE,
    ADD COLUMN IF NOT EXISTS sender_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS recipient_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS sender_display_name text,
    ADD COLUMN IF NOT EXISTS dating_mode text NOT NULL DEFAULT 'long_term',
    ADD COLUMN IF NOT EXISTS delivery_state text NOT NULL DEFAULT 'sent',
    ADD COLUMN IF NOT EXISTS moderation_verdict text,
    ADD COLUMN IF NOT EXISTS delivered_at timestamptz,
    ADD COLUMN IF NOT EXISTS read_at timestamptz,
    ADD COLUMN IF NOT EXISTS archived_at timestamptz;

CREATE TABLE IF NOT EXISTS public.moderation_events (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
    message_id uuid REFERENCES public.messages(id) ON DELETE SET NULL,
    dating_mode text NOT NULL DEFAULT 'long_term' CHECK (dating_mode IN ('long_term', 'short_term')),
    verdict text NOT NULL CHECK (verdict IN ('safe', 'warn', 'block')),
    categories jsonb NOT NULL DEFAULT '{}'::jsonb,
    strike_delta integer NOT NULL DEFAULT 0,
    reviewed_by uuid REFERENCES auth.users(id),
    reviewed_at timestamptz,
    created_at timestamptz NOT NULL DEFAULT now(),
    purge_after timestamptz NOT NULL DEFAULT (now() + interval '90 days')
);

ALTER TABLE public.moderation_events
    ADD COLUMN IF NOT EXISTS dating_mode text NOT NULL DEFAULT 'long_term';

CREATE TABLE IF NOT EXISTS public.message_moderation_queue (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    message_id uuid NOT NULL UNIQUE REFERENCES public.messages(id) ON DELETE CASCADE,
    dating_mode text NOT NULL DEFAULT 'long_term' CHECK (dating_mode IN ('long_term', 'short_term')),
    status text NOT NULL DEFAULT 'queued' CHECK (status IN ('queued', 'processing', 'processed', 'failed')),
    attempt_count integer NOT NULL DEFAULT 0,
    next_attempt_at timestamptz NOT NULL DEFAULT now(),
    last_error text,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    processed_at timestamptz
);

ALTER TABLE public.message_moderation_queue
    ADD COLUMN IF NOT EXISTS dating_mode text NOT NULL DEFAULT 'long_term';

CREATE TABLE IF NOT EXISTS public.reports (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    reporter_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
    reported_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
    reporter_id text,
    reported_id text,
    reason text NOT NULL CHECK (reason IN ('fake_profile', 'harassment', 'inappropriate_photos', 'scammer', 'underage_user', 'other')),
    details text CHECK (details IS NULL OR char_length(details) <= 300),
    status text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'reviewed', 'dismissed', 'action_taken', 'archived')),
    high_volume_reporter boolean NOT NULL DEFAULT false,
    threshold_action_taken text,
    threshold_action_taken_at timestamptz,
    reviewed_by uuid REFERENCES auth.users(id),
    reviewed_at timestamptz,
    created_at timestamptz NOT NULL DEFAULT now(),
    archive_after timestamptz NOT NULL DEFAULT (now() + interval '1 year')
);

ALTER TABLE public.reports
    ADD COLUMN IF NOT EXISTS reporter_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS reported_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS details text,
    ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'open',
    ADD COLUMN IF NOT EXISTS high_volume_reporter boolean NOT NULL DEFAULT false,
    ADD COLUMN IF NOT EXISTS threshold_action_taken text,
    ADD COLUMN IF NOT EXISTS threshold_action_taken_at timestamptz,
    ADD COLUMN IF NOT EXISTS reviewed_by uuid REFERENCES auth.users(id),
    ADD COLUMN IF NOT EXISTS reviewed_at timestamptz,
    ADD COLUMN IF NOT EXISTS archive_after timestamptz NOT NULL DEFAULT (now() + interval '1 year');

CREATE TABLE IF NOT EXISTS public.blocks (
    blocker_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    blocked_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    blocker_peer_id text,
    blocked_peer_id text,
    created_at timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (blocker_user_id, blocked_user_id)
);

CREATE TABLE IF NOT EXISTS public.notifications (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    dating_mode text CHECK (dating_mode IN ('long_term', 'short_term')),
    category text NOT NULL CHECK (category IN ('account_security', 'messages', 'streaks', 'waitlist', 'app_updates')),
    event_type text,
    title text NOT NULL,
    body text NOT NULL,
    payload jsonb NOT NULL DEFAULT '{}'::jsonb,
    status text NOT NULL DEFAULT 'queued' CHECK (status IN ('queued', 'sent', 'suppressed', 'failed')),
    send_after timestamptz NOT NULL DEFAULT now(),
    sent_at timestamptz,
    created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.notifications
    ADD COLUMN IF NOT EXISTS event_type text,
    ADD COLUMN IF NOT EXISTS dating_mode text;

CREATE INDEX IF NOT EXISTS waitlist_entries_city_state_mode_position_idx
    ON public.waitlist_entries (city, state, dating_mode, queue_position);

CREATE INDEX IF NOT EXISTS conversations_mode_status_last_message_idx
    ON public.conversations (dating_mode, status, last_message_at);

CREATE INDEX IF NOT EXISTS messages_mode_delivery_created_idx
    ON public.messages (dating_mode, delivery_state, created_at);

CREATE UNIQUE INDEX IF NOT EXISTS feed_impressions_viewer_mode_target_idx
    ON public.feed_impressions (viewer_user_id, dating_mode, viewed_user_id);

CREATE UNIQUE INDEX IF NOT EXISTS feed_filters_user_mode_idx
    ON public.feed_filters (user_id, dating_mode);

CREATE INDEX IF NOT EXISTS notifications_user_mode_status_scheduled_idx
    ON public.notifications (user_id, dating_mode, status, send_after);

CREATE TABLE IF NOT EXISTS public.notification_preferences (
    user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    messages boolean NOT NULL DEFAULT true,
    streaks boolean NOT NULL DEFAULT true,
    waitlist boolean NOT NULL DEFAULT true,
    app_updates boolean NOT NULL DEFAULT true,
    quiet_hours_enabled boolean NOT NULL DEFAULT true,
    updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.notification_push_tokens (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    token text NOT NULL UNIQUE,
    platform text NOT NULL DEFAULT 'android',
    enabled boolean NOT NULL DEFAULT true,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.profile_hobbies (
    user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    peer_id text REFERENCES public.profiles(peer_id) ON DELETE CASCADE,
    hobby text NOT NULL,
    position integer NOT NULL CHECK (position BETWEEN 1 AND 6),
    created_at timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (user_id, hobby)
);

CREATE TABLE IF NOT EXISTS public.profile_movies (
    user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    peer_id text REFERENCES public.profiles(peer_id) ON DELETE CASCADE,
    provider text NOT NULL DEFAULT 'tmdb',
    provider_id text NOT NULL,
    title text NOT NULL,
    year integer,
    poster_url text,
    position integer NOT NULL CHECK (position BETWEEN 1 AND 4),
    created_at timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (user_id, provider, provider_id)
);

CREATE TABLE IF NOT EXISTS public.profile_music_artists (
    user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    peer_id text REFERENCES public.profiles(peer_id) ON DELETE CASCADE,
    provider text NOT NULL DEFAULT 'lastfm',
    provider_id text NOT NULL,
    name text NOT NULL,
    genre text,
    image_url text,
    position integer NOT NULL CHECK (position BETWEEN 1 AND 4),
    created_at timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (user_id, provider, provider_id)
);

CREATE TABLE IF NOT EXISTS public.premium_subscriptions (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    provider text NOT NULL DEFAULT 'placeholder',
    provider_subscription_id text,
    status text NOT NULL DEFAULT 'inactive'
        CHECK (status IN ('inactive', 'active', 'past_due', 'cancelled')),
    amount_inr integer NOT NULL DEFAULT 299,
    current_period_end timestamptz,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.profile_views (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    viewer_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    viewed_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    viewed_peer_id text,
    viewed_at timestamptz NOT NULL DEFAULT now(),
    UNIQUE (viewer_user_id, viewed_user_id, viewed_at)
);

CREATE TABLE IF NOT EXISTS public.auth_identity_merges (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    primary_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    duplicate_user_id uuid NOT NULL,
    waitlist_position_to_keep integer,
    retired_waitlist_position integer,
    metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.admin_actions (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    actor_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
    target_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
    action_type text NOT NULL,
    metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.appeals_queue (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    what_happened text NOT NULL,
    why_wrong text NOT NULL,
    penalty_level text,
    status text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'upheld', 'overturned')),
    decided_by uuid REFERENCES auth.users(id),
    decision_note text,
    decided_at timestamptz,
    created_at timestamptz NOT NULL DEFAULT now(),
    CHECK (char_length(what_happened) + char_length(why_wrong) <= 500)
);

ALTER TABLE public.appeals_queue
    ADD COLUMN IF NOT EXISTS penalty_level text,
    ADD COLUMN IF NOT EXISTS decision_note text;

CREATE TABLE IF NOT EXISTS public.pre_ban_context_submissions (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    report_id uuid REFERENCES public.reports(id) ON DELETE SET NULL,
    context_text text NOT NULL CHECK (char_length(context_text) <= 500),
    due_at timestamptz NOT NULL,
    status text NOT NULL DEFAULT 'submitted' CHECK (status IN ('awaiting_context', 'submitted', 'reviewed')),
    submitted_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.pre_ban_context_submissions
    ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'submitted';

ALTER TABLE public.user_auth_records
    ADD COLUMN IF NOT EXISTS phone_hash_blocked boolean NOT NULL DEFAULT false,
    ADD COLUMN IF NOT EXISTS phone_hash_blocked_at timestamptz,
    ADD COLUMN IF NOT EXISTS phone_hash_block_reason text;

CREATE TABLE IF NOT EXISTS public.data_export_requests (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    status text NOT NULL DEFAULT 'requested' CHECK (status IN ('requested', 'processing', 'ready', 'failed')),
    requested_at timestamptz NOT NULL DEFAULT now(),
    due_at timestamptz NOT NULL DEFAULT (now() + interval '48 hours'),
    download_path text
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.onboarding_progress ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profile_photos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.feed_impressions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.feed_filters ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.waitlist_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.waitlist_referrals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.moderation_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.message_moderation_queue ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.blocks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notification_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notification_push_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profile_hobbies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profile_movies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profile_music_artists ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.premium_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profile_views ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.auth_identity_merges ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_actions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.appeals_queue ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pre_ban_context_submissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.data_export_requests ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE
    t text;
BEGIN
    FOREACH t IN ARRAY ARRAY[
        'profiles', 'onboarding_progress', 'profile_photos', 'feed_impressions',
        'feed_filters', 'waitlist_entries', 'waitlist_referrals', 'conversations',
        'messages', 'moderation_events', 'message_moderation_queue', 'reports',
        'blocks', 'notifications', 'notification_preferences',
        'notification_push_tokens', 'admin_actions', 'appeals_queue',
        'pre_ban_context_submissions', 'data_export_requests'
    ]
    LOOP
        EXECUTE format('GRANT SELECT, INSERT, UPDATE ON public.%I TO authenticated', t);
    END LOOP;
END $$;

DROP POLICY IF EXISTS "Profiles owner write" ON public.profiles;
CREATE POLICY "Profiles owner write"
ON public.profiles FOR ALL
TO authenticated
USING (auth.uid() IS NOT NULL AND auth.uid() = user_id)
WITH CHECK (auth.uid() IS NOT NULL AND auth.uid() = user_id);

DROP POLICY IF EXISTS "Profiles eligible read" ON public.profiles;
CREATE POLICY "Profiles eligible read"
ON public.profiles FOR SELECT
TO authenticated
USING (is_complete = true AND is_visible = true AND is_banned = false);

DROP POLICY IF EXISTS "Onboarding own row" ON public.onboarding_progress;
CREATE POLICY "Onboarding own row"
ON public.onboarding_progress FOR ALL
TO authenticated
USING (auth.uid() IS NOT NULL AND auth.uid() = user_id)
WITH CHECK (auth.uid() IS NOT NULL AND auth.uid() = user_id);

DROP POLICY IF EXISTS "Photos own row" ON public.profile_photos;
CREATE POLICY "Photos own row"
ON public.profile_photos FOR ALL
TO authenticated
USING (auth.uid() IS NOT NULL AND auth.uid() = user_id)
WITH CHECK (auth.uid() IS NOT NULL AND auth.uid() = user_id);

DROP POLICY IF EXISTS "Feed impressions own viewer" ON public.feed_impressions;
CREATE POLICY "Feed impressions own viewer"
ON public.feed_impressions FOR ALL
TO authenticated
USING (auth.uid() IS NOT NULL AND auth.uid() = viewer_user_id)
WITH CHECK (auth.uid() IS NOT NULL AND auth.uid() = viewer_user_id);

DROP POLICY IF EXISTS "Feed filters own row" ON public.feed_filters;
CREATE POLICY "Feed filters own row"
ON public.feed_filters FOR ALL
TO authenticated
USING (auth.uid() IS NOT NULL AND auth.uid() = user_id)
WITH CHECK (auth.uid() IS NOT NULL AND auth.uid() = user_id);

DROP POLICY IF EXISTS "Waitlist own row" ON public.waitlist_entries;
CREATE POLICY "Waitlist own row"
ON public.waitlist_entries FOR ALL
TO authenticated
USING (auth.uid() IS NOT NULL AND auth.uid() = user_id)
WITH CHECK (auth.uid() IS NOT NULL AND auth.uid() = user_id);

DROP POLICY IF EXISTS "Waitlist referrals own referrer" ON public.waitlist_referrals;
CREATE POLICY "Waitlist referrals own referrer"
ON public.waitlist_referrals FOR SELECT
TO authenticated
USING (auth.uid() IS NOT NULL AND (auth.uid() = referrer_user_id OR auth.uid() = referred_user_id));

DROP POLICY IF EXISTS "Conversation participants" ON public.conversations;
CREATE POLICY "Conversation participants"
ON public.conversations FOR ALL
TO authenticated
USING (auth.uid() IS NOT NULL AND auth.uid() IN (user1_id, user2_id))
WITH CHECK (auth.uid() IS NOT NULL AND auth.uid() IN (user1_id, user2_id));

DROP POLICY IF EXISTS "Message participants" ON public.messages;
CREATE POLICY "Message participants"
ON public.messages FOR SELECT
TO authenticated
USING (
    auth.uid() IS NOT NULL
    AND EXISTS (
        SELECT 1 FROM public.conversations c
        WHERE c.id = conversation_id
          AND auth.uid() IN (c.user1_id, c.user2_id)
    )
    AND (delivery_state <> 'flagged' OR auth.uid() = sender_user_id)
);

DROP POLICY IF EXISTS "Reports own reporter" ON public.reports;
CREATE POLICY "Reports own reporter"
ON public.reports FOR INSERT
TO authenticated
WITH CHECK (auth.uid() IS NOT NULL AND auth.uid() = reporter_user_id);

DROP POLICY IF EXISTS "Blocks own blocker" ON public.blocks;
CREATE POLICY "Blocks own blocker"
ON public.blocks FOR ALL
TO authenticated
USING (auth.uid() IS NOT NULL AND auth.uid() = blocker_user_id)
WITH CHECK (auth.uid() IS NOT NULL AND auth.uid() = blocker_user_id);

DROP POLICY IF EXISTS "Notifications own recipient" ON public.notifications;
CREATE POLICY "Notifications own recipient"
ON public.notifications FOR SELECT
TO authenticated
USING (auth.uid() IS NOT NULL AND auth.uid() = user_id);

DROP POLICY IF EXISTS "Notification preferences own row" ON public.notification_preferences;
CREATE POLICY "Notification preferences own row"
ON public.notification_preferences FOR ALL
TO authenticated
USING (auth.uid() IS NOT NULL AND auth.uid() = user_id)
WITH CHECK (auth.uid() IS NOT NULL AND auth.uid() = user_id);

DROP POLICY IF EXISTS "Notification push tokens own row" ON public.notification_push_tokens;
CREATE POLICY "Notification push tokens own row"
ON public.notification_push_tokens FOR ALL
TO authenticated
USING (auth.uid() IS NOT NULL AND auth.uid() = user_id)
WITH CHECK (auth.uid() IS NOT NULL AND auth.uid() = user_id);

DROP POLICY IF EXISTS "Appeals own row" ON public.appeals_queue;
CREATE POLICY "Appeals own row"
ON public.appeals_queue FOR INSERT
TO authenticated
WITH CHECK (auth.uid() IS NOT NULL AND auth.uid() = user_id);

DROP POLICY IF EXISTS "Pre-ban context own row" ON public.pre_ban_context_submissions;
CREATE POLICY "Pre-ban context own row"
ON public.pre_ban_context_submissions FOR INSERT
TO authenticated
WITH CHECK (auth.uid() IS NOT NULL AND auth.uid() = user_id);

DROP POLICY IF EXISTS "Data export own row" ON public.data_export_requests;
CREATE POLICY "Data export own row"
ON public.data_export_requests FOR ALL
TO authenticated
USING (auth.uid() IS NOT NULL AND auth.uid() = user_id)
WITH CHECK (auth.uid() IS NOT NULL AND auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.check_username_availability(p_username text)
RETURNS jsonb
LANGUAGE plpgsql
AS $$
DECLARE
    v_username text := lower(trim(p_username));
    v_taken boolean;
BEGIN
    IF v_username !~ '^[a-z][a-z0-9_]{2,19}$' THEN
        RETURN jsonb_build_object('status', 'invalid');
    END IF;

    IF v_username IN ('admin', 'support', 'deleted_user', 'moderator') THEN
        RETURN jsonb_build_object('status', 'banned');
    END IF;

    SELECT EXISTS (SELECT 1 FROM public.profiles WHERE username = v_username)
    INTO v_taken;

    RETURN jsonb_build_object('status', CASE WHEN v_taken THEN 'taken' ELSE 'available' END);
END;
$$;

CREATE OR REPLACE FUNCTION public.is_male_gender(p_gender text)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
AS $$
    SELECT lower(trim(COALESCE(p_gender, ''))) IN ('male', 'man', 'men');
$$;

CREATE OR REPLACE FUNCTION public.is_female_gender(p_gender text)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
AS $$
    SELECT lower(trim(COALESCE(p_gender, ''))) IN ('female', 'woman', 'women');
$$;

CREATE OR REPLACE FUNCTION public.should_waitlist_male_for_city(p_city text, p_state text DEFAULT NULL)
RETURNS boolean
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN public.should_waitlist_preference_for_city(p_city, p_state, 'long_term', 'women');
END;
$$;

CREATE OR REPLACE FUNCTION public.preference_demand_weight(p_preference text, p_pool text)
RETURNS numeric
LANGUAGE sql
IMMUTABLE
AS $$
    SELECT CASE
        WHEN lower(trim(COALESCE(p_preference, ''))) IN ('everyone', 'both', 'all', 'any') THEN 0.5
        WHEN p_pool = 'female_seekers'
            AND lower(trim(COALESCE(p_preference, ''))) IN ('women', 'female', 'woman') THEN 1
        WHEN p_pool = 'male_seekers'
            AND lower(trim(COALESCE(p_preference, ''))) IN ('men', 'male', 'man') THEN 1
        ELSE 0
    END;
$$;

CREATE OR REPLACE FUNCTION public.calculate_preference_waitlist_ratio(
    p_city text,
    p_state text DEFAULT NULL,
    p_dating_mode text DEFAULT 'long_term'
)
RETURNS jsonb
LANGUAGE plpgsql
AS $$
DECLARE
    v_female_seekers numeric := 0;
    v_male_seekers numeric := 0;
    v_threshold numeric := 1.3;
BEGIN
    SELECT
        COALESCE(sum(public.preference_demand_weight(gender_preference, 'female_seekers')), 0),
        COALESCE(sum(public.preference_demand_weight(gender_preference, 'male_seekers')), 0)
    INTO v_female_seekers, v_male_seekers
    FROM public.profiles
    WHERE city = p_city
      AND (p_state IS NULL OR state IS NOT DISTINCT FROM p_state)
      AND intention = p_dating_mode
      AND is_complete = true
      AND is_waitlisted = false
      AND is_banned = false
      AND is_visible = true
      AND last_active_at >= now() - interval '30 days'
      AND (auth.uid() IS NULL OR user_id <> auth.uid());

    RETURN jsonb_build_object(
        'female_seekers', v_female_seekers,
        'male_seekers', v_male_seekers,
        'ratio', v_female_seekers / GREATEST(v_male_seekers, 1),
        'threshold', v_threshold
    );
END;
$$;

CREATE OR REPLACE FUNCTION public.should_waitlist_preference_for_city(
    p_city text,
    p_state text DEFAULT NULL,
    p_dating_mode text DEFAULT 'long_term',
    p_gender_preference text DEFAULT NULL
)
RETURNS boolean
LANGUAGE plpgsql
AS $$
DECLARE
    v_ratio jsonb;
    v_female_seekers numeric;
    v_male_seekers numeric;
    v_incoming_female_weight numeric;
BEGIN
    v_incoming_female_weight := public.preference_demand_weight(p_gender_preference, 'female_seekers');
    IF v_incoming_female_weight = 0 THEN
        RETURN false;
    END IF;

    v_ratio := public.calculate_preference_waitlist_ratio(p_city, p_state, p_dating_mode);
    v_female_seekers := (v_ratio->>'female_seekers')::numeric;
    v_male_seekers := (v_ratio->>'male_seekers')::numeric;

    RETURN (v_female_seekers + v_incoming_female_weight) / GREATEST(v_male_seekers, 1) > 1.3;
END;
$$;

CREATE OR REPLACE FUNCTION public.preference_allows_gender(p_preference text, p_gender text)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
AS $$
    SELECT CASE
        WHEN lower(trim(COALESCE(p_preference, ''))) IN ('everyone', 'all', 'any') THEN true
        WHEN public.is_male_gender(p_gender) THEN lower(trim(COALESCE(p_preference, ''))) IN ('men', 'male', 'man')
        WHEN public.is_female_gender(p_gender) THEN lower(trim(COALESCE(p_preference, ''))) IN ('women', 'female', 'woman')
        ELSE lower(trim(COALESCE(p_preference, ''))) IN ('non-binary people', 'non-binary', 'nonbinary')
    END;
$$;

CREATE OR REPLACE FUNCTION public.complete_onboarding_profile(
    p_peer_id text,
    p_username text,
    p_display_name text,
    p_date_of_birth date,
    p_gender text,
    p_gender_preference text,
    p_intention text,
    p_city text,
    p_state text,
    p_bio text DEFAULT '',
    p_photo_paths text[] DEFAULT '{}'::text[]
)
RETURNS public.profiles
LANGUAGE plpgsql
AS $$
DECLARE
    v_profile public.profiles;
    v_photo_path text;
    v_slot integer := 1;
BEGIN
    IF auth.uid() IS NULL THEN
        RAISE EXCEPTION 'Authentication required';
    END IF;
    IF p_date_of_birth > (current_date - interval '18 years') THEN
        RAISE EXCEPTION 'User must be 18 or older';
    END IF;
    IF cardinality(p_photo_paths) < 2 THEN
        RAISE EXCEPTION 'At least two photos are required';
    END IF;

    INSERT INTO public.profiles (
        peer_id, user_id, username, display_name, date_of_birth, gender,
        gender_preference, intention, city, state, bio, is_complete,
        last_active_at, completeness_score, photos
    )
    VALUES (
        p_peer_id, auth.uid(), lower(p_username), p_display_name, p_date_of_birth,
        p_gender, p_gender_preference, p_intention, p_city, p_state,
        COALESCE(p_bio, ''), true, now(), 60, p_photo_paths
    )
    ON CONFLICT (peer_id)
    DO UPDATE SET
        user_id = auth.uid(),
        username = EXCLUDED.username,
        display_name = EXCLUDED.display_name,
        date_of_birth = EXCLUDED.date_of_birth,
        gender = EXCLUDED.gender,
        gender_preference = EXCLUDED.gender_preference,
        intention = EXCLUDED.intention,
        city = EXCLUDED.city,
        state = EXCLUDED.state,
        bio = EXCLUDED.bio,
        photos = EXCLUDED.photos,
        is_complete = true,
        last_active_at = now(),
        updated_at = now()
    RETURNING * INTO v_profile;

    DELETE FROM public.profile_photos
    WHERE user_id = auth.uid();

    FOREACH v_photo_path IN ARRAY p_photo_paths
    LOOP
        INSERT INTO public.profile_photos (
            user_id,
            peer_id,
            slot,
            image_path,
            thumbnail_path,
            is_primary
        )
        VALUES (
            auth.uid(),
            p_peer_id,
            v_slot,
            v_photo_path,
            v_photo_path,
            v_slot = 1
        );
        v_slot := v_slot + 1;
    END LOOP;

    INSERT INTO public.onboarding_progress (user_id, current_step, completed_steps)
    VALUES (auth.uid(), 'complete', ARRAY['phone', 'profile'])
    ON CONFLICT (user_id)
    DO UPDATE SET current_step = 'complete',
                  completed_steps = ARRAY['phone', 'profile'],
                  updated_at = now();

    UPDATE public.profiles
    SET theme_mode = CASE
            WHEN p_intention = 'short_term' THEN 'bold'
            ELSE 'calm'
        END
    WHERE user_id = auth.uid();

    IF public.should_waitlist_preference_for_city(p_city, p_state, p_intention, p_gender_preference) THEN
        PERFORM public.join_waitlist(p_city, p_state, p_intention);
    ELSE
        UPDATE public.profiles
        SET is_waitlisted = false,
            updated_at = now()
        WHERE user_id = auth.uid();

        PERFORM public.admit_waitlisted_users_for_city(p_city, p_state, p_intention);
    END IF;

    SELECT * INTO v_profile
    FROM public.profiles
    WHERE user_id = auth.uid();

    RETURN v_profile;
END;
$$;

CREATE OR REPLACE FUNCTION public.change_sensitive_profile_field(
    p_field text,
    p_value text,
    p_warning_acknowledged boolean
)
RETURNS jsonb
LANGUAGE plpgsql
AS $$
DECLARE
    v_profile public.profiles;
    v_old_dating_mode text;
    v_new_dating_mode text;
    v_conversations_closed integer := 0;
    v_messages_archived integer := 0;
    v_waitlist_rows_retired integer := 0;
    v_waitlist_entry_retired boolean := false;
    v_new_mode_waitlisted boolean := false;
BEGIN
    IF auth.uid() IS NULL THEN
        RAISE EXCEPTION 'Authentication required';
    END IF;
    IF NOT p_warning_acknowledged THEN
        RAISE EXCEPTION 'Warning acknowledgement required';
    END IF;
    IF p_field NOT IN ('intention', 'gender', 'gender_preference') THEN
        RAISE EXCEPTION 'Unsupported sensitive field';
    END IF;

    SELECT * INTO v_profile
    FROM public.profiles
    WHERE user_id = auth.uid()
    FOR UPDATE;

    IF v_profile.user_id IS NULL THEN
        RAISE EXCEPTION 'Profile not found';
    END IF;

    v_old_dating_mode := v_profile.intention;
    v_new_dating_mode := CASE WHEN p_field = 'intention' THEN p_value ELSE v_old_dating_mode END;

    IF v_new_dating_mode NOT IN ('long_term', 'short_term') THEN
        RAISE EXCEPTION 'Invalid dating mode';
    END IF;

    UPDATE public.profiles
    SET intention = CASE WHEN p_field = 'intention' THEN p_value ELSE intention END,
        gender = CASE WHEN p_field = 'gender' THEN p_value ELSE gender END,
        gender_preference = CASE WHEN p_field = 'gender_preference' THEN p_value ELSE gender_preference END,
        theme_mode = CASE
            WHEN p_field = 'intention' AND p_value = 'short_term' THEN 'bold'
            WHEN p_field = 'intention' THEN 'calm'
            ELSE theme_mode
        END,
        feed_invalidated_at = now(),
        updated_at = now()
    WHERE user_id = auth.uid()
    RETURNING * INTO v_profile;

    UPDATE public.conversations c
    SET status = 'closed',
        closed_at = now(),
        updated_at = now()
    WHERE status IN ('pending', 'active', 'locked')
      AND dating_mode = v_old_dating_mode
      AND auth.uid() IN (user1_id, user2_id);
    GET DIAGNOSTICS v_conversations_closed = ROW_COUNT;

    UPDATE public.messages
    SET archived_at = now()
    WHERE conversation_id IN (
        SELECT id FROM public.conversations
        WHERE auth.uid() IN (user1_id, user2_id)
          AND dating_mode = v_old_dating_mode
    )
      AND dating_mode = v_old_dating_mode;
    GET DIAGNOSTICS v_messages_archived = ROW_COUNT;

    DELETE FROM public.feed_impressions
    WHERE viewer_user_id = auth.uid()
      AND dating_mode = v_old_dating_mode;

    DELETE FROM public.feed_filters
    WHERE user_id = auth.uid()
      AND dating_mode = v_old_dating_mode;

    UPDATE public.waitlist_entries
    SET status = 'left',
        left_at = now()
    WHERE user_id = auth.uid()
      AND dating_mode = v_old_dating_mode
      AND status = 'waiting';
    GET DIAGNOSTICS v_waitlist_rows_retired = ROW_COUNT;
    v_waitlist_entry_retired := v_waitlist_rows_retired > 0;

    IF p_field = 'intention' AND v_new_dating_mode <> v_old_dating_mode THEN
        IF public.should_waitlist_preference_for_city(v_profile.city, v_profile.state, v_new_dating_mode, v_profile.gender_preference) THEN
            PERFORM public.join_waitlist(v_profile.city, v_profile.state, v_new_dating_mode);
            v_new_mode_waitlisted := true;
        ELSE
            UPDATE public.profiles
            SET is_waitlisted = false,
                updated_at = now()
            WHERE user_id = auth.uid();

            PERFORM public.admit_waitlisted_users_for_city(v_profile.city, v_profile.state, v_new_dating_mode);
        END IF;
    END IF;

    INSERT INTO public.admin_actions (actor_user_id, target_user_id, action_type, metadata)
    VALUES (
        auth.uid(),
        auth.uid(),
        'sensitive_profile_change',
        jsonb_build_object(
            'field', p_field,
            'peer_id', v_profile.peer_id,
            'old_dating_mode', v_old_dating_mode,
            'new_dating_mode', v_new_dating_mode,
            'conversations_closed', v_conversations_closed,
            'messages_archived', v_messages_archived,
            'waitlist_entry_retired', v_waitlist_entry_retired,
            'new_mode_waitlisted', v_new_mode_waitlisted,
            'timestamp', now()
        )
    );

    RETURN jsonb_build_object(
        'success', true,
        'field', p_field,
        'old_dating_mode', v_old_dating_mode,
        'new_dating_mode', v_new_dating_mode,
        'conversations_closed', v_conversations_closed,
        'messages_archived', v_messages_archived,
        'waitlist_entry_retired', v_waitlist_entry_retired,
        'new_mode_waitlisted', v_new_mode_waitlisted
    );
END;
$$;

CREATE OR REPLACE FUNCTION public.calculate_profile_completeness(
    p_bio text,
    p_photos text[],
    p_city text
)
RETURNS integer
LANGUAGE sql
IMMUTABLE
AS $$
    SELECT LEAST(
        100,
        (CASE WHEN char_length(trim(coalesce(p_bio, ''))) > 0 THEN 20 ELSE 0 END)
        + LEAST(coalesce(array_length(p_photos, 1), 0), 6) * 10
        + (CASE WHEN char_length(trim(coalesce(p_city, ''))) > 0 THEN 20 ELSE 0 END)
        + (CASE WHEN coalesce(array_length(p_photos, 1), 0) >= 2 THEN 20 ELSE 0 END)
    );
$$;

CREATE OR REPLACE FUNCTION public.update_profile_public_fields(
    p_bio text DEFAULT NULL,
    p_photo_paths text[] DEFAULT NULL,
    p_display_preferences jsonb DEFAULT NULL,
    p_is_visible boolean DEFAULT NULL
)
RETURNS public.profiles
LANGUAGE plpgsql
AS $$
DECLARE
    v_profile public.profiles;
    v_next_photos text[];
BEGIN
    IF auth.uid() IS NULL THEN
        RAISE EXCEPTION 'Authentication required';
    END IF;

    SELECT * INTO v_profile
    FROM public.profiles
    WHERE user_id = auth.uid()
    FOR UPDATE;

    IF v_profile.user_id IS NULL THEN
        RAISE EXCEPTION 'Profile not found';
    END IF;

    v_next_photos := COALESCE(p_photo_paths, v_profile.photos);

    IF coalesce(array_length(v_next_photos, 1), 0) < 2 THEN
        RAISE EXCEPTION 'At least two photos are required';
    END IF;

    UPDATE public.profiles
    SET bio = COALESCE(p_bio, bio),
        photos = v_next_photos,
        display_preferences = COALESCE(p_display_preferences, display_preferences),
        is_visible = COALESCE(p_is_visible, is_visible),
        completeness_score = public.calculate_profile_completeness(
            COALESCE(p_bio, bio),
            v_next_photos,
            city
        ),
        updated_at = now()
    WHERE user_id = auth.uid()
    RETURNING * INTO v_profile;

    RETURN v_profile;
END;
$$;

CREATE OR REPLACE FUNCTION public.change_username(p_username text)
RETURNS public.profiles
LANGUAGE plpgsql
AS $$
DECLARE
    v_username text := lower(trim(p_username));
    v_profile public.profiles;
BEGIN
    IF auth.uid() IS NULL THEN
        RAISE EXCEPTION 'Authentication required';
    END IF;

    SELECT * INTO v_profile
    FROM public.profiles
    WHERE user_id = auth.uid()
    FOR UPDATE;

    IF v_profile.username_changed_at IS NOT NULL
       AND v_profile.username_changed_at > now() - interval '30 days' THEN
        RAISE EXCEPTION 'Username can only be changed once every 30 days';
    END IF;

    IF v_username !~ '^[a-z][a-z0-9_]{2,19}$'
       OR v_username IN ('admin', 'support', 'deleted_user', 'moderator') THEN
        RAISE EXCEPTION 'Invalid username';
    END IF;

    IF EXISTS (
        SELECT 1 FROM public.profiles
        WHERE username = v_username
          AND user_id <> auth.uid()
    ) THEN
        RAISE EXCEPTION 'Username is taken';
    END IF;

    UPDATE public.profiles
    SET username = v_username,
        username_changed_at = now(),
        updated_at = now()
    WHERE user_id = auth.uid()
    RETURNING * INTO v_profile;

    RETURN v_profile;
END;
$$;

CREATE OR REPLACE FUNCTION public.request_city_change(
    p_city text,
    p_state text DEFAULT NULL
)
RETURNS public.profiles
LANGUAGE plpgsql
AS $$
DECLARE
    v_profile public.profiles;
BEGIN
    IF auth.uid() IS NULL THEN
        RAISE EXCEPTION 'Authentication required';
    END IF;

    UPDATE public.profiles
    SET pending_city = trim(p_city),
        pending_state = nullif(trim(coalesce(p_state, '')), ''),
        city_change_effective_at = now() + interval '1 hour',
        updated_at = now()
    WHERE user_id = auth.uid()
    RETURNING * INTO v_profile;

    INSERT INTO public.admin_actions (actor_user_id, target_user_id, action_type, metadata)
    VALUES (
        auth.uid(),
        auth.uid(),
        'city_change_requested',
        jsonb_build_object('city', p_city, 'state', p_state, 'effective_at', v_profile.city_change_effective_at)
    );

    RETURN v_profile;
END;
$$;

CREATE OR REPLACE FUNCTION public.apply_due_city_changes()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_count integer;
BEGIN
    UPDATE public.profiles
    SET city = pending_city,
        state = pending_state,
        pending_city = NULL,
        pending_state = NULL,
        city_change_effective_at = NULL,
        completeness_score = public.calculate_profile_completeness(bio, photos, pending_city),
        feed_invalidated_at = now(),
        updated_at = now()
    WHERE pending_city IS NOT NULL
      AND city_change_effective_at <= now();

    GET DIAGNOSTICS v_count = ROW_COUNT;
    RETURN v_count;
END;
$$;

CREATE OR REPLACE FUNCTION public.current_dating_mode()
RETURNS text
LANGUAGE sql
STABLE
AS $$
    SELECT intention
    FROM public.profiles
    WHERE user_id = auth.uid()
    LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.discover_profiles(
    p_limit integer DEFAULT 20,
    p_city text DEFAULT NULL,
    p_min_age integer DEFAULT NULL,
    p_max_age integer DEFAULT NULL,
    p_session_id text DEFAULT NULL,
    p_dating_mode text DEFAULT NULL
)
RETURNS TABLE(
    peer_id text,
    display_name text,
    birth_date date,
    city text,
    photos text[],
    profile_prompt text,
    last_seen_at timestamptz,
    created_at timestamptz
)
LANGUAGE sql
AS $$
    WITH viewer AS (
      SELECT *
      FROM public.profiles
      WHERE user_id = auth.uid()
        AND (p_dating_mode IS NULL OR intention = p_dating_mode)
      LIMIT 1
    ),
    eligible AS (
      SELECT
        target.user_id,
        target.peer_id,
        target.display_name,
        target.date_of_birth AS birth_date,
        target.city,
        target.state AS target_state,
        ARRAY_REMOVE(ARRAY[target.photos[1]], NULL)::text[] AS photos,
        target.bio AS profile_prompt,
        target.last_active_at AS last_seen_at,
        target.created_at,
        (
          (p_min_age IS NULL OR date_part('year', age(target.date_of_birth)) >= p_min_age)
          AND (p_max_age IS NULL OR date_part('year', age(target.date_of_birth)) <= p_max_age)
        ) AS preferred_age_match,
        NOT EXISTS (
          SELECT 1
          FROM public.feed_impressions fi
          WHERE fi.viewer_user_id = auth.uid()
            AND fi.dating_mode = viewer.intention
            AND fi.viewed_user_id = target.user_id
            AND fi.session_id = COALESCE(p_session_id, '')
        ) AS unseen_this_session,
        target.completeness_score,
        viewer.city AS viewer_city,
        viewer.state AS viewer_state
      FROM viewer
      JOIN public.profiles target
        ON target.user_id <> viewer.user_id
       AND target.intention = viewer.intention
       AND public.preference_allows_gender(viewer.gender_preference, target.gender)
       AND public.preference_allows_gender(target.gender_preference, viewer.gender)
       AND target.is_complete = true
       AND target.is_waitlisted = false
       AND target.is_visible = true
       AND target.is_banned = false
       AND target.last_active_at >= now() - interval '30 days'
      WHERE (p_city IS NULL OR p_city = '' OR target.city = p_city)
        AND (p_min_age IS NULL OR date_part('year', age(target.date_of_birth)) >= p_min_age)
        AND (p_max_age IS NULL OR date_part('year', age(target.date_of_birth)) <= p_max_age)
        AND (
          p_session_id IS NULL OR NOT EXISTS (
            SELECT 1
            FROM public.feed_impressions fi
            WHERE fi.viewer_user_id = auth.uid()
              AND fi.dating_mode = viewer.intention
              AND fi.viewed_user_id = target.user_id
              AND fi.session_id = p_session_id
          )
        )
        AND NOT EXISTS (
          SELECT 1 FROM public.blocks b
          WHERE (b.blocker_user_id = auth.uid() AND b.blocked_user_id = target.user_id)
             OR (b.blocked_user_id = auth.uid() AND b.blocker_user_id = target.user_id)
        )
        AND NOT EXISTS (
          SELECT 1 FROM public.reports r
          WHERE (r.reporter_user_id = auth.uid() AND r.reported_user_id = target.user_id)
             OR (r.reported_user_id = auth.uid() AND r.reporter_user_id = target.user_id)
        )
    ),
    page AS (
      SELECT *
      FROM eligible
      ORDER BY
        (city = viewer_city) DESC,
        (target_state = viewer_state) DESC,
        preferred_age_match DESC,
        unseen_this_session DESC,
        last_seen_at DESC,
        (created_at >= now() - interval '7 days') DESC,
        completeness_score DESC
      LIMIT COALESCE(p_limit, 20)
    ),
    recorded AS (
      INSERT INTO public.feed_impressions (viewer_user_id, dating_mode, viewed_user_id, viewed_peer_id, session_id)
      SELECT auth.uid(), viewer.intention, user_id, peer_id, COALESCE(p_session_id, 'default')
      FROM page
      CROSS JOIN viewer
      WHERE auth.uid() IS NOT NULL
      RETURNING id
    )
    SELECT
      page.peer_id,
      page.display_name,
      page.birth_date,
      page.city,
      page.photos,
      page.profile_prompt,
      page.last_seen_at,
      page.created_at
    FROM page;
$$;

CREATE OR REPLACE FUNCTION public.discover_waitlist_preview(
    p_limit integer DEFAULT 20,
    p_dating_mode text DEFAULT NULL
)
RETURNS TABLE(label text, age_bucket text, city text, intention text)
LANGUAGE sql
AS $$
    WITH viewer AS (
      SELECT public.current_dating_mode() AS intention
      WHERE p_dating_mode IS NULL OR p_dating_mode = public.current_dating_mode()
    )
    SELECT
      'Someone nearby'::text AS label,
      CASE
        WHEN date_part('year', age(p.date_of_birth)) < 30 THEN '20s'
        WHEN date_part('year', age(p.date_of_birth)) < 40 THEN '30s'
        ELSE '40+'
      END AS age_bucket,
      p.city,
      p.intention
    FROM viewer
    JOIN public.profiles p
      ON p.intention = viewer.intention
    WHERE p.is_complete = true
      AND p.is_waitlisted = false
      AND p.is_visible = true
      AND p.is_banned = false
      AND p.last_active_at >= now() - interval '30 days'
    LIMIT COALESCE(p_limit, 20);
$$;

CREATE OR REPLACE FUNCTION public.join_waitlist(
    p_city text,
    p_state text DEFAULT NULL,
    p_dating_mode text DEFAULT 'long_term'
)
RETURNS public.waitlist_entries
LANGUAGE plpgsql
AS $$
DECLARE
    v_profile public.profiles;
    v_entry public.waitlist_entries;
    v_position integer;
    v_dating_mode text;
BEGIN
    IF auth.uid() IS NULL THEN
        RAISE EXCEPTION 'Authentication required';
    END IF;

    SELECT * INTO v_profile FROM public.profiles WHERE user_id = auth.uid();
    IF v_profile.user_id IS NULL THEN
        RAISE EXCEPTION 'Profile required before waitlist entry';
    END IF;

    v_dating_mode := COALESCE(NULLIF(p_dating_mode, ''), v_profile.intention);
    IF v_dating_mode NOT IN ('long_term', 'short_term') THEN
        RAISE EXCEPTION 'Invalid dating mode';
    END IF;

    PERFORM pg_advisory_xact_lock(hashtext('waitlist_city_queue:' || lower(trim(p_city)) || ':' || COALESCE(lower(trim(p_state)), '') || ':' || v_dating_mode));

    SELECT COALESCE(max(queue_position), 0) + 1 INTO v_position
    FROM public.waitlist_entries
    WHERE city = p_city
      AND (p_state IS NULL OR state IS NOT DISTINCT FROM p_state)
      AND dating_mode = v_dating_mode
      AND status = 'waiting';

    INSERT INTO public.waitlist_entries (user_id, peer_id, city, state, gender, gender_preference, queue_position, dating_mode)
    VALUES (
        auth.uid(),
        v_profile.peer_id,
        p_city,
        p_state,
        v_profile.gender,
        v_profile.gender_preference,
        v_position,
        COALESCE(NULLIF(p_dating_mode, ''), v_profile.intention)
    )
    ON CONFLICT (user_id)
    DO UPDATE SET status = 'waiting',
                  city = EXCLUDED.city,
                  state = EXCLUDED.state,
                  dating_mode = EXCLUDED.dating_mode,
                  gender_preference = EXCLUDED.gender_preference,
                  queue_position = EXCLUDED.queue_position,
                  joined_at = now(),
                  admitted_at = NULL,
                  left_at = NULL
    RETURNING * INTO v_entry;

    UPDATE public.profiles SET is_waitlisted = true WHERE user_id = auth.uid();
    RETURN v_entry;
END;
$$;

CREATE OR REPLACE FUNCTION public.leave_waitlist()
RETURNS jsonb
LANGUAGE plpgsql
AS $$
BEGIN
    UPDATE public.waitlist_entries
    SET status = 'left', left_at = now()
    WHERE user_id = auth.uid() AND status = 'waiting';

    UPDATE public.profiles SET is_waitlisted = false WHERE user_id = auth.uid();
    RETURN jsonb_build_object('success', true);
END;
$$;

CREATE OR REPLACE FUNCTION public.apply_waitlist_referral(p_referrer_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
AS $$
DECLARE
    v_referred_profile public.profiles;
    v_referrer_entry public.waitlist_entries;
    v_inserted_referrals integer := 0;
BEGIN
    IF auth.uid() IS NULL THEN
        RAISE EXCEPTION 'Authentication required';
    END IF;

    SELECT * INTO v_referred_profile
    FROM public.profiles
    WHERE user_id = auth.uid();

    IF v_referred_profile.user_id IS NULL
       OR NOT (v_referred_profile.is_complete = true)
       OR public.preference_demand_weight(v_referred_profile.gender_preference, 'male_seekers') = 0 THEN
        RETURN jsonb_build_object('success', false, 'boost', 0, 'reason', 'completed_underrepresented_preference_signup_required');
    END IF;

    PERFORM pg_advisory_xact_lock(hashtext('waitlist_referral_bump'));

    SELECT * INTO v_referrer_entry
    FROM public.waitlist_entries
    WHERE user_id = p_referrer_user_id
      AND status = 'waiting'
      AND dating_mode = v_referred_profile.intention
    FOR UPDATE;

    IF v_referrer_entry.id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'boost', 0, 'reason', 'referrer_not_waitlisted_in_same_mode');
    END IF;

    IF NOT (v_referrer_entry.dating_mode = v_referred_profile.intention) THEN
        RETURN jsonb_build_object('success', false, 'boost', 0, 'reason', 'referrer_not_waitlisted_in_same_mode');
    END IF;

    INSERT INTO public.waitlist_referrals (referrer_user_id, referred_user_id, dating_mode, city)
    VALUES (p_referrer_user_id, auth.uid(), v_referred_profile.intention, v_referred_profile.city)
    ON CONFLICT (referred_user_id) DO NOTHING;
    GET DIAGNOSTICS v_inserted_referrals = ROW_COUNT;

    IF v_inserted_referrals = 0 THEN
        RETURN jsonb_build_object('success', true, 'boost', 0, 'already_applied', true);
    END IF;

    UPDATE public.waitlist_entries
    SET queue_position = GREATEST(1, queue_position - 5)
    WHERE user_id = p_referrer_user_id
      AND dating_mode = v_referred_profile.intention
      AND status = 'waiting';

    INSERT INTO public.notifications (user_id, dating_mode, category, title, body, status)
    VALUES (
        auth.uid(),
        v_referred_profile.intention,
        'waitlist',
        'Referral applied',
        'Thanks for helping someone move up the waitlist.',
        'queued'
    );

    RETURN jsonb_build_object('success', true, 'boost', 5);
END;
$$;

CREATE OR REPLACE FUNCTION public.admit_waitlisted_users_for_city(
    p_city text,
    p_state text DEFAULT NULL,
    p_dating_mode text DEFAULT 'long_term'
)
RETURNS integer
LANGUAGE plpgsql
AS $$
DECLARE
    v_count integer := 0;
    v_entry record;
    v_female_seekers numeric := 0;
    v_male_seekers numeric := 0;
    v_incoming_weight numeric := 0;
    v_ratio jsonb;
BEGIN
    PERFORM pg_advisory_xact_lock(hashtext('waitlist_city_queue:' || lower(trim(p_city)) || ':' || COALESCE(lower(trim(p_state)), '') || ':' || p_dating_mode));

    v_ratio := public.calculate_preference_waitlist_ratio(p_city, p_state, p_dating_mode);
    v_female_seekers := (v_ratio->>'female_seekers')::numeric;
    v_male_seekers := (v_ratio->>'male_seekers')::numeric;

    LOOP
        SELECT *
        INTO v_entry
        FROM public.waitlist_entries
        WHERE city = p_city
          AND (p_state IS NULL OR state IS NOT DISTINCT FROM p_state)
          AND dating_mode = p_dating_mode
          AND status = 'waiting'
          AND public.preference_demand_weight(gender_preference, 'female_seekers') > 0
        ORDER BY queue_position ASC, joined_at ASC
        LIMIT 1
        FOR UPDATE SKIP LOCKED;

        IF v_entry.id IS NULL THEN
            EXIT;
        END IF;

        v_incoming_weight := public.preference_demand_weight(v_entry.gender_preference, 'female_seekers');
        IF (v_female_seekers + v_incoming_weight) / GREATEST(v_male_seekers, 1) > 1.3 THEN
            EXIT;
        END IF;

        UPDATE public.waitlist_entries
        SET status = 'admitted', admitted_at = now()
        WHERE id = v_entry.id;

        UPDATE public.profiles
        SET is_waitlisted = false,
            updated_at = now()
        WHERE user_id = v_entry.user_id;

        INSERT INTO public.notifications (user_id, category, title, body, status)
        VALUES (
            v_entry.user_id,
            'waitlist',
            'Your account is now active',
            'You are now in.',
            'queued'
        );

        v_female_seekers := v_female_seekers + v_incoming_weight;
        v_count := v_count + 1;
    END LOOP;

    RETURN v_count;
END;
$$;

DROP FUNCTION IF EXISTS public.send_opening_message(uuid, text);

CREATE OR REPLACE FUNCTION public.send_opening_message(p_recipient_peer_id text, p_content text)
RETURNS jsonb
LANGUAGE plpgsql
AS $$
DECLARE
    v_sender public.profiles;
    v_recipient public.profiles;
    v_existing public.conversations;
    v_conversation_id uuid;
    v_message_id uuid;
BEGIN
    IF auth.uid() IS NULL THEN
        RAISE EXCEPTION 'Authentication required';
    END IF;

    IF char_length(trim(p_content)) NOT BETWEEN 1 AND 500 THEN
        RAISE EXCEPTION 'Message must be 1-500 characters';
    END IF;

    SELECT * INTO v_sender
    FROM public.profiles
    WHERE user_id = auth.uid();

    IF v_sender.user_id IS NULL OR v_sender.is_banned = true THEN
        RAISE EXCEPTION 'Sender account is not in good standing';
    END IF;

    IF v_sender.message_banned_until IS NOT NULL AND v_sender.message_banned_until > now() THEN
        RAISE EXCEPTION 'Sender is temporarily banned from messaging';
    END IF;

    IF v_sender.messages_sent_today >= 10 THEN
        RAISE EXCEPTION 'Daily message limit reached';
    END IF;

    SELECT * INTO v_recipient
    FROM public.profiles
    WHERE peer_id = p_recipient_peer_id
      AND user_id IS NOT NULL;

    IF v_recipient.user_id IS NULL OR v_recipient.user_id = auth.uid() THEN
        RAISE EXCEPTION 'Recipient profile not found';
    END IF;

    IF v_recipient.intention <> v_sender.intention THEN
        RAISE EXCEPTION 'Recipient is not in your active dating mode';
    END IF;

    SELECT * INTO v_existing
    FROM public.conversations
    WHERE user1_id = LEAST(auth.uid(), v_recipient.user_id)
      AND user2_id = GREATEST(auth.uid(), v_recipient.user_id)
      AND dating_mode = v_sender.intention
    LIMIT 1;

    IF v_existing.status = 'pending' THEN
        RAISE EXCEPTION 'Pending conversation already exists';
    END IF;

    IF v_existing.status IN ('active', 'locked') THEN
        RAISE EXCEPTION 'Conversation already active';
    END IF;

    IF v_existing.status = 'expired'
       AND v_existing.expired_at > now() - interval '7 days' THEN
        RAISE EXCEPTION 'Retry is available seven days after expiry';
    END IF;

    DELETE FROM public.conversations
    WHERE id = v_existing.id
      AND v_existing.status = 'expired'
      AND v_existing.expired_at <= now() - interval '7 days';

    INSERT INTO public.conversations (
        user1_id,
        user2_id,
        user1_peer_id,
        user2_peer_id,
        dating_mode,
        opening_sender_id,
        status,
        last_message_at
    )
    VALUES (
        LEAST(auth.uid(), v_recipient.user_id),
        GREATEST(auth.uid(), v_recipient.user_id),
        CASE WHEN auth.uid() < v_recipient.user_id THEN v_sender.peer_id ELSE v_recipient.peer_id END,
        CASE WHEN auth.uid() < v_recipient.user_id THEN v_recipient.peer_id ELSE v_sender.peer_id END,
        v_sender.intention,
        auth.uid(),
        'pending',
        now()
    )
    RETURNING id INTO v_conversation_id;

    INSERT INTO public.messages (conversation_id, sender_user_id, recipient_user_id, dating_mode, content, delivery_state)
    VALUES (v_conversation_id, auth.uid(), v_recipient.user_id, v_sender.intention, trim(p_content), 'sent')
    RETURNING id INTO v_message_id;

    INSERT INTO public.message_moderation_queue (message_id, dating_mode)
    VALUES (v_message_id, v_sender.intention)
    ON CONFLICT (message_id) DO UPDATE
    SET status = 'queued',
        next_attempt_at = now(),
        updated_at = now();

    UPDATE public.profiles
    SET messages_sent_today = messages_sent_today + 1,
        updated_at = now()
    WHERE user_id = auth.uid();

    RETURN jsonb_build_object('success', true, 'conversation_id', v_conversation_id, 'message_id', v_message_id);
END;
$$;

CREATE OR REPLACE FUNCTION public.send_chat_message(p_conversation_id uuid, p_content text)
RETURNS jsonb
LANGUAGE plpgsql
AS $$
DECLARE
    v_conversation public.conversations;
    v_sender public.profiles;
    v_recipient uuid;
    v_message_id uuid;
BEGIN
    IF auth.uid() IS NULL THEN
        RAISE EXCEPTION 'Authentication required';
    END IF;

    IF char_length(trim(p_content)) NOT BETWEEN 1 AND 500 THEN
        RAISE EXCEPTION 'Message must be 1-500 characters';
    END IF;

    SELECT * INTO v_sender
    FROM public.profiles
    WHERE user_id = auth.uid();

    IF v_sender.user_id IS NULL OR v_sender.is_banned = true THEN
        RAISE EXCEPTION 'Sender account is not in good standing';
    END IF;

    IF v_sender.message_banned_until IS NOT NULL AND v_sender.message_banned_until > now() THEN
        RAISE EXCEPTION 'Sender is temporarily banned from messaging';
    END IF;

    IF v_sender.messages_sent_today >= 10 THEN
        RAISE EXCEPTION 'Daily message limit reached';
    END IF;

    SELECT * INTO v_conversation
    FROM public.conversations
    WHERE id = p_conversation_id
      AND auth.uid() IN (user1_id, user2_id);

    IF v_conversation.id IS NULL THEN
        RAISE EXCEPTION 'Conversation not found';
    END IF;

    IF v_conversation.status NOT IN ('pending', 'active') THEN
        RAISE EXCEPTION 'Conversation is not open for messages';
    END IF;

    IF NOT (v_conversation.dating_mode = v_sender.intention) THEN
        RAISE EXCEPTION 'Conversation is not in your active dating mode';
    END IF;

    IF v_conversation.status = 'pending' AND opening_sender_id = auth.uid() THEN
        RAISE EXCEPTION 'Wait for the recipient to reply';
    END IF;

    SELECT CASE WHEN v_conversation.user1_id = auth.uid() THEN v_conversation.user2_id ELSE v_conversation.user1_id END
    INTO v_recipient;

    INSERT INTO public.messages (conversation_id, sender_user_id, recipient_user_id, dating_mode, content, delivery_state)
    VALUES (p_conversation_id, auth.uid(), v_recipient, v_conversation.dating_mode, trim(p_content), 'sent')
    RETURNING id INTO v_message_id;

    INSERT INTO public.message_moderation_queue (message_id, dating_mode)
    VALUES (v_message_id, v_conversation.dating_mode)
    ON CONFLICT (message_id) DO UPDATE
    SET status = 'queued',
        next_attempt_at = now(),
        updated_at = now();

    UPDATE public.conversations
    SET last_message_at = now(),
        updated_at = now()
    WHERE id = p_conversation_id;

    UPDATE public.profiles
    SET messages_sent_today = messages_sent_today + 1,
        updated_at = now()
    WHERE user_id = auth.uid();

    RETURN jsonb_build_object('success', true, 'conversation_id', p_conversation_id, 'message_id', v_message_id);
END;
$$;

CREATE OR REPLACE FUNCTION public.apply_message_moderation(
    p_message_id uuid,
    p_verdict text,
    p_categories jsonb DEFAULT '{}'::jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_message public.messages;
    v_conversation public.conversations;
    v_verdict text := lower(trim(p_verdict));
    v_strike_delta integer;
    v_new_warning_count integer;
BEGIN
    IF v_verdict NOT IN ('safe', 'warn', 'block') THEN
        RAISE EXCEPTION 'Invalid moderation verdict';
    END IF;

    SELECT * INTO v_message
    FROM public.messages
    WHERE id = p_message_id
    FOR UPDATE;

    IF v_message.id IS NULL THEN
        RAISE EXCEPTION 'Message not found';
    END IF;

    v_strike_delta := CASE WHEN v_verdict IN ('warn', 'block') THEN 1 ELSE 0 END;

    UPDATE public.messages
    SET delivery_state = CASE WHEN v_verdict = 'block' THEN 'flagged' ELSE 'delivered' END,
        moderation_verdict = v_verdict,
        delivered_at = CASE WHEN v_verdict = 'block' THEN NULL ELSE now() END
    WHERE id = p_message_id;

    INSERT INTO public.moderation_events (
        user_id,
        message_id,
        dating_mode,
        verdict,
        categories,
        strike_delta
    )
    VALUES (
        v_message.sender_user_id,
        p_message_id,
        v_message.dating_mode,
        v_verdict,
        COALESCE(p_categories, '{}'::jsonb),
        CASE WHEN v_verdict IN ('warn', 'block') THEN 1 ELSE 0 END
    );

    IF v_strike_delta > 0 THEN
        UPDATE public.profiles
        SET warning_count = warning_count + v_strike_delta,
            updated_at = now()
        WHERE user_id = v_message.sender_user_id
        RETURNING warning_count INTO v_new_warning_count;

        IF v_new_warning_count >= 10 THEN
            UPDATE public.profiles
            SET is_banned = true,
                updated_at = now()
            WHERE user_id = v_message.sender_user_id;

            INSERT INTO public.notifications (user_id, category, title, body, status)
            VALUES (
                v_message.sender_user_id,
                'account_security',
                'Your account has been permanently banned',
                'Your messages repeatedly violated community guidelines.',
                'queued'
            );
        ELSIF v_new_warning_count >= 8 THEN
            UPDATE public.profiles
            SET message_banned_until = now() + interval '7 days',
                updated_at = now()
            WHERE user_id = v_message.sender_user_id;

            INSERT INTO public.notifications (user_id, category, title, body, status)
            VALUES (
                v_message.sender_user_id,
                'account_security',
                'Your account has been temporarily suspended',
                'You cannot send messages for 7 days because messages were flagged.',
                'queued'
            );
        ELSIF v_new_warning_count >= 5 THEN
            UPDATE public.profiles
            SET message_banned_until = now() + interval '24 hours',
                updated_at = now()
            WHERE user_id = v_message.sender_user_id;

            INSERT INTO public.notifications (user_id, category, title, body, status)
            VALUES (
                v_message.sender_user_id,
                'account_security',
                'Your account has been temporarily suspended',
                'You cannot send messages for 24 hours because messages were flagged.',
                'queued'
            );
        ELSIF v_new_warning_count = 3 THEN
            INSERT INTO public.notifications (user_id, category, title, body, status)
            VALUES (
                v_message.sender_user_id,
                'account_security',
                'Your account has been flagged',
                'Your messages have been flagged. Further violations may result in a ban.',
                'queued'
            );
        END IF;
    END IF;

    SELECT * INTO v_conversation
    FROM public.conversations
    WHERE id = v_message.conversation_id
    FOR UPDATE;

    IF v_verdict <> 'block' AND v_conversation.status = 'pending' THEN
        IF v_conversation.opening_sender_id = v_message.sender_user_id THEN
            UPDATE public.conversations
            SET delivered_at = COALESCE(delivered_at, now()),
                pending_expires_at = COALESCE(pending_expires_at, now() + interval '3 days'),
                updated_at = now()
            WHERE id = v_conversation.id;
        ELSE
            UPDATE public.conversations
            SET status = 'active',
                updated_at = now()
            WHERE id = v_conversation.id;
        END IF;
    END IF;

    IF v_verdict = 'block' THEN
        INSERT INTO public.notifications (user_id, category, title, body, status)
        VALUES (
            v_message.sender_user_id,
            'account_security',
            'Your message could not be sent',
            'Your message could not be sent because it violated community guidelines.',
            'queued'
        );
    END IF;

    UPDATE public.message_moderation_queue
    SET status = 'processed',
        processed_at = now(),
        updated_at = now()
    WHERE message_id = p_message_id;

    RETURN jsonb_build_object(
        'success', true,
        'message_id', p_message_id,
        'verdict', v_verdict,
        'delivery_state', CASE WHEN v_verdict = 'block' THEN 'flagged' ELSE 'delivered' END,
        'strike_delta', v_strike_delta
    );
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_override_blocked_message(p_message_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_message public.messages;
BEGIN
    IF auth.uid() IS NULL THEN
        RAISE EXCEPTION 'Authentication required';
    END IF;

    SELECT * INTO v_message
    FROM public.messages
    WHERE id = p_message_id
    FOR UPDATE;

    IF v_message.id IS NULL THEN
        RAISE EXCEPTION 'Message not found';
    END IF;

    UPDATE public.messages
    SET delivery_state = 'delivered',
        moderation_verdict = 'safe',
        delivered_at = COALESCE(delivered_at, now())
    WHERE id = p_message_id;

    UPDATE public.profiles
    SET warning_count = GREATEST(warning_count - 1, 0),
        updated_at = now()
    WHERE user_id = v_message.sender_user_id;

    UPDATE public.moderation_events
    SET reviewed_by = auth.uid(),
        reviewed_at = now(),
        strike_delta = 0,
        verdict = 'safe'
    WHERE message_id = p_message_id
      AND verdict = 'block';

    UPDATE public.conversations
    SET delivered_at = COALESCE(delivered_at, now()),
        pending_expires_at = COALESCE(pending_expires_at, now() + interval '3 days'),
        updated_at = now()
    WHERE id = v_message.conversation_id
      AND status = 'pending'
      AND opening_sender_id = v_message.sender_user_id;

    INSERT INTO public.admin_actions (actor_user_id, target_user_id, action_type, metadata)
    VALUES (
        auth.uid(),
        v_message.sender_user_id,
        'override_blocked_message',
        jsonb_build_object('message_id', p_message_id)
    );

    RETURN jsonb_build_object('success', true, 'message_id', p_message_id);
END;
$$;

CREATE OR REPLACE FUNCTION public.mark_messages_read(p_conversation_id uuid)
RETURNS integer
LANGUAGE plpgsql
AS $$
DECLARE
    v_count integer;
BEGIN
    UPDATE public.messages
    SET delivery_state = 'read', read_at = now()
    WHERE conversation_id = p_conversation_id
      AND recipient_user_id = auth.uid()
      AND read_at IS NULL;

    GET DIAGNOSTICS v_count = ROW_COUNT;
    RETURN v_count;
END;
$$;

CREATE OR REPLACE FUNCTION public.expire_pending_conversations()
RETURNS integer
LANGUAGE plpgsql
AS $$
DECLARE
    v_count integer;
BEGIN
    WITH expired AS (
        UPDATE public.conversations
        SET status = 'expired', expired_at = now(), updated_at = now()
        WHERE status = 'pending'
          AND pending_expires_at IS NOT NULL
          AND pending_expires_at <= now()
        RETURNING id, user1_id, user2_id, dating_mode
    ),
    notified AS (
        INSERT INTO public.notifications (user_id, dating_mode, category, title, body, status)
        SELECT participant_id,
               dating_mode,
               'messages',
               'Your conversation has expired',
               'A pending conversation expired because no reply arrived in time.',
               'queued'
        FROM (
            SELECT user1_id AS participant_id, dating_mode FROM expired
            UNION ALL
            SELECT user2_id AS participant_id, dating_mode FROM expired
        ) participants
        GROUP BY dating_mode, participant_id
        RETURNING 1
    )
    SELECT count(*)::integer INTO v_count FROM expired;
    RETURN v_count;
END;
$$;

CREATE OR REPLACE FUNCTION public.purge_expired_conversations()
RETURNS integer
LANGUAGE plpgsql
AS $$
DECLARE
    v_count integer;
BEGIN
    DELETE FROM public.conversations
    WHERE status = 'expired'
      AND expired_at < now() - interval '7 days';

    GET DIAGNOSTICS v_count = ROW_COUNT;
    RETURN v_count;
END;
$$;

CREATE OR REPLACE FUNCTION public.update_conversation_streaks()
RETURNS integer
LANGUAGE plpgsql
AS $$
DECLARE
    v_streak_date date := ((now() AT TIME ZONE 'Asia/Kolkata')::date - 1);
    v_count integer;
BEGIN
    WITH daily AS (
        SELECT
            c.id,
            c.dating_mode,
            bool_or(m.sender_user_id = c.user1_id) AS user1_sent,
            bool_or(m.sender_user_id = c.user2_id) AS user2_sent
        FROM public.conversations c
        LEFT JOIN public.messages m
          ON m.conversation_id = c.id
         AND m.delivery_state IN ('delivered', 'read')
         AND ((COALESCE(m.delivered_at, m.created_at) AT TIME ZONE 'Asia/Kolkata')::date = v_streak_date)
        WHERE c.status IN ('active', 'locked')
        GROUP BY c.id, c.dating_mode
    ),
    scored AS (
        SELECT
            c.id,
            COALESCE(d.user1_sent, false) AND COALESCE(d.user2_sent, false) AS both_sent,
            CASE
                WHEN COALESCE(d.user1_sent, false) AND COALESCE(d.user2_sent, false)
                    THEN CASE WHEN c.last_streak_date = v_streak_date - 1 THEN c.current_streak + 1 ELSE 1 END
                ELSE 0
            END AS next_streak
        FROM public.conversations c
        JOIN daily d ON d.id = c.id
    )
    UPDATE public.conversations
    SET current_streak = scored.next_streak,
        last_streak_date = CASE WHEN scored.both_sent THEN v_streak_date ELSE c.last_streak_date END,
        status = CASE WHEN scored.next_streak >= c.next_meet_prompt_day THEN 'locked' ELSE c.status END,
        locked_at = CASE WHEN scored.next_streak >= c.next_meet_prompt_day THEN COALESCE(c.locked_at, now()) ELSE c.locked_at END,
        updated_at = now()
    FROM scored
    WHERE c.id = scored.id;

    GET DIAGNOSTICS v_count = ROW_COUNT;

    INSERT INTO public.notifications (user_id, dating_mode, category, title, body, status)
    SELECT participant_id, dating_mode, 'streaks', 'Your chat with someone is locked',
           'Your chat with someone is locked. Answer the meet prompt to continue.',
           'queued'
    FROM (
        SELECT user1_id AS participant_id, dating_mode, locked_at FROM public.conversations
        WHERE status = 'locked'
        UNION ALL
        SELECT user2_id AS participant_id, dating_mode, locked_at FROM public.conversations
        WHERE status = 'locked'
    ) locked_rows
    WHERE locked_at > now() - interval '5 minutes';

    INSERT INTO public.notifications (user_id, dating_mode, category, title, body, status)
    SELECT participant_id, dating_mode, 'streaks',
           'You two have been talking for a while',
           'You two have been talking for a while. Keep building what is working.',
           'queued'
    FROM (
        SELECT user1_id AS participant_id, dating_mode, current_streak, last_streak_date FROM public.conversations
        WHERE current_streak IN (30, 60, 100)
        UNION ALL
        SELECT user2_id AS participant_id, dating_mode, current_streak, last_streak_date FROM public.conversations
        WHERE current_streak IN (30, 60, 100)
    ) milestone_rows
    WHERE last_streak_date = v_streak_date;

    RETURN v_count;
END;
$$;

CREATE OR REPLACE FUNCTION public.record_meet_prompt_response(
    p_conversation_id uuid,
    p_response text
)
RETURNS jsonb
LANGUAGE plpgsql
AS $$
DECLARE
    v_conversation public.conversations;
BEGIN
    IF p_response NOT IN ('yes', 'keep_chatting') THEN
        RAISE EXCEPTION 'Invalid meet prompt response';
    END IF;

    UPDATE public.conversations
    SET meet_prompt_user1_response = CASE WHEN auth.uid() = user1_id THEN p_response ELSE meet_prompt_user1_response END,
        meet_prompt_user2_response = CASE WHEN auth.uid() = user2_id THEN p_response ELSE meet_prompt_user2_response END,
        updated_at = now()
    WHERE id = p_conversation_id
      AND auth.uid() IN (user1_id, user2_id)
      AND status = 'locked'
    RETURNING * INTO v_conversation;

    IF v_conversation.id IS NULL THEN
        RAISE EXCEPTION 'Conversation not found';
    END IF;

    IF v_conversation.meet_prompt_user1_response IS NULL
       OR v_conversation.meet_prompt_user2_response IS NULL THEN
        RETURN jsonb_build_object('success', true, 'status', 'waiting');
    END IF;

    IF v_conversation.meet_prompt_user1_response = 'yes'
       AND v_conversation.meet_prompt_user2_response = 'yes' THEN
        UPDATE public.conversations
        SET status = 'active',
            planning_banner_until = now() + interval '7 days',
            meet_prompt_private_note_user_id = NULL,
            meet_prompt_user1_response = NULL,
            meet_prompt_user2_response = NULL,
            locked_at = NULL,
            updated_at = now()
        WHERE id = p_conversation_id
        RETURNING * INTO v_conversation;

        INSERT INTO public.notifications (user_id, category, title, body, status)
        VALUES
            (v_conversation.user1_id, 'streaks', 'You both said yes', 'You both said yes! Time to plan something.', 'queued'),
            (v_conversation.user2_id, 'streaks', 'You both said yes', 'You both said yes! Time to plan something.', 'queued');

        RETURN jsonb_build_object('success', true, 'status', 'both_yes');
    ELSIF v_conversation.meet_prompt_user1_response = 'yes'
       OR v_conversation.meet_prompt_user2_response = 'yes' THEN
        UPDATE public.conversations
        SET status = 'active',
            meet_prompt_private_note_user_id = CASE WHEN v_conversation.meet_prompt_user1_response = 'yes' THEN v_conversation.user1_id ELSE v_conversation.user2_id END,
            next_meet_prompt_day = CASE WHEN current_streak < 14 THEN 14 WHEN current_streak < 30 THEN 30 ELSE current_streak + 30 END,
            meet_prompt_user1_response = NULL,
            meet_prompt_user2_response = NULL,
            locked_at = NULL,
            updated_at = now()
        WHERE id = p_conversation_id;

        RETURN jsonb_build_object('success', true, 'status', 'one_yes');
    ELSE
        UPDATE public.conversations
        SET status = 'active',
            meet_prompt_private_note_user_id = NULL,
            next_meet_prompt_day = CASE WHEN current_streak < 14 THEN 14 WHEN current_streak < 30 THEN 30 ELSE current_streak + 30 END,
            meet_prompt_user1_response = NULL,
            meet_prompt_user2_response = NULL,
            locked_at = NULL,
            updated_at = now()
        WHERE id = p_conversation_id;

        RETURN jsonb_build_object('success', true, 'status', 'keep_chatting');
    END IF;
END;
$$;

DROP FUNCTION IF EXISTS public.block_user(uuid);
DROP FUNCTION IF EXISTS public.block_user(text);
CREATE OR REPLACE FUNCTION public.block_user(p_blocked_peer_id text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_blocker public.profiles%ROWTYPE;
    v_blocked public.profiles%ROWTYPE;
BEGIN
    IF auth.uid() IS NULL THEN
        RAISE EXCEPTION 'not_authenticated';
    END IF;

    SELECT * INTO v_blocker
    FROM public.profiles
    WHERE user_id = auth.uid();

    IF v_blocker.user_id IS NULL THEN
        RAISE EXCEPTION 'blocker_profile_missing';
    END IF;

    SELECT * INTO v_blocked
    FROM public.profiles
    WHERE peer_id = p_blocked_peer_id
      AND user_id IS NOT NULL;

    IF v_blocked.user_id IS NULL THEN
        RAISE EXCEPTION 'blocked_profile_missing';
    END IF;

    IF v_blocked.user_id = auth.uid() THEN
        RAISE EXCEPTION 'cannot_block_self';
    END IF;

    INSERT INTO public.blocks (
        blocker_user_id,
        blocked_user_id,
        blocker_peer_id,
        blocked_peer_id
    )
    VALUES (
        auth.uid(),
        v_blocked.user_id,
        v_blocker.peer_id,
        v_blocked.peer_id
    )
    ON CONFLICT DO NOTHING;

    UPDATE public.conversations
    SET status = 'closed',
        closed_at = now(),
        updated_at = now()
    WHERE auth.uid() IN (user1_id, user2_id)
      AND v_blocked.user_id IN (user1_id, user2_id)
      AND status <> 'closed';

    INSERT INTO public.admin_actions (actor_user_id, action_type, target_user_id, metadata)
    VALUES (
        auth.uid(),
        'block_user',
        v_blocked.user_id,
        jsonb_build_object('blocked_peer_id', v_blocked.peer_id)
    );

    RETURN jsonb_build_object('success', true, 'blocked_peer_id', v_blocked.peer_id);
END;
$$;

DROP FUNCTION IF EXISTS public.unblock_user(text);
CREATE OR REPLACE FUNCTION public.unblock_user(p_blocked_peer_id text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_blocked public.profiles%ROWTYPE;
BEGIN
    IF auth.uid() IS NULL THEN
        RAISE EXCEPTION 'not_authenticated';
    END IF;

    SELECT * INTO v_blocked
    FROM public.profiles
    WHERE peer_id = p_blocked_peer_id
      AND user_id IS NOT NULL;

    IF v_blocked.user_id IS NULL THEN
        RAISE EXCEPTION 'blocked_profile_missing';
    END IF;

    DELETE FROM public.blocks
    WHERE blocker_user_id = auth.uid()
      AND blocked_user_id = v_blocked.user_id;

    INSERT INTO public.admin_actions (actor_user_id, action_type, target_user_id, metadata)
    VALUES (
        auth.uid(),
        'unblock_user',
        v_blocked.user_id,
        jsonb_build_object('blocked_peer_id', v_blocked.peer_id)
    );

    RETURN jsonb_build_object('success', true, 'blocked_peer_id', v_blocked.peer_id);
END;
$$;

DROP FUNCTION IF EXISTS public.reinstate_expired_account_bans();
CREATE OR REPLACE FUNCTION public.reinstate_expired_account_bans()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_count integer;
BEGIN
    UPDATE public.profiles
    SET is_banned = false,
        account_banned_until = NULL,
        ban_reason = NULL,
        ban_level = CASE WHEN ban_level IN ('report_5_24h', 'report_20_7d') THEN NULL ELSE ban_level END,
        updated_at = now()
    WHERE is_banned = true
      AND account_banned_until IS NOT NULL
      AND account_banned_until <= now();

    GET DIAGNOSTICS v_count = ROW_COUNT;
    RETURN v_count;
END;
$$;

DROP FUNCTION IF EXISTS public.evaluate_report_thresholds(uuid);
CREATE OR REPLACE FUNCTION public.evaluate_report_thresholds(p_reported_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_confirmed_count integer;
    v_target public.profiles%ROWTYPE;
    v_action text;
    v_banned_until timestamptz;
    v_ban_body text;
BEGIN
    SELECT * INTO v_target
    FROM public.profiles
    WHERE user_id = p_reported_user_id
    FOR UPDATE;

    IF v_target.user_id IS NULL THEN
        RAISE EXCEPTION 'reported_profile_missing';
    END IF;

    SELECT count(*)::integer INTO v_confirmed_count
    FROM (
        SELECT DISTINCT reporter_user_id
        FROM public.reports
        WHERE reported_user_id = p_reported_user_id
          AND reporter_user_id IS NOT NULL
          AND status NOT IN ('dismissed', 'archived')
    ) unique_reporters;

    IF v_confirmed_count >= 30 AND COALESCE(v_target.ban_level, '') <> 'report_30_permanent' THEN
        v_action := 'report_30_permanent';
        v_banned_until := NULL;
        v_ban_body := 'Your account has been permanently suspended due to repeated violations of our community guidelines. This decision was made after multiple reports from community members. If you believe this is a mistake, please contact us at support@komorembi.app.';

        UPDATE public.profiles
        SET is_banned = true,
            account_banned_until = NULL,
            ban_level = v_action,
            ban_reason = v_ban_body,
            high_risk_flag = true,
            updated_at = now()
        WHERE user_id = p_reported_user_id;

        UPDATE public.user_auth_records
        SET phone_hash_blocked = true,
            phone_hash_blocked_at = now(),
            phone_hash_block_reason = 'report_30_permanent',
            updated_at = now()
        WHERE user_id = p_reported_user_id;
    ELSIF v_confirmed_count >= 20 AND COALESCE(v_target.ban_level, '') NOT IN ('report_20_7d', 'report_30_permanent') THEN
        v_action := 'report_20_7d';
        v_banned_until := now() + interval '7 days';
        v_ban_body := 'Your account has been temporarily suspended until ' || to_char(v_banned_until, 'YYYY-MM-DD HH24:MI TZ') || '. This happened because multiple members of our community reported your account. If you believe this is a mistake, you can contact us at support@komorembi.app. Your account will be automatically reinstated after the suspension period.';

        UPDATE public.profiles
        SET is_banned = true,
            account_banned_until = v_banned_until,
            ban_level = v_action,
            ban_reason = v_ban_body,
            high_risk_flag = true,
            updated_at = now()
        WHERE user_id = p_reported_user_id;
    ELSIF v_confirmed_count >= 5 AND COALESCE(v_target.ban_level, '') NOT IN ('report_5_24h', 'report_20_7d', 'report_30_permanent') THEN
        v_action := 'report_5_24h';
        v_banned_until := now() + interval '24 hours';
        v_ban_body := 'Your account has been temporarily suspended until ' || to_char(v_banned_until, 'YYYY-MM-DD HH24:MI TZ') || '. This happened because multiple members of our community reported your account. If you believe this is a mistake, you can contact us at support@komorembi.app. Your account will be automatically reinstated after the suspension period.';

        UPDATE public.profiles
        SET is_banned = true,
            account_banned_until = v_banned_until,
            ban_level = v_action,
            ban_reason = v_ban_body,
            updated_at = now()
        WHERE user_id = p_reported_user_id;
    END IF;

    IF v_action IS NOT NULL THEN
        UPDATE public.reports
        SET threshold_action_taken = v_action,
            threshold_action_taken_at = now()
        WHERE reported_user_id = p_reported_user_id
          AND status NOT IN ('dismissed', 'archived')
          AND threshold_action_taken IS NULL;

        INSERT INTO public.notifications (user_id, category, title, body, status)
        VALUES (
            p_reported_user_id,
            'account_security',
            CASE WHEN v_action = 'report_30_permanent'
                THEN 'Your account has been permanently suspended'
                ELSE 'Your account has been temporarily suspended'
            END,
            v_ban_body,
            'queued'
        );

        INSERT INTO public.notifications (user_id, category, title, body, status)
        SELECT DISTINCT
            reporter_user_id,
            'account_security',
            'Report reviewed',
            'An account you reported has been reviewed and action has been taken. Thank you for helping keep the community safe.',
            'queued'
        FROM public.reports
        WHERE reported_user_id = p_reported_user_id
          AND reporter_user_id IS NOT NULL
          AND status NOT IN ('dismissed', 'archived');

        INSERT INTO public.admin_actions (actor_user_id, action_type, target_user_id, metadata)
        VALUES (
            NULL,
            'report_threshold_' || v_action,
            p_reported_user_id,
            jsonb_build_object('confirmed_reporters', v_confirmed_count)
        );
    END IF;

    RETURN jsonb_build_object(
        'success', true,
        'confirmed_reporters', v_confirmed_count,
        'action', COALESCE(v_action, 'none')
    );
END;
$$;

DROP FUNCTION IF EXISTS public.submit_account_appeal(text, text);
CREATE OR REPLACE FUNCTION public.submit_account_appeal(
    p_what_happened text,
    p_why_wrong text
)
RETURNS public.appeals_queue
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_profile public.profiles%ROWTYPE;
    v_appeal public.appeals_queue;
BEGIN
    IF auth.uid() IS NULL THEN
        RAISE EXCEPTION 'not_authenticated';
    END IF;

    IF char_length(coalesce(p_what_happened, '')) + char_length(coalesce(p_why_wrong, '')) > 500 THEN
        RAISE EXCEPTION 'appeal_text_too_long';
    END IF;

    SELECT * INTO v_profile
    FROM public.profiles
    WHERE user_id = auth.uid();

    IF v_profile.user_id IS NULL OR (v_profile.is_banned = false AND v_profile.flagged_for_review = false) THEN
        RAISE EXCEPTION 'appeal_not_available';
    END IF;

    INSERT INTO public.appeals_queue (user_id, what_happened, why_wrong, penalty_level)
    VALUES (auth.uid(), trim(p_what_happened), trim(p_why_wrong), v_profile.ban_level)
    RETURNING * INTO v_appeal;

    INSERT INTO public.admin_actions (actor_user_id, action_type, target_user_id, metadata)
    VALUES (
        auth.uid(),
        'appeal_submitted',
        auth.uid(),
        jsonb_build_object('appeal_id', v_appeal.id, 'penalty_level', v_profile.ban_level)
    );

    RETURN v_appeal;
END;
$$;

DROP FUNCTION IF EXISTS public.resolve_account_appeal(uuid, text, text);
CREATE OR REPLACE FUNCTION public.resolve_account_appeal(
    p_appeal_id uuid,
    p_decision text,
    p_decision_note text DEFAULT NULL
)
RETURNS public.appeals_queue
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_appeal public.appeals_queue;
BEGIN
    IF p_decision NOT IN ('upheld', 'overturned') THEN
        RAISE EXCEPTION 'invalid_appeal_decision';
    END IF;

    UPDATE public.appeals_queue
    SET status = p_decision,
        decided_by = auth.uid(),
        decision_note = p_decision_note,
        decided_at = now()
    WHERE id = p_appeal_id
    RETURNING * INTO v_appeal;

    IF v_appeal.id IS NULL THEN
        RAISE EXCEPTION 'appeal_not_found';
    END IF;

    IF p_decision = 'overturned' THEN
        UPDATE public.profiles
        SET is_banned = false,
            account_banned_until = NULL,
            ban_level = NULL,
            ban_reason = NULL,
            flagged_for_review = false,
            updated_at = now()
        WHERE user_id = v_appeal.user_id;

        INSERT INTO public.notifications (user_id, category, title, body, status)
        VALUES (
            v_appeal.user_id,
            'account_security',
            'Appeal reviewed',
            'We reviewed your appeal and have reinstated your account. We apologise for the inconvenience.',
            'queued'
        );
    ELSE
        INSERT INTO public.notifications (user_id, category, title, body, status)
        VALUES (
            v_appeal.user_id,
            'account_security',
            'Appeal reviewed',
            'We reviewed your appeal and have determined the suspension was appropriate. If you believe there is additional context we have not considered, please email support@komorembi.app.',
            'queued'
        );
    END IF;

    INSERT INTO public.admin_actions (actor_user_id, action_type, target_user_id, metadata)
    VALUES (
        auth.uid(),
        CASE WHEN p_decision = 'overturned' THEN 'appeal_overturned' ELSE 'appeal_upheld' END,
        v_appeal.user_id,
        jsonb_build_object('appeal_id', v_appeal.id, 'decision_note', p_decision_note)
    );

    RETURN v_appeal;
END;
$$;

DROP FUNCTION IF EXISTS public.submit_pre_ban_context(uuid, text);
CREATE OR REPLACE FUNCTION public.submit_pre_ban_context(
    p_report_id uuid,
    p_context_text text
)
RETURNS public.pre_ban_context_submissions
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_submission public.pre_ban_context_submissions;
BEGIN
    IF auth.uid() IS NULL THEN
        RAISE EXCEPTION 'not_authenticated';
    END IF;

    IF char_length(coalesce(p_context_text, '')) > 500 THEN
        RAISE EXCEPTION 'pre_ban_context_too_long';
    END IF;

    INSERT INTO public.pre_ban_context_submissions (user_id, report_id, context_text, due_at, status)
    VALUES (auth.uid(), p_report_id, trim(p_context_text), now() + interval '48 hours', 'submitted')
    RETURNING * INTO v_submission;

    INSERT INTO public.admin_actions (actor_user_id, action_type, target_user_id, metadata)
    VALUES (
        auth.uid(),
        'pre_ban_context_submitted',
        auth.uid(),
        jsonb_build_object('submission_id', v_submission.id, 'report_id', p_report_id)
    );

    RETURN v_submission;
END;
$$;

DROP FUNCTION IF EXISTS public.start_contextual_pre_ban_review(uuid, uuid);
CREATE OR REPLACE FUNCTION public.start_contextual_pre_ban_review(
    p_user_id uuid,
    p_report_id uuid DEFAULT NULL
)
RETURNS public.pre_ban_context_submissions
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_submission public.pre_ban_context_submissions;
BEGIN
    INSERT INTO public.pre_ban_context_submissions (user_id, report_id, context_text, due_at, status)
    VALUES (p_user_id, p_report_id, 'awaiting user context', now() + interval '48 hours', 'awaiting_context')
    RETURNING * INTO v_submission;

    INSERT INTO public.notifications (user_id, category, title, body, status)
    VALUES (
        p_user_id,
        'account_security',
        'Context requested before account action',
        'A report involving your account is under review. You have 48 hours to provide context before any human-reviewed ban longer than 24 hours can take effect.',
        'queued'
    );

    INSERT INTO public.admin_actions (actor_user_id, action_type, target_user_id, metadata)
    VALUES (
        auth.uid(),
        'pre_ban_context_requested',
        p_user_id,
        jsonb_build_object('submission_id', v_submission.id, 'report_id', p_report_id, 'due_at', v_submission.due_at)
    );

    RETURN v_submission;
END;
$$;

DROP FUNCTION IF EXISTS public.submit_report(uuid, text, text);
DROP FUNCTION IF EXISTS public.submit_report(text, text, text);
CREATE OR REPLACE FUNCTION public.submit_report(
    p_reported_peer_id text,
    p_reason text,
    p_details text DEFAULT NULL
)
RETURNS public.reports
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_report public.reports;
    v_reporter public.profiles%ROWTYPE;
    v_reported public.profiles%ROWTYPE;
    v_high_volume boolean;
BEGIN
    IF auth.uid() IS NULL THEN
        RAISE EXCEPTION 'not_authenticated';
    END IF;

    IF p_reason NOT IN ('fake_profile', 'harassment', 'inappropriate_photos', 'scammer', 'underage_user', 'other') THEN
        RAISE EXCEPTION 'invalid_report_reason';
    END IF;

    IF char_length(coalesce(p_details, '')) > 300 THEN
        RAISE EXCEPTION 'report_details_too_long';
    END IF;

    SELECT * INTO v_reporter
    FROM public.profiles
    WHERE user_id = auth.uid();

    IF v_reporter.user_id IS NULL THEN
        RAISE EXCEPTION 'reporter_profile_missing';
    END IF;

    SELECT * INTO v_reported
    FROM public.profiles
    WHERE peer_id = p_reported_peer_id
      AND user_id IS NOT NULL;

    IF v_reported.user_id IS NULL THEN
        RAISE EXCEPTION 'reported_profile_missing';
    END IF;

    IF v_reported.user_id = auth.uid() THEN
        RAISE EXCEPTION 'cannot_report_self';
    END IF;

    SELECT count(*) >= 10 INTO v_high_volume
    FROM public.reports
    WHERE reporter_user_id = auth.uid()
      AND created_at >= now() - interval '24 hours';

    INSERT INTO public.reports (
        reporter_user_id,
        reported_user_id,
        reporter_id,
        reported_id,
        reason,
        details,
        high_volume_reporter
    )
    VALUES (
        auth.uid(),
        v_reported.user_id,
        v_reporter.peer_id,
        v_reported.peer_id,
        p_reason,
        nullif(trim(coalesce(p_details, '')), ''),
        v_high_volume
    )
    RETURNING * INTO v_report;

    INSERT INTO public.admin_actions (actor_user_id, action_type, target_user_id, metadata)
    VALUES (
        auth.uid(),
        'submit_report',
        v_reported.user_id,
        jsonb_build_object(
            'report_id', v_report.id,
            'reason', p_reason,
            'high_volume_reporter', v_high_volume
        )
    );

    PERFORM public.evaluate_report_thresholds(v_reported.user_id);

    RETURN v_report;
END;
$$;

CREATE OR REPLACE VIEW public.admin_users
WITH (security_invoker = true)
AS
SELECT
    p.user_id,
    p.peer_id,
    p.username,
    p.display_name,
    p.gender,
    p.gender_preference,
    p.intention,
    p.city,
    p.state,
    p.is_complete,
    p.is_waitlisted,
    p.is_banned,
    p.account_banned_until,
    p.ban_level,
    p.ban_reason,
    p.high_risk_flag,
    p.is_visible,
    p.warning_count,
    p.message_banned_until,
    p.last_active_at,
    p.created_at
FROM public.profiles p;

CREATE OR REPLACE VIEW public.admin_reports
WITH (security_invoker = true)
AS
SELECT
    r.id,
    r.created_at,
    r.status,
    r.reason,
    r.details,
    r.high_volume_reporter,
    reporter.username AS reporter_username,
    reporter.peer_id AS reporter_peer_id,
    reported.username AS reported_username,
    reported.peer_id AS reported_peer_id,
    reported.display_name AS reported_display_name,
    reported.photos AS reported_photos
FROM public.reports r
LEFT JOIN public.profiles reporter ON reporter.user_id = r.reporter_user_id
LEFT JOIN public.profiles reported ON reported.user_id = r.reported_user_id
ORDER BY r.created_at DESC;

CREATE OR REPLACE VIEW public.admin_blocked_messages
WITH (security_invoker = true)
AS
SELECT
    m.id AS message_id,
    m.conversation_id,
    m.dating_mode,
    m.sender_user_id,
    m.recipient_user_id,
    m.sender_peer_id,
    m.sender_display_name,
    m.content,
    m.created_at,
    me.categories,
    me.strike_delta,
    me.reviewed_by,
    me.reviewed_at
FROM public.messages m
LEFT JOIN public.moderation_events me ON me.message_id = m.id
WHERE m.delivery_state = 'flagged'
ORDER BY m.created_at DESC;

CREATE OR REPLACE VIEW public.admin_waitlists
WITH (security_invoker = true)
AS
SELECT
    w.id,
    w.peer_id,
    p.username,
    p.display_name,
    w.city,
    w.state,
    w.dating_mode,
    w.gender,
    w.queue_position,
    w.status,
    w.joined_at,
    w.admitted_at,
    w.left_at
FROM public.waitlist_entries w
LEFT JOIN public.profiles p ON p.user_id = w.user_id
ORDER BY w.city, w.queue_position;

CREATE OR REPLACE VIEW public.admin_signup_stats
WITH (security_invoker = true)
AS
SELECT
    date_trunc('day', p.created_at)::date AS signup_date,
    p.city,
    p.intention AS dating_mode,
    p.gender,
    count(*)::integer AS signup_count
FROM public.profiles p
GROUP BY date_trunc('day', p.created_at)::date, p.city, p.intention, p.gender
ORDER BY signup_date DESC, p.city, p.intention, p.gender;

CREATE OR REPLACE VIEW public.admin_daily_signups
WITH (security_invoker = true)
AS
SELECT
    signup_date,
    city,
    dating_mode,
    gender,
    signup_count
FROM public.admin_signup_stats;

CREATE OR REPLACE VIEW public.admin_gender_ratios
WITH (security_invoker = true)
AS
WITH city_counts AS (
    SELECT
        city,
        intention AS dating_mode,
        count(*) FILTER (
            WHERE gender = 'man'
              AND is_waitlisted = false
              AND is_banned = false
              AND last_active_at >= now() - interval '30 days'
        )::integer AS active_men,
        count(*) FILTER (
            WHERE gender = 'woman'
              AND is_waitlisted = false
              AND is_banned = false
              AND last_active_at >= now() - interval '30 days'
        )::integer AS active_women
    FROM public.profiles
    WHERE city IS NOT NULL
    GROUP BY city, intention
)
SELECT
    city,
    dating_mode,
    active_men,
    active_women,
    CASE
        WHEN active_women = 0 THEN NULL
        ELSE round(active_men::numeric / active_women::numeric, 2)
    END AS male_to_female_ratio
FROM city_counts
ORDER BY city, dating_mode;

CREATE OR REPLACE VIEW public.admin_message_volume
WITH (security_invoker = true)
AS
SELECT
    date_trunc('day', created_at)::date AS message_date,
    dating_mode,
    count(*)::integer AS total_messages,
    count(*) FILTER (WHERE delivery_state IN ('delivered', 'read'))::integer AS delivered_messages,
    count(*) FILTER (WHERE delivery_state = 'flagged')::integer AS flagged_messages
FROM public.messages
GROUP BY date_trunc('day', created_at)::date, dating_mode
ORDER BY message_date DESC, dating_mode;

CREATE OR REPLACE VIEW public.admin_appeals_queue
WITH (security_invoker = true)
AS
SELECT
    a.id,
    a.user_id,
    p.peer_id,
    p.username,
    p.display_name,
    a.penalty_level,
    a.what_happened,
    a.why_wrong,
    a.status,
    a.decision_note,
    a.decided_by,
    a.decided_at,
    a.created_at
FROM public.appeals_queue a
LEFT JOIN public.profiles p ON p.user_id = a.user_id
ORDER BY a.created_at DESC;

CREATE OR REPLACE VIEW public.admin_pre_ban_context_submissions
WITH (security_invoker = true)
AS
SELECT
    c.id,
    c.user_id,
    p.peer_id,
    p.username,
    p.display_name,
    c.report_id,
    c.context_text,
    c.status,
    c.due_at,
    c.submitted_at
FROM public.pre_ban_context_submissions c
LEFT JOIN public.profiles p ON p.user_id = c.user_id
ORDER BY c.due_at ASC;

CREATE OR REPLACE FUNCTION public.request_data_export()
RETURNS public.data_export_requests
LANGUAGE plpgsql
AS $$
DECLARE
    v_request public.data_export_requests;
BEGIN
    INSERT INTO public.data_export_requests (user_id)
    VALUES (auth.uid())
    RETURNING * INTO v_request;

    RETURN v_request;
END;
$$;

CREATE OR REPLACE FUNCTION public.dispatch_queued_notifications()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_count integer;
BEGIN
    -- Security notifications cannot be disabled.
    WITH due AS (
        SELECT
            n.id,
            n.user_id,
            n.dating_mode,
            n.category,
            n.event_type,
            COALESCE(p.messages, true) AS pref_messages,
            COALESCE(p.streaks, true) AS pref_streaks,
            COALESCE(p.waitlist, true) AS pref_waitlist,
            COALESCE(p.app_updates, true) AS pref_app_updates,
            COALESCE(p.quiet_hours_enabled, true) AS quiet_hours_enabled,
            (((now() AT TIME ZONE 'Asia/Kolkata')::time >= time '23:00')
                OR ((now() AT TIME ZONE 'Asia/Kolkata')::time < time '08:00')) AS in_quiet_hours,
            (
                SELECT count(*)::integer
                FROM public.notifications sent
                WHERE sent.user_id = n.user_id
                  AND sent.status = 'sent'
                  AND sent.sent_at >= now() - interval '1 hour'
            ) AS sent_last_hour,
            row_number() OVER (PARTITION BY n.user_id ORDER BY n.created_at, n.id)::integer AS due_rank
        FROM public.notifications n
        LEFT JOIN public.notification_preferences p ON p.user_id = n.user_id
        WHERE n.status = 'queued'
          AND n.send_after <= now()
          AND (n.event_type IS NULL OR n.event_type IN ('onboarding_interest_reminder'))
    )
    UPDATE public.notifications n
    SET status = CASE
            WHEN due.dating_mode IS NOT NULL
             AND recipient.intention <> due.dating_mode THEN 'suppressed'
            WHEN due.category <> 'account_security'
             AND (
                (due.category = 'messages' AND due.pref_messages = false)
                OR (due.category = 'streaks' AND due.pref_streaks = false)
                OR (due.category = 'waitlist' AND due.pref_waitlist = false)
                OR (due.category = 'app_updates' AND due.pref_app_updates = false)
             ) THEN 'suppressed'
            WHEN due.category <> 'account_security'
             AND due.quiet_hours_enabled
             AND due.in_quiet_hours THEN 'queued'
            WHEN due.category = 'account_security' OR due.sent_last_hour + due_rank <= 3 THEN 'sent'
            ELSE 'queued'
        END,
        send_after = CASE
            WHEN due.category <> 'account_security'
             AND due.quiet_hours_enabled
             AND due.in_quiet_hours THEN ((date_trunc('day', now() AT TIME ZONE 'Asia/Kolkata') + interval '1 day' + interval '8 hours') AT TIME ZONE 'Asia/Kolkata')
            WHEN due.category <> 'account_security'
             AND due.sent_last_hour + due_rank > 3 THEN now() + interval '1 hour'
            ELSE n.send_after
        END,
        sent_at = CASE
            WHEN due.category = 'account_security' OR (
                NOT due.in_quiet_hours
                AND due.sent_last_hour + due_rank <= 3
                AND NOT (due.dating_mode IS NOT NULL AND recipient.intention <> due.dating_mode)
                AND NOT (
                    (due.category = 'messages' AND due.pref_messages = false)
                    OR (due.category = 'streaks' AND due.pref_streaks = false)
                    OR (due.category = 'waitlist' AND due.pref_waitlist = false)
                    OR (due.category = 'app_updates' AND due.pref_app_updates = false)
                )
            ) THEN now()
            ELSE n.sent_at
        END
    FROM due
    LEFT JOIN public.profiles recipient ON recipient.user_id = due.user_id
    WHERE n.id = due.id;

    GET DIAGNOSTICS v_count = ROW_COUNT;
    RETURN v_count;
END;
$$;

CREATE OR REPLACE FUNCTION public.merge_auth_identities(
    p_primary_user_id uuid,
    p_duplicate_user_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
AS $$
DECLARE
    v_primary_position integer;
    v_duplicate_position integer;
    v_waitlist_position_to_keep integer;
    v_retired_waitlist_position integer;
BEGIN
    SELECT queue_position INTO v_primary_position
    FROM public.waitlist_entries
    WHERE user_id = p_primary_user_id AND status = 'waiting';

    SELECT queue_position INTO v_duplicate_position
    FROM public.waitlist_entries
    WHERE user_id = p_duplicate_user_id AND status = 'waiting';

    v_waitlist_position_to_keep := LEAST(
        COALESCE(v_primary_position, 2147483647),
        COALESCE(v_duplicate_position, 2147483647)
    );

    IF v_waitlist_position_to_keep = 2147483647 THEN
        v_waitlist_position_to_keep := NULL;
    END IF;

    v_retired_waitlist_position := GREATEST(
        COALESCE(v_primary_position, 0),
        COALESCE(v_duplicate_position, 0)
    );
    IF v_retired_waitlist_position = 0 OR v_retired_waitlist_position = v_waitlist_position_to_keep THEN
        v_retired_waitlist_position := NULL;
    END IF;

    UPDATE public.waitlist_entries
    SET queue_position = v_waitlist_position_to_keep
    WHERE user_id = p_primary_user_id
      AND status = 'waiting'
      AND v_waitlist_position_to_keep IS NOT NULL;

    UPDATE public.waitlist_entries
    SET status = 'left', left_at = now()
    WHERE user_id = p_duplicate_user_id
      AND status = 'waiting';

    UPDATE public.profiles
    SET user_id = p_primary_user_id,
        updated_at = now()
    WHERE user_id = p_duplicate_user_id;

    INSERT INTO public.auth_identity_merges (
        primary_user_id,
        duplicate_user_id,
        waitlist_position_to_keep,
        retired_waitlist_position
    )
    VALUES (
        p_primary_user_id,
        p_duplicate_user_id,
        v_waitlist_position_to_keep,
        v_retired_waitlist_position
    );

    RETURN jsonb_build_object(
        'primary_user_id', p_primary_user_id,
        'duplicate_user_id', p_duplicate_user_id,
        'waitlist_position_to_keep', v_waitlist_position_to_keep,
        'retired_waitlist_position', v_retired_waitlist_position
    );
END;
$$;

CREATE OR REPLACE FUNCTION public.save_profile_interests(
    p_hobbies text[] DEFAULT '{}'::text[],
    p_movies jsonb DEFAULT '[]'::jsonb,
    p_music_artists jsonb DEFAULT '[]'::jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
AS $$
DECLARE
    v_profile public.profiles;
    v_hobby text;
    v_item jsonb;
    v_position integer;
BEGIN
    IF auth.uid() IS NULL THEN
        RAISE EXCEPTION 'Authentication required';
    END IF;

    SELECT * INTO v_profile FROM public.profiles WHERE user_id = auth.uid();
    IF v_profile.user_id IS NULL THEN
        RAISE EXCEPTION 'Profile required';
    END IF;

    DELETE FROM public.profile_hobbies WHERE user_id = auth.uid();
    v_position := 1;
    FOREACH v_hobby IN ARRAY COALESCE(p_hobbies, '{}'::text[])
    LOOP
        EXIT WHEN v_position > 6;
        INSERT INTO public.profile_hobbies (user_id, peer_id, hobby, position)
        VALUES (auth.uid(), v_profile.peer_id, lower(trim(v_hobby)), v_position)
        ON CONFLICT (user_id, hobby) DO NOTHING;
        v_position := v_position + 1;
    END LOOP;

    DELETE FROM public.profile_movies WHERE user_id = auth.uid();
    v_position := 1;
    FOR v_item IN SELECT * FROM jsonb_array_elements(COALESCE(p_movies, '[]'::jsonb))
    LOOP
        EXIT WHEN v_position > 4;
        INSERT INTO public.profile_movies (user_id, peer_id, provider, provider_id, title, year, poster_url, position)
        VALUES (
            auth.uid(),
            v_profile.peer_id,
            COALESCE(v_item->>'provider', 'tmdb'),
            v_item->>'provider_id',
            v_item->>'title',
            NULLIF(v_item->>'year', '')::integer,
            v_item->>'poster_url',
            v_position
        )
        ON CONFLICT (user_id, provider, provider_id) DO NOTHING;
        v_position := v_position + 1;
    END LOOP;

    DELETE FROM public.profile_music_artists WHERE user_id = auth.uid();
    v_position := 1;
    FOR v_item IN SELECT * FROM jsonb_array_elements(COALESCE(p_music_artists, '[]'::jsonb))
    LOOP
        EXIT WHEN v_position > 4;
        INSERT INTO public.profile_music_artists (user_id, peer_id, provider, provider_id, name, genre, image_url, position)
        VALUES (
            auth.uid(),
            v_profile.peer_id,
            COALESCE(v_item->>'provider', 'lastfm'),
            v_item->>'provider_id',
            v_item->>'name',
            v_item->>'genre',
            v_item->>'image_url',
            v_position
        )
        ON CONFLICT (user_id, provider, provider_id) DO NOTHING;
        v_position := v_position + 1;
    END LOOP;

    RETURN jsonb_build_object('success', true);
END;
$$;

CREATE OR REPLACE FUNCTION public.set_timeline_preference(p_timeline_preference text)
RETURNS jsonb
LANGUAGE plpgsql
AS $$
BEGIN
    IF p_timeline_preference NOT IN ('daily', 'one_week', 'two_weeks', 'one_month', 'two_months') THEN
        RAISE EXCEPTION 'Invalid timeline preference';
    END IF;

    UPDATE public.profiles
    SET timeline_preference = p_timeline_preference,
        updated_at = now()
    WHERE user_id = auth.uid();

    RETURN jsonb_build_object('success', true, 'timeline_preference', p_timeline_preference);
END;
$$;

CREATE OR REPLACE FUNCTION public.create_premium_checkout_session()
RETURNS jsonb
LANGUAGE plpgsql
AS $$
BEGIN
    IF auth.uid() IS NULL THEN
        RAISE EXCEPTION 'Authentication required';
    END IF;

    RETURN jsonb_build_object(
        'status', 'placeholder',
        'provider', 'placeholder',
        'amount_inr', 299,
        'interval', 'monthly'
    );
END;
$$;

CREATE OR REPLACE FUNCTION public.sync_premium_subscription(
    p_user_id uuid,
    p_provider text,
    p_status text,
    p_provider_subscription_id text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
AS $$
BEGIN
    INSERT INTO public.premium_subscriptions (
        user_id,
        provider,
        status,
        provider_subscription_id,
        updated_at
    )
    VALUES (
        p_user_id,
        COALESCE(p_provider, 'placeholder'),
        p_status,
        p_provider_subscription_id,
        now()
    )
    ON CONFLICT (id)
    DO UPDATE SET status = EXCLUDED.status,
                  updated_at = now();

    UPDATE public.profiles
    SET is_premium = p_status = 'active',
        updated_at = now()
    WHERE user_id = p_user_id;

    RETURN jsonb_build_object('success', true, 'is_premium', p_status = 'active');
END;
$$;

CREATE OR REPLACE FUNCTION public.record_profile_view(p_viewed_peer_id text)
RETURNS jsonb
LANGUAGE plpgsql
AS $$
DECLARE
    v_viewed public.profiles;
BEGIN
    IF auth.uid() IS NULL THEN
        RAISE EXCEPTION 'Authentication required';
    END IF;

    SELECT * INTO v_viewed
    FROM public.profiles
    WHERE peer_id = p_viewed_peer_id
      AND is_complete = true
      AND is_banned = false
      AND is_visible = true;

    IF v_viewed.user_id IS NULL OR v_viewed.user_id = auth.uid() THEN
        RETURN jsonb_build_object('success', false);
    END IF;

    INSERT INTO public.profile_views (viewer_user_id, viewed_user_id, viewed_peer_id)
    VALUES (auth.uid(), v_viewed.user_id, p_viewed_peer_id);

    RETURN jsonb_build_object('success', true);
END;
$$;

CREATE OR REPLACE FUNCTION public.get_profile_viewers()
RETURNS TABLE(viewer_user_id uuid, viewed_at timestamptz)
LANGUAGE plpgsql
AS $$
DECLARE
    v_profile public.profiles;
BEGIN
    SELECT * INTO v_profile FROM public.profiles WHERE user_id = auth.uid();
    IF v_profile.is_premium IS DISTINCT FROM true THEN
        RAISE EXCEPTION 'premium_required';
    END IF;

    RETURN QUERY
    SELECT pv.viewer_user_id, pv.viewed_at
    FROM public.profile_views pv
    WHERE pv.viewed_user_id = auth.uid()
    ORDER BY pv.viewed_at DESC
    LIMIT 100;
END;
$$;

CREATE OR REPLACE FUNCTION public.purge_blocked_messages()
RETURNS integer
LANGUAGE plpgsql
AS $$
DECLARE
    v_count integer;
BEGIN
    DELETE FROM public.moderation_events
    WHERE verdict = 'block'
      AND purge_after <= now();
    GET DIAGNOSTICS v_count = ROW_COUNT;
    RETURN v_count;
END;
$$;

CREATE OR REPLACE FUNCTION public.archive_old_reports()
RETURNS integer
LANGUAGE plpgsql
AS $$
DECLARE
    v_count integer;
BEGIN
    UPDATE public.reports
    SET status = 'archived'
    WHERE archive_after <= now()
      AND status <> 'archived';
    GET DIAGNOSTICS v_count = ROW_COUNT;
    RETURN v_count;
END;
$$;

CREATE OR REPLACE FUNCTION public.purge_due_account_deletions()
RETURNS integer
LANGUAGE plpgsql
AS $$
DECLARE
    v_count integer;
BEGIN
    DELETE FROM public.account_deletion_requests
    WHERE status = 'pending_grace_period'
      AND purge_after <= now();
    GET DIAGNOSTICS v_count = ROW_COUNT;
    RETURN v_count;
END;
$$;

SELECT cron.schedule('mvp_daily_ist_message_reset', '30 18 * * *',
    $$UPDATE public.profiles SET messages_sent_today = 0, messages_sent_reset_at = now();$$);

SELECT cron.schedule('mvp_pending_conversation_expiry', '*/15 * * * *',
    $$SELECT public.expire_pending_conversations();$$);

SELECT cron.schedule('mvp_expired_conversation_purge', '15 * * * *',
    $$SELECT public.purge_expired_conversations();$$);

SELECT cron.schedule('mvp_blocked_message_purge', '45 18 * * *',
    $$SELECT public.purge_blocked_messages();$$);

SELECT cron.schedule('mvp_report_archival', '0 19 * * *',
    $$SELECT public.archive_old_reports();$$);

SELECT cron.schedule('mvp_account_deletion_purge', '30 19 * * *',
    $$SELECT public.purge_due_account_deletions();$$);

SELECT cron.schedule('mvp_expired_account_ban_reinstatement', '*/15 * * * *',
    $$SELECT public.reinstate_expired_account_bans();$$);

SELECT cron.schedule('mvp_due_city_change_apply', '*/15 * * * *',
    $$SELECT public.apply_due_city_changes();$$);

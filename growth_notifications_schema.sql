-- Phase 7 Growth & Notifications.
-- Apply after chat_approval_schema.sql and call_history_schema.sql.

ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS notification_preferences jsonb NOT NULL DEFAULT
    '{"likes": true, "chat_requests": true, "live_matches": true, "welcome": true}'::jsonb;

UPDATE public.profiles
SET notification_preferences =
    '{"likes": true, "chat_requests": true, "live_matches": true, "welcome": true}'::jsonb
    || COALESCE(notification_preferences, '{}'::jsonb)
WHERE notification_preferences IS NULL
   OR NOT (
      notification_preferences ? 'likes'
      AND notification_preferences ? 'chat_requests'
      AND notification_preferences ? 'live_matches'
      AND notification_preferences ? 'welcome'
   );

ALTER TABLE public.profiles
ALTER COLUMN notification_preferences SET DEFAULT
    '{"likes": true, "chat_requests": true, "live_matches": true, "welcome": true}'::jsonb;

ALTER TABLE public.profiles
ALTER COLUMN notification_preferences SET NOT NULL;

CREATE TABLE IF NOT EXISTS public.waitlist_entries (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now(),
    peer_id text NOT NULL REFERENCES public.profiles(peer_id) ON DELETE CASCADE,
    referred_by text REFERENCES public.profiles(peer_id) ON DELETE SET NULL,
    invite_code text NOT NULL DEFAULT substring(replace(gen_random_uuid()::text, '-', '') from 1 for 12),
    queue_position int NOT NULL,
    referral_count int NOT NULL DEFAULT 0,
    status text NOT NULL DEFAULT 'waiting' CHECK (status IN ('waiting', 'invited', 'joined')),
    metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
    UNIQUE (peer_id),
    UNIQUE (invite_code)
);

CREATE INDEX IF NOT EXISTS waitlist_entries_queue_position_idx
ON public.waitlist_entries (queue_position ASC);

CREATE TABLE IF NOT EXISTS public.waitlist_referrals (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    created_at timestamptz DEFAULT now(),
    referrer_peer_id text NOT NULL REFERENCES public.profiles(peer_id) ON DELETE CASCADE,
    referred_peer_id text NOT NULL REFERENCES public.profiles(peer_id) ON DELETE CASCADE,
    queue_bump int NOT NULL DEFAULT 5,
    UNIQUE (referred_peer_id),
    CHECK (referrer_peer_id <> referred_peer_id)
);

CREATE INDEX IF NOT EXISTS waitlist_referrals_referrer_idx
ON public.waitlist_referrals (referrer_peer_id, created_at DESC);

CREATE OR REPLACE VIEW public.waitlist
WITH (security_invoker = true)
AS
SELECT
    id,
    peer_id,
    queue_position AS position,
    referred_by,
    invite_code,
    referral_count,
    status,
    created_at AS joined_at,
    updated_at
FROM public.waitlist_entries;

CREATE TABLE IF NOT EXISTS public.notification_push_tokens (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now(),
    last_seen_at timestamptz DEFAULT now(),
    peer_id text NOT NULL REFERENCES public.profiles(peer_id) ON DELETE CASCADE,
    token text NOT NULL,
    platform text NOT NULL CHECK (platform IN ('android', 'ios', 'web')),
    provider text NOT NULL DEFAULT 'fcm',
    enabled boolean NOT NULL DEFAULT true,
    UNIQUE (token)
);

CREATE INDEX IF NOT EXISTS notification_push_tokens_peer_idx
ON public.notification_push_tokens (peer_id, enabled);

CREATE TABLE IF NOT EXISTS public.notification_events (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    created_at timestamptz DEFAULT now(),
    queued_at timestamptz,
    sent_at timestamptz,
    recipient_peer_id text NOT NULL REFERENCES public.profiles(peer_id) ON DELETE CASCADE,
    trigger_type text NOT NULL CHECK (
        trigger_type IN (
            'welcome',
            'like_received',
            'super_like_received',
            'chat_request_received',
            'chat_approved',
            'chat_declined',
            'live_match_found'
        )
    ),
    title text NOT NULL,
    body text NOT NULL,
    data jsonb NOT NULL DEFAULT '{}'::jsonb,
    status text NOT NULL DEFAULT 'queued' CHECK (status IN ('queued', 'skipped', 'sent', 'failed')),
    error text
);

CREATE INDEX IF NOT EXISTS notification_events_status_created_idx
ON public.notification_events (status, created_at ASC);

CREATE INDEX IF NOT EXISTS notification_events_recipient_created_idx
ON public.notification_events (recipient_peer_id, created_at DESC);

ALTER TABLE public.waitlist_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.waitlist_referrals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notification_push_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notification_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can read own waitlist entry" ON public.waitlist_entries;
DROP POLICY IF EXISTS "Users can insert own waitlist entry" ON public.waitlist_entries;
DROP POLICY IF EXISTS "Users can update own waitlist entry" ON public.waitlist_entries;
CREATE POLICY "Users can read own waitlist entry" ON public.waitlist_entries
FOR SELECT TO authenticated
USING (
    EXISTS (
        SELECT 1
        FROM public.profiles p
        WHERE p.peer_id = waitlist_entries.peer_id
          AND p.user_id = auth.uid()
    )
);
CREATE POLICY "Users can insert own waitlist entry" ON public.waitlist_entries
FOR INSERT TO authenticated
WITH CHECK (
    EXISTS (
        SELECT 1
        FROM public.profiles p
        WHERE p.peer_id = waitlist_entries.peer_id
          AND p.user_id = auth.uid()
    )
);
CREATE POLICY "Users can update own waitlist entry" ON public.waitlist_entries
FOR UPDATE TO authenticated
USING (
    EXISTS (
        SELECT 1
        FROM public.profiles p
        WHERE p.peer_id = waitlist_entries.peer_id
          AND p.user_id = auth.uid()
    )
)
WITH CHECK (
    EXISTS (
        SELECT 1
        FROM public.profiles p
        WHERE p.peer_id = waitlist_entries.peer_id
          AND p.user_id = auth.uid()
    )
);

DROP POLICY IF EXISTS "Users can read own waitlist referrals" ON public.waitlist_referrals;
CREATE POLICY "Users can read own waitlist referrals" ON public.waitlist_referrals
FOR SELECT TO authenticated
USING (
    EXISTS (
        SELECT 1
        FROM public.profiles p
        WHERE p.user_id = auth.uid()
          AND p.peer_id IN (waitlist_referrals.referrer_peer_id, waitlist_referrals.referred_peer_id)
    )
);

DROP POLICY IF EXISTS "Users manage own push tokens" ON public.notification_push_tokens;
CREATE POLICY "Users manage own push tokens" ON public.notification_push_tokens
FOR ALL TO authenticated
USING (
    EXISTS (
        SELECT 1
        FROM public.profiles p
        WHERE p.peer_id = notification_push_tokens.peer_id
          AND p.user_id = auth.uid()
    )
)
WITH CHECK (
    EXISTS (
        SELECT 1
        FROM public.profiles p
        WHERE p.peer_id = notification_push_tokens.peer_id
          AND p.user_id = auth.uid()
    )
);

DROP POLICY IF EXISTS "Users read own notification events" ON public.notification_events;
CREATE POLICY "Users read own notification events" ON public.notification_events
FOR SELECT TO authenticated
USING (
    EXISTS (
        SELECT 1
        FROM public.profiles p
        WHERE p.peer_id = notification_events.recipient_peer_id
          AND p.user_id = auth.uid()
    )
);

CREATE OR REPLACE FUNCTION public.apply_invite_referral(
    p_new_peer_id text,
    p_referrer_peer_id text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_position int;
    v_existing public.waitlist_entries%ROWTYPE;
    v_bump int := 5;
    v_referral_rows int := 0;
BEGIN
    IF p_new_peer_id IS NULL OR length(trim(p_new_peer_id)) = 0 THEN
        RETURN jsonb_build_object('success', false, 'error', 'peer_id_required');
    END IF;

    IF NOT EXISTS (
        SELECT 1
        FROM public.profiles p
        WHERE p.peer_id = p_new_peer_id
    ) THEN
        RETURN jsonb_build_object('success', false, 'error', 'profile_not_found');
    END IF;

    PERFORM pg_advisory_xact_lock(hashtext('waitlist_referral_bump'));

    SELECT * INTO v_existing
    FROM public.waitlist_entries
    WHERE peer_id = p_new_peer_id
    FOR UPDATE;

    IF FOUND THEN
        RETURN jsonb_build_object(
            'success', true,
            'is_new', false,
            'queue_position', v_existing.queue_position,
            'invite_code', v_existing.invite_code,
            'referral_count', v_existing.referral_count
        );
    END IF;

    SELECT COALESCE(max(queue_position), 0) + 1
    INTO v_position
    FROM public.waitlist_entries;

    INSERT INTO public.waitlist_entries (peer_id, referred_by, queue_position)
    VALUES (p_new_peer_id, NULLIF(p_referrer_peer_id, p_new_peer_id), v_position)
    RETURNING * INTO v_existing;

    IF p_referrer_peer_id IS NOT NULL AND p_referrer_peer_id <> p_new_peer_id THEN
        INSERT INTO public.waitlist_referrals (referrer_peer_id, referred_peer_id, queue_bump)
        VALUES (p_referrer_peer_id, p_new_peer_id, v_bump)
        ON CONFLICT (referred_peer_id) DO NOTHING;

        GET DIAGNOSTICS v_referral_rows = ROW_COUNT;

        IF v_referral_rows > 0 THEN
            UPDATE public.waitlist_entries
            SET referral_count = referral_count + 1,
                queue_position = GREATEST(1, queue_position - v_bump),
                updated_at = now()
            WHERE peer_id = p_referrer_peer_id;
        END IF;
    END IF;

    RETURN jsonb_build_object(
        'success', true,
        'is_new', true,
        'queue_position', v_existing.queue_position,
        'invite_code', v_existing.invite_code,
        'referral_count', v_existing.referral_count,
        'referred_by', v_existing.referred_by
    );
END;
$$;

CREATE OR REPLACE FUNCTION public.join_waitlist(
    p_peer_id text,
    p_referred_by text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_position int;
    v_existing public.waitlist_entries%ROWTYPE;
    v_bump int := 5;
    v_referral_rows int := 0;
BEGIN
    IF p_peer_id IS NULL OR length(trim(p_peer_id)) = 0 THEN
        RETURN jsonb_build_object('success', false, 'error', 'peer_id_required');
    END IF;

    IF NOT EXISTS (
        SELECT 1
        FROM public.profiles p
        WHERE p.peer_id = p_peer_id
          AND p.user_id = auth.uid()
    ) THEN
        RETURN jsonb_build_object('success', false, 'error', 'profile_not_owned');
    END IF;

    PERFORM pg_advisory_xact_lock(hashtext('waitlist_referral_bump'));

    SELECT * INTO v_existing
    FROM public.waitlist_entries
    WHERE peer_id = p_peer_id
    FOR UPDATE;

    IF FOUND THEN
        RETURN jsonb_build_object(
            'success', true,
            'is_new', false,
            'queue_position', v_existing.queue_position,
            'invite_code', v_existing.invite_code,
            'referral_count', v_existing.referral_count
        );
    END IF;

    SELECT COALESCE(max(queue_position), 0) + 1
    INTO v_position
    FROM public.waitlist_entries;

    INSERT INTO public.waitlist_entries (peer_id, referred_by, queue_position)
    VALUES (p_peer_id, NULLIF(p_referred_by, p_peer_id), v_position)
    RETURNING * INTO v_existing;

    IF p_referred_by IS NOT NULL AND p_referred_by <> p_peer_id THEN
        INSERT INTO public.waitlist_referrals (referrer_peer_id, referred_peer_id, queue_bump)
        VALUES (p_referred_by, p_peer_id, v_bump)
        ON CONFLICT (referred_peer_id) DO NOTHING;

        GET DIAGNOSTICS v_referral_rows = ROW_COUNT;

        IF v_referral_rows > 0 THEN
            UPDATE public.waitlist_entries
            SET referral_count = referral_count + 1,
                queue_position = GREATEST(1, queue_position - v_bump),
                updated_at = now()
            WHERE peer_id = p_referred_by;
        END IF;
    END IF;

    RETURN jsonb_build_object(
        'success', true,
        'is_new', true,
        'queue_position', v_existing.queue_position,
        'invite_code', v_existing.invite_code,
        'referral_count', v_existing.referral_count,
        'referred_by', v_existing.referred_by
    );
END;
$$;

CREATE OR REPLACE FUNCTION public.notification_preference_key(p_trigger_type text)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$
    SELECT CASE p_trigger_type
        WHEN 'welcome' THEN 'welcome'
        WHEN 'like_received' THEN 'likes'
        WHEN 'super_like_received' THEN 'likes'
        WHEN 'chat_request_received' THEN 'chat_requests'
        WHEN 'chat_approved' THEN 'chat_requests'
        WHEN 'chat_declined' THEN 'chat_requests'
        WHEN 'live_match_found' THEN 'live_matches'
        ELSE NULL
    END;
$$;

CREATE OR REPLACE FUNCTION public.queue_notification_event(
    p_recipient_peer_id text,
    p_trigger_type text,
    p_title text,
    p_body text,
    p_data jsonb DEFAULT '{}'::jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_preferences jsonb;
    v_preference_key text;
    v_enabled boolean := true;
    v_status text := 'queued';
    v_event_id uuid;
BEGIN
    SELECT notification_preferences INTO v_preferences
    FROM public.profiles
    WHERE peer_id = p_recipient_peer_id;

    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'recipient_not_found');
    END IF;

    v_preference_key := public.notification_preference_key(p_trigger_type);
    IF v_preference_key IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'unsupported_trigger');
    END IF;

    v_enabled := COALESCE((v_preferences ->> v_preference_key)::boolean, true);
    IF NOT v_enabled THEN
        v_status := 'skipped';
    END IF;

    INSERT INTO public.notification_events (
        recipient_peer_id,
        trigger_type,
        title,
        body,
        data,
        status,
        queued_at
    )
    VALUES (
        p_recipient_peer_id,
        p_trigger_type,
        p_title,
        p_body,
        COALESCE(p_data, '{}'::jsonb),
        v_status,
        CASE WHEN v_status = 'queued' THEN now() ELSE NULL END
    )
    RETURNING id INTO v_event_id;

    RETURN jsonb_build_object(
        'success', true,
        'event_id', v_event_id,
        'status', v_status
    );
END;
$$;

CREATE OR REPLACE FUNCTION public.queue_welcome_notification()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    PERFORM public.queue_notification_event(
        NEW.peer_id,
        'welcome',
        'Welcome to Komorembi',
        'Your vibe is live. Start discovering people.',
        jsonb_build_object('peer_id', NEW.peer_id)
    );
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS profiles_after_insert_queue_welcome ON public.profiles;
CREATE TRIGGER profiles_after_insert_queue_welcome
AFTER INSERT ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.queue_welcome_notification();

CREATE OR REPLACE FUNCTION public.queue_like_notification()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    PERFORM public.queue_notification_event(
        NEW.to_peer_id,
        'like_received',
        'Someone likes you',
        'Open Komorembi to review your new vibe.',
        jsonb_build_object('actor_peer_id', NEW.from_peer_id, 'like_id', NEW.id)
    );
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS likes_after_insert_queue_push ON public.likes;
CREATE TRIGGER likes_after_insert_queue_push
AFTER INSERT ON public.likes
FOR EACH ROW EXECUTE FUNCTION public.queue_like_notification();

CREATE OR REPLACE FUNCTION public.queue_chat_request_notification()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_recipient_peer_id text;
BEGIN
    IF NEW.status <> 'pending' OR NEW.initiator_peer_id IS NULL THEN
        RETURN NEW;
    END IF;

    v_recipient_peer_id := CASE
        WHEN NEW.initiator_peer_id = NEW.user1_peer_id THEN NEW.user2_peer_id
        ELSE NEW.user1_peer_id
    END;

    PERFORM public.queue_notification_event(
        v_recipient_peer_id,
        'chat_request_received',
        'New chat request',
        'Someone wants to start a conversation with you.',
        jsonb_build_object(
            'chat_id', NEW.id,
            'actor_peer_id', NEW.initiator_peer_id,
            'priority', NEW.priority
        )
    );
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS chats_after_insert_queue_request ON public.chats;
CREATE TRIGGER chats_after_insert_queue_request
AFTER INSERT ON public.chats
FOR EACH ROW EXECUTE FUNCTION public.queue_chat_request_notification();

CREATE OR REPLACE FUNCTION public.queue_chat_status_notification()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_trigger_type text;
    v_title text;
    v_body text;
BEGIN
    IF OLD.status = NEW.status OR NEW.initiator_peer_id IS NULL THEN
        RETURN NEW;
    END IF;

    IF OLD.status = 'pending' AND NEW.status = 'approved' THEN
        v_trigger_type := 'chat_approved';
        v_title := 'Chat approved';
        v_body := 'Your conversation is open now.';
    ELSIF OLD.status = 'pending' AND NEW.status = 'declined' THEN
        v_trigger_type := 'chat_declined';
        v_title := 'Chat request update';
        v_body := 'Your chat request was declined.';
    ELSE
        RETURN NEW;
    END IF;

    PERFORM public.queue_notification_event(
        NEW.initiator_peer_id,
        v_trigger_type,
        v_title,
        v_body,
        jsonb_build_object('chat_id', NEW.id, 'status', NEW.status)
    );
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS chats_after_update_queue_status ON public.chats;
CREATE TRIGGER chats_after_update_queue_status
AFTER UPDATE OF status ON public.chats
FOR EACH ROW EXECUTE FUNCTION public.queue_chat_status_notification();

CREATE OR REPLACE FUNCTION public.queue_live_match_notification()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    IF OLD.status IS DISTINCT FROM NEW.status
       AND NEW.status = 'matched'
       AND NEW.matched_with IS NOT NULL THEN
        PERFORM public.queue_notification_event(
            NEW.peer_id,
            'live_match_found',
            'Live match found',
            'Your video match is ready.',
            jsonb_build_object(
                'matched_with', NEW.matched_with,
                'session_id', NEW.session_id
            )
        );
    END IF;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS waiting_room_after_match_queue_push ON public.waiting_room;
CREATE TRIGGER waiting_room_after_match_queue_push
AFTER UPDATE OF status ON public.waiting_room
FOR EACH ROW EXECUTE FUNCTION public.queue_live_match_notification();

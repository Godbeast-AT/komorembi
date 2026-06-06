-- Phase 1: Supabase Phone OTP auth lifecycle contracts.
-- App-owned tables keep only phone_hash; Supabase Auth remains the source of the verified phone.

CREATE TABLE IF NOT EXISTS public.user_auth_records (
    user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    phone_hash text NOT NULL UNIQUE,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (user_id)
);

CREATE TABLE IF NOT EXISTS public.device_sessions (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    device_id text NOT NULL,
    platform text NOT NULL DEFAULT 'web',
    last_seen_at timestamptz NOT NULL DEFAULT now(),
    revoked_at timestamptz,
    created_at timestamptz NOT NULL DEFAULT now(),
    UNIQUE (user_id, device_id)
);

CREATE TABLE IF NOT EXISTS public.account_deletion_requests (
    user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    peer_id text,
    requested_at timestamptz NOT NULL DEFAULT now(),
    purge_after timestamptz NOT NULL DEFAULT (now() + interval '14 days'),
    status text NOT NULL DEFAULT 'pending_grace_period'
        CHECK (status IN ('pending_grace_period', 'cancelled', 'purged')),
    immediate_actions text[] NOT NULL DEFAULT ARRAY[
        'close_active_conversations',
        'hide_profile_from_feed',
        'delete_profile_photos',
        'anonymize_sender_display'
    ],
    cancelled_at timestamptz,
    PRIMARY KEY (user_id)
);

GRANT SELECT, INSERT, UPDATE ON public.user_auth_records TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.device_sessions TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.account_deletion_requests TO authenticated;

ALTER TABLE public.user_auth_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.device_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.account_deletion_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can read their own auth record" ON public.user_auth_records;
CREATE POLICY "Users can read their own auth record"
ON public.user_auth_records FOR SELECT
TO authenticated
USING (auth.uid() IS NOT NULL AND auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert their own auth record" ON public.user_auth_records;
CREATE POLICY "Users can insert their own auth record"
ON public.user_auth_records FOR INSERT
TO authenticated
WITH CHECK (auth.uid() IS NOT NULL AND auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update their own auth record" ON public.user_auth_records;
CREATE POLICY "Users can update their own auth record"
ON public.user_auth_records FOR UPDATE
TO authenticated
USING (auth.uid() IS NOT NULL AND auth.uid() = user_id)
WITH CHECK (auth.uid() IS NOT NULL AND auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can read their own device sessions" ON public.device_sessions;
CREATE POLICY "Users can read their own device sessions"
ON public.device_sessions FOR SELECT
TO authenticated
USING (auth.uid() IS NOT NULL AND auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert their own device sessions" ON public.device_sessions;
CREATE POLICY "Users can insert their own device sessions"
ON public.device_sessions FOR INSERT
TO authenticated
WITH CHECK (auth.uid() IS NOT NULL AND auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update their own device sessions" ON public.device_sessions;
CREATE POLICY "Users can update their own device sessions"
ON public.device_sessions FOR UPDATE
TO authenticated
USING (auth.uid() IS NOT NULL AND auth.uid() = user_id)
WITH CHECK (auth.uid() IS NOT NULL AND auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can read their own deletion request" ON public.account_deletion_requests;
CREATE POLICY "Users can read their own deletion request"
ON public.account_deletion_requests FOR SELECT
TO authenticated
USING (auth.uid() IS NOT NULL AND auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert their own deletion request" ON public.account_deletion_requests;
CREATE POLICY "Users can insert their own deletion request"
ON public.account_deletion_requests FOR INSERT
TO authenticated
WITH CHECK (auth.uid() IS NOT NULL AND auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update their own deletion request" ON public.account_deletion_requests;
CREATE POLICY "Users can update their own deletion request"
ON public.account_deletion_requests FOR UPDATE
TO authenticated
USING (auth.uid() IS NOT NULL AND auth.uid() = user_id)
WITH CHECK (auth.uid() IS NOT NULL AND auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.record_device_session(
    p_device_id text,
    p_platform text DEFAULT 'web'
)
RETURNS public.device_sessions
LANGUAGE plpgsql
AS $$
DECLARE
    v_session public.device_sessions;
BEGIN
    IF auth.uid() IS NULL THEN
        RAISE EXCEPTION 'Authentication required';
    END IF;

    INSERT INTO public.device_sessions (
        user_id,
        device_id,
        platform,
        last_seen_at,
        revoked_at
    )
    VALUES (
        auth.uid(),
        p_device_id,
        COALESCE(NULLIF(p_platform, ''), 'web'),
        now(),
        NULL
    )
    ON CONFLICT (user_id, device_id)
    DO UPDATE SET
        platform = EXCLUDED.platform,
        last_seen_at = now(),
        revoked_at = NULL
    RETURNING * INTO v_session;

    RETURN v_session;
END;
$$;

CREATE OR REPLACE FUNCTION public.invalidate_all_sessions()
RETURNS integer
LANGUAGE plpgsql
AS $$
DECLARE
    v_count integer;
BEGIN
    IF auth.uid() IS NULL THEN
        RAISE EXCEPTION 'Authentication required';
    END IF;

    UPDATE public.device_sessions
    SET revoked_at = now()
    WHERE user_id = auth.uid()
      AND revoked_at IS NULL;

    GET DIAGNOSTICS v_count = ROW_COUNT;
    RETURN v_count;
END;
$$;

CREATE OR REPLACE FUNCTION public.request_account_deletion(p_peer_id text DEFAULT NULL)
RETURNS public.account_deletion_requests
LANGUAGE plpgsql
AS $$
DECLARE
    v_request public.account_deletion_requests;
    v_peer_id text := p_peer_id;
BEGIN
    IF auth.uid() IS NULL THEN
        RAISE EXCEPTION 'Authentication required';
    END IF;

    IF v_peer_id IS NULL AND to_regclass('public.profiles') IS NOT NULL THEN
        EXECUTE 'SELECT peer_id FROM public.profiles WHERE user_id = $1 LIMIT 1'
        INTO v_peer_id
        USING auth.uid();
    END IF;

    INSERT INTO public.account_deletion_requests (
        user_id,
        peer_id,
        requested_at,
        purge_after,
        status,
        immediate_actions,
        cancelled_at
    )
    VALUES (
        auth.uid(),
        v_peer_id,
        now(),
        now() + interval '14 days',
        'pending_grace_period',
        ARRAY[
            'close_active_conversations',
            'hide_profile_from_feed',
            'delete_profile_photos',
            'anonymize_sender_display'
        ],
        NULL
    )
    ON CONFLICT (user_id)
    DO UPDATE SET
        peer_id = EXCLUDED.peer_id,
        requested_at = now(),
        purge_after = now() + interval '14 days',
        status = 'pending_grace_period',
        immediate_actions = EXCLUDED.immediate_actions,
        cancelled_at = NULL
    RETURNING * INTO v_request;

    IF v_peer_id IS NOT NULL AND to_regclass('public.chats') IS NOT NULL THEN
        EXECUTE
            'UPDATE public.chats
             SET status = CASE WHEN status = ''pending'' THEN ''declined'' ELSE status END
             WHERE user1_peer_id = $1 OR user2_peer_id = $1'
        USING v_peer_id;
    END IF;

    IF to_regclass('public.conversations') IS NOT NULL THEN
        EXECUTE
            'UPDATE public.conversations
             SET status = ''closed'', closed_at = COALESCE(closed_at, now())
             WHERE user1_id = $1 OR user2_id = $1'
        USING auth.uid();
    END IF;

    IF to_regclass('public.profiles') IS NOT NULL THEN
        EXECUTE
            'UPDATE public.profiles
             SET display_name = ''Deleted User'',
                 photos = ''{}''::text[],
                 shadow_banned = true
             WHERE user_id = $1'
        USING auth.uid();
    END IF;

    DELETE FROM storage.objects
    WHERE bucket_id = 'avatars'
      AND (
        (v_peer_id IS NOT NULL AND name LIKE v_peer_id || '/%')
        OR name LIKE auth.uid()::text || '/%'
      );

    IF v_peer_id IS NOT NULL AND to_regclass('public.messages') IS NOT NULL THEN
        EXECUTE
            'UPDATE public.messages
             SET content = content
             WHERE sender_peer_id = $1'
        USING v_peer_id;

        IF EXISTS (
            SELECT 1
            FROM information_schema.columns
            WHERE table_schema = 'public'
              AND table_name = 'messages'
              AND column_name = 'sender_display_name'
        ) THEN
            EXECUTE
                'UPDATE public.messages
                 SET sender_display_name = ''Deleted User''
                 WHERE sender_peer_id = $1'
            USING v_peer_id;
        END IF;
    END IF;

    RETURN v_request;
END;
$$;

CREATE OR REPLACE FUNCTION public.cancel_account_deletion()
RETURNS public.account_deletion_requests
LANGUAGE plpgsql
AS $$
DECLARE
    v_request public.account_deletion_requests;
BEGIN
    IF auth.uid() IS NULL THEN
        RAISE EXCEPTION 'Authentication required';
    END IF;

    UPDATE public.account_deletion_requests
    SET status = 'cancelled',
        cancelled_at = now()
    WHERE user_id = auth.uid()
      AND status = 'pending_grace_period'
    RETURNING * INTO v_request;

    IF v_request.user_id IS NULL THEN
        RAISE EXCEPTION 'No active deletion request found';
    END IF;

    RETURN v_request;
END;
$$;

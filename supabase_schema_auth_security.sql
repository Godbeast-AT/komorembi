-- Auth, security, reports, blocks, and moderation queue.
-- Apply after supabase_schema.sql.

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT COALESCE(auth.jwt()->'app_metadata'->>'role', '') IN ('admin', 'moderator');
$$;

CREATE TABLE IF NOT EXISTS public.banned_devices (
    device_id text PRIMARY KEY,
    peer_id text REFERENCES public.profiles(peer_id) ON DELETE SET NULL,
    reason text,
    created_at timestamptz DEFAULT now()
);

ALTER TABLE public.banned_devices
ADD COLUMN IF NOT EXISTS peer_id text REFERENCES public.profiles(peer_id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS reason text,
ADD COLUMN IF NOT EXISTS created_at timestamptz DEFAULT now();

ALTER TABLE public.banned_devices ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow public check for bans" ON public.banned_devices;
DROP POLICY IF EXISTS "Admins manage banned devices" ON public.banned_devices;
CREATE POLICY "Allow public check for bans" ON public.banned_devices
FOR SELECT
USING (true);
CREATE POLICY "Admins manage banned devices" ON public.banned_devices
FOR ALL
USING (public.is_admin())
WITH CHECK (public.is_admin());

CREATE TABLE IF NOT EXISTS public.blocked_users (
    blocker_peer_id text NOT NULL REFERENCES public.profiles(peer_id) ON DELETE CASCADE,
    blocked_peer_id text NOT NULL REFERENCES public.profiles(peer_id) ON DELETE CASCADE,
    created_at timestamptz DEFAULT now(),
    PRIMARY KEY (blocker_peer_id, blocked_peer_id)
);

ALTER TABLE public.blocked_users DROP CONSTRAINT IF EXISTS blocked_users_pkey;
ALTER TABLE public.blocked_users DROP COLUMN IF EXISTS id;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'blocked_users_pkey'
          AND conrelid = 'public.blocked_users'::regclass
    ) THEN
        ALTER TABLE public.blocked_users
        ADD CONSTRAINT blocked_users_pkey PRIMARY KEY (blocker_peer_id, blocked_peer_id);
    END IF;
END;
$$;

ALTER TABLE public.blocked_users DROP CONSTRAINT IF EXISTS blocked_users_blocker_peer_id_fkey;
ALTER TABLE public.blocked_users DROP CONSTRAINT IF EXISTS blocked_users_blocked_peer_id_fkey;

ALTER TABLE public.blocked_users
    ADD CONSTRAINT blocked_users_blocker_peer_id_fkey
    FOREIGN KEY (blocker_peer_id) REFERENCES public.profiles(peer_id) ON DELETE CASCADE;

ALTER TABLE public.blocked_users
    ADD CONSTRAINT blocked_users_blocked_peer_id_fkey
    FOREIGN KEY (blocked_peer_id) REFERENCES public.profiles(peer_id) ON DELETE CASCADE;

ALTER TABLE public.blocked_users ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow block management" ON public.blocked_users;
DROP POLICY IF EXISTS "Users manage own blocked users" ON public.blocked_users;
DROP POLICY IF EXISTS "Admins read blocked users" ON public.blocked_users;
CREATE POLICY "Users manage own blocked users" ON public.blocked_users
FOR ALL
USING (
    EXISTS (
        SELECT 1
        FROM public.profiles p
        WHERE p.peer_id = blocker_peer_id
          AND p.user_id = auth.uid()
    )
)
WITH CHECK (
    EXISTS (
        SELECT 1
        FROM public.profiles p
        WHERE p.peer_id = blocker_peer_id
          AND p.user_id = auth.uid()
    )
);
CREATE POLICY "Admins read blocked users" ON public.blocked_users
FOR SELECT
USING (public.is_admin());

CREATE OR REPLACE VIEW public.user_blocks
WITH (security_invoker = true)
AS
SELECT
    bu.blocker_peer_id,
    bu.blocked_peer_id,
    bu.created_at
FROM public.blocked_users bu;

CREATE TABLE IF NOT EXISTS public.reports (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    reporter_id text REFERENCES public.profiles(peer_id) ON DELETE CASCADE,
    reported_id text REFERENCES public.profiles(peer_id) ON DELETE CASCADE,
    reason text,
    reason_detail text,
    timestamp timestamptz DEFAULT now(),
    session_context jsonb DEFAULT '{}'::jsonb,
    context jsonb DEFAULT '{}'::jsonb,
    resolved boolean DEFAULT false
);

ALTER TABLE public.reports
ADD COLUMN IF NOT EXISTS reporter_id text REFERENCES public.profiles(peer_id) ON DELETE CASCADE,
ADD COLUMN IF NOT EXISTS reported_id text REFERENCES public.profiles(peer_id) ON DELETE CASCADE,
ADD COLUMN IF NOT EXISTS reason text,
ADD COLUMN IF NOT EXISTS reason_detail text,
ADD COLUMN IF NOT EXISTS timestamp timestamptz DEFAULT now(),
ADD COLUMN IF NOT EXISTS session_context jsonb DEFAULT '{}'::jsonb,
ADD COLUMN IF NOT EXISTS context jsonb DEFAULT '{}'::jsonb,
ADD COLUMN IF NOT EXISTS resolved boolean DEFAULT false;

UPDATE public.reports
SET reason = 'other'
WHERE reason IS NULL
   OR reason NOT IN (
      'harassment',
      'spam',
      'fake profile',
      'inappropriate content',
      'underage concern',
      'other'
   );

UPDATE public.reports
SET session_context = COALESCE(session_context, context, '{}'::jsonb),
    resolved = COALESCE(resolved, false);

ALTER TABLE public.reports ALTER COLUMN reporter_id SET NOT NULL;
ALTER TABLE public.reports ALTER COLUMN reported_id SET NOT NULL;
ALTER TABLE public.reports ALTER COLUMN reason SET NOT NULL;
ALTER TABLE public.reports ALTER COLUMN timestamp SET DEFAULT now();
ALTER TABLE public.reports ALTER COLUMN session_context SET DEFAULT '{}'::jsonb;
ALTER TABLE public.reports ALTER COLUMN resolved SET DEFAULT false;

ALTER TABLE public.reports DROP CONSTRAINT IF EXISTS reports_reason_check;
ALTER TABLE public.reports
ADD CONSTRAINT reports_reason_check
CHECK (
    reason IN (
        'harassment',
        'spam',
        'fake profile',
        'inappropriate content',
        'underage concern',
        'other'
    )
);

CREATE INDEX IF NOT EXISTS reports_reported_timestamp_idx
ON public.reports (reported_id, timestamp DESC);

ALTER TABLE public.reports ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can insert their own reports" ON public.reports;
DROP POLICY IF EXISTS "Users can read their own reports" ON public.reports;
DROP POLICY IF EXISTS "Admins read all reports" ON public.reports;
DROP POLICY IF EXISTS "Admins update reports" ON public.reports;
CREATE POLICY "Users can insert their own reports" ON public.reports
FOR INSERT
WITH CHECK (
    EXISTS (
        SELECT 1
        FROM public.profiles p
        WHERE p.peer_id = reporter_id
          AND p.user_id = auth.uid()
    )
);
CREATE POLICY "Users can read their own reports" ON public.reports
FOR SELECT
USING (
    EXISTS (
        SELECT 1
        FROM public.profiles p
        WHERE p.peer_id = reporter_id
          AND p.user_id = auth.uid()
    )
);
CREATE POLICY "Admins read all reports" ON public.reports
FOR SELECT
USING (public.is_admin());
CREATE POLICY "Admins update reports" ON public.reports
FOR UPDATE
USING (public.is_admin())
WITH CHECK (public.is_admin());

CREATE OR REPLACE FUNCTION public.process_report_safety()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_recent_reports int := 0;
BEGIN
    UPDATE public.profiles
    SET trust_score = GREATEST(0, COALESCE(trust_score, 100) - 5)
    WHERE peer_id = NEW.reported_id;

    SELECT count(*) INTO v_recent_reports
    FROM public.reports r
    WHERE r.reported_id = NEW.reported_id
      AND r.timestamp >= now() - interval '24 hours';

    IF v_recent_reports >= 3 THEN
        UPDATE public.profiles
        SET flagged_for_review = true,
            is_in_review = true
        WHERE peer_id = NEW.reported_id;
    END IF;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS reports_after_insert_safety ON public.reports;
CREATE TRIGGER reports_after_insert_safety
AFTER INSERT ON public.reports
FOR EACH ROW EXECUTE FUNCTION public.process_report_safety();

DROP POLICY IF EXISTS "Admins read flagged profiles" ON public.profiles;
DROP POLICY IF EXISTS "Admins update flagged profiles" ON public.profiles;
CREATE POLICY "Admins read flagged profiles" ON public.profiles
FOR SELECT
USING (public.is_admin());
CREATE POLICY "Admins update flagged profiles" ON public.profiles
FOR UPDATE
USING (public.is_admin())
WITH CHECK (public.is_admin());

CREATE OR REPLACE VIEW public.moderation_queue
WITH (security_invoker = true)
AS
SELECT
    p.peer_id,
    p.display_name,
    p.photos,
    p.trust_score,
    p.flagged_for_review,
    p.is_in_review,
    p.shadow_banned,
    p.banned,
    p.warning_count,
    count(r.id)::int AS report_count,
    array_remove(array_agg(DISTINCT r.reason), NULL) AS report_reasons,
    max(r.timestamp) AS latest_report_at
FROM public.profiles p
LEFT JOIN public.reports r ON r.reported_id = p.peer_id
WHERE COALESCE(p.flagged_for_review, false) = true
   OR COALESCE(p.is_in_review, false) = true
GROUP BY
    p.peer_id,
    p.display_name,
    p.photos,
    p.trust_score,
    p.flagged_for_review,
    p.is_in_review,
    p.shadow_banned,
    p.banned,
    p.warning_count
ORDER BY max(r.timestamp) DESC NULLS LAST;

CREATE OR REPLACE FUNCTION public.moderation_clear_flag(p_peer_id text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    IF NOT public.is_admin() THEN
        RAISE EXCEPTION 'admin_only';
    END IF;

    UPDATE public.profiles
    SET flagged_for_review = false,
        is_in_review = false
    WHERE peer_id = p_peer_id;

    UPDATE public.reports
    SET resolved = true
    WHERE reported_id = p_peer_id;

    RETURN jsonb_build_object('success', true);
END;
$$;

CREATE OR REPLACE FUNCTION public.moderation_warn_user(p_peer_id text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    IF NOT public.is_admin() THEN
        RAISE EXCEPTION 'admin_only';
    END IF;

    UPDATE public.profiles
    SET warning_count = COALESCE(warning_count, 0) + 1,
        flagged_for_review = false
    WHERE peer_id = p_peer_id;

    RETURN jsonb_build_object('success', true);
END;
$$;

CREATE OR REPLACE FUNCTION public.moderation_ban_user(
    p_peer_id text,
    p_device_id text DEFAULT NULL,
    p_reason text DEFAULT 'moderation ban'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    IF NOT public.is_admin() THEN
        RAISE EXCEPTION 'admin_only';
    END IF;

    UPDATE public.profiles
    SET banned = true,
        shadow_banned = true,
        flagged_for_review = false,
        is_in_review = false
    WHERE peer_id = p_peer_id;

    IF p_device_id IS NOT NULL AND length(trim(p_device_id)) > 0 THEN
        INSERT INTO public.banned_devices (device_id, peer_id, reason)
        VALUES (p_device_id, p_peer_id, p_reason)
        ON CONFLICT (device_id) DO UPDATE
        SET peer_id = EXCLUDED.peer_id,
            reason = EXCLUDED.reason,
            created_at = now();
    END IF;

    RETURN jsonb_build_object('success', true);
END;
$$;

CREATE OR REPLACE FUNCTION public.delete_current_user_account()
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, storage
AS $$
DECLARE
    v_user_id uuid := auth.uid();
    v_peer_id text;
BEGIN
    SELECT peer_id INTO v_peer_id
    FROM public.profiles
    WHERE user_id = v_user_id;

    IF v_peer_id IS NULL THEN
        RETURN false;
    END IF;

    DELETE FROM public.waiting_room
    WHERE peer_id = v_peer_id
       OR matched_with = v_peer_id;

    DELETE FROM public.chats
    WHERE user1_peer_id = v_peer_id
       OR user2_peer_id = v_peer_id;

    IF to_regclass('public.active_queues') IS NOT NULL THEN
        EXECUTE
            'DELETE FROM public.active_queues WHERE peer_id = $1 OR matched_with = $1'
        USING v_peer_id;
    END IF;

    DELETE FROM storage.objects
    WHERE bucket_id = 'avatars'
      AND (
          name LIKE v_peer_id || '/%'
          OR name LIKE v_user_id::text || '/%'
      );

    UPDATE public.profiles
    SET user_id = NULL,
        display_name = 'Deleted User',
        birth_date = DATE '1900-01-01',
        gender = 'deleted',
        photos = '{}'::text[],
        interests = '{}'::text[],
        bio = '',
        trust_score = 0,
        likes_balance = 0,
        is_in_review = false,
        flagged_for_review = false,
        shadow_banned = true
    WHERE peer_id = v_peer_id;

    DELETE FROM auth.users WHERE id = v_user_id;

    RETURN true;
END;
$$;

ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS phone_number text UNIQUE;

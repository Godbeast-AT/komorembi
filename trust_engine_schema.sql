-- Komorembi Trust & Safety engine.
-- Apply after supabase_schema.sql and supabase_schema_auth_security.sql.

ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS trust_score int DEFAULT 100,
ADD COLUMN IF NOT EXISTS is_in_review boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS flagged_for_review boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS shadow_banned boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS banned boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS warning_count int DEFAULT 0;

UPDATE public.profiles
SET trust_score = 100
WHERE trust_score IS NULL;

CREATE OR REPLACE FUNCTION public.trust_bracket(p_trust_score int)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$
    SELECT CASE
        WHEN COALESCE(p_trust_score, 100) >= 80 THEN 'high'
        WHEN COALESCE(p_trust_score, 100) >= 50 THEN 'medium'
        ELSE 'low'
    END;
$$;

CREATE OR REPLACE FUNCTION public.trust_allows_discovery(
    p_viewer_trust_score int,
    p_target_trust_score int,
    p_safety_mode boolean DEFAULT false
)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
AS $$
    SELECT CASE
        WHEN public.trust_bracket(p_viewer_trust_score) = 'low'
            THEN public.trust_bracket(p_target_trust_score) = 'low'
        WHEN COALESCE(p_safety_mode, false)
            THEN COALESCE(p_target_trust_score, 100) >= 80
        ELSE public.trust_bracket(p_viewer_trust_score) = public.trust_bracket(p_target_trust_score)
    END;
$$;

CREATE TABLE IF NOT EXISTS public.user_actions (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    created_at timestamptz DEFAULT now(),
    actor_peer_id text REFERENCES public.profiles(peer_id) ON DELETE CASCADE,
    target_peer_id text REFERENCES public.profiles(peer_id) ON DELETE CASCADE,
    action_type text NOT NULL
);

ALTER TABLE public.user_actions DROP CONSTRAINT IF EXISTS user_actions_action_type_check;
ALTER TABLE public.user_actions
ADD CONSTRAINT user_actions_action_type_check
CHECK (action_type IN ('block', 'report', 'skip', 'like', 'super_like'));

CREATE INDEX IF NOT EXISTS user_actions_actor_target_idx
ON public.user_actions (actor_peer_id, target_peer_id);

CREATE INDEX IF NOT EXISTS user_actions_target_type_created_idx
ON public.user_actions (target_peer_id, action_type, created_at DESC);

ALTER TABLE public.user_actions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can log their own actions" ON public.user_actions;
DROP POLICY IF EXISTS "Users can read their own actions" ON public.user_actions;
CREATE POLICY "Users can log their own actions" ON public.user_actions
FOR INSERT
WITH CHECK (
    EXISTS (
        SELECT 1
        FROM public.profiles p
        WHERE p.peer_id = actor_peer_id
          AND p.user_id = auth.uid()
    )
);
CREATE POLICY "Users can read their own actions" ON public.user_actions
FOR SELECT
USING (
    EXISTS (
        SELECT 1
        FROM public.profiles p
        WHERE p.user_id = auth.uid()
          AND p.peer_id IN (actor_peer_id, target_peer_id)
    )
);

CREATE TABLE IF NOT EXISTS public.user_skip_sessions (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    peer_id text NOT NULL REFERENCES public.profiles(peer_id) ON DELETE CASCADE,
    session_id text NOT NULL,
    seen_count int NOT NULL DEFAULT 0,
    skipped_count int NOT NULL DEFAULT 0,
    skip_rate numeric GENERATED ALWAYS AS (
        CASE
            WHEN seen_count <= 0 THEN 0
            ELSE skipped_count::numeric / seen_count::numeric
        END
    ) STORED,
    penalized boolean DEFAULT false,
    created_at timestamptz DEFAULT now(),
    UNIQUE (peer_id, session_id)
);

ALTER TABLE public.user_skip_sessions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can insert own skip sessions" ON public.user_skip_sessions;
DROP POLICY IF EXISTS "Users can read own skip sessions" ON public.user_skip_sessions;
CREATE POLICY "Users can insert own skip sessions" ON public.user_skip_sessions
FOR INSERT
WITH CHECK (
    EXISTS (
        SELECT 1
        FROM public.profiles p
        WHERE p.peer_id = peer_id
          AND p.user_id = auth.uid()
    )
);
CREATE POLICY "Users can read own skip sessions" ON public.user_skip_sessions
FOR SELECT
USING (
    EXISTS (
        SELECT 1
        FROM public.profiles p
        WHERE p.peer_id = peer_id
          AND p.user_id = auth.uid()
    )
);

CREATE OR REPLACE FUNCTION public.process_negative_interaction()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_deduction int := 0;
    v_recent_reports int := 0;
BEGIN
    IF NEW.action_type = 'block' THEN
        v_deduction := 2;
    ELSIF NEW.action_type = 'report' THEN
        v_deduction := 5;
    ELSE
        RETURN NEW;
    END IF;

    UPDATE public.profiles
    SET trust_score = GREATEST(0, COALESCE(trust_score, 100) - v_deduction)
    WHERE peer_id = NEW.target_peer_id;

    IF NEW.action_type = 'report' THEN
        SELECT count(*) INTO v_recent_reports
        FROM public.user_actions ua
        WHERE ua.target_peer_id = NEW.target_peer_id
          AND ua.action_type = 'report'
          AND ua.created_at >= now() - interval '24 hours';

        IF v_recent_reports >= 3 THEN
            UPDATE public.profiles
            SET flagged_for_review = true,
                is_in_review = true
            WHERE peer_id = NEW.target_peer_id;
        END IF;
    END IF;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS tr_process_negative_interaction ON public.user_actions;
CREATE TRIGGER tr_process_negative_interaction
AFTER INSERT ON public.user_actions
FOR EACH ROW EXECUTE FUNCTION public.process_negative_interaction();

CREATE OR REPLACE FUNCTION public.record_skip_session(
    p_peer_id text,
    p_session_id text,
    p_seen_count int,
    p_skipped_count int
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_rate numeric := 0;
    v_already_penalized boolean := false;
BEGIN
    -- Launch rule: skip_rate > 0.8 deducts 1 trust point once per session.
    IF COALESCE(p_seen_count, 0) <= 0 THEN
        RETURN jsonb_build_object('success', false, 'error', 'seen_count must be positive');
    END IF;

    v_rate := COALESCE(p_skipped_count, 0)::numeric / p_seen_count::numeric;

    SELECT COALESCE(penalized, false)
    INTO v_already_penalized
    FROM public.user_skip_sessions
    WHERE peer_id = p_peer_id
      AND session_id = p_session_id;

    INSERT INTO public.user_skip_sessions (
        peer_id,
        session_id,
        seen_count,
        skipped_count,
        penalized
    )
    VALUES (
        p_peer_id,
        p_session_id,
        p_seen_count,
        COALESCE(p_skipped_count, 0),
        v_rate > 0.8
    )
    ON CONFLICT (peer_id, session_id) DO UPDATE
    SET seen_count = EXCLUDED.seen_count,
        skipped_count = EXCLUDED.skipped_count,
        penalized = public.user_skip_sessions.penalized OR EXCLUDED.penalized;

    IF v_rate > 0.8 AND NOT COALESCE(v_already_penalized, false) THEN
        UPDATE public.profiles
        SET trust_score = GREATEST(0, COALESCE(trust_score, 100) - 1)
        WHERE peer_id = p_peer_id;
    END IF;

    RETURN jsonb_build_object(
        'success', true,
        'skip_rate', v_rate,
        'penalized', v_rate > 0.8
    );
END;
$$;

CREATE OR REPLACE FUNCTION public.match_by_vibe(
    p_peer_id text,
    p_record_id uuid,
    p_safety_mode boolean DEFAULT false
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_my_trust_score int;
    v_matched_record record;
    v_new_session_id uuid;
BEGIN
    SELECT COALESCE(trust_score, 100)
    INTO v_my_trust_score
    FROM public.profiles
    WHERE peer_id = p_peer_id;

    SELECT w.*
    INTO v_matched_record
    FROM public.waiting_room w
    JOIN public.profiles p ON p.peer_id = w.peer_id
    WHERE w.status = 'waiting'
      AND w.id <> p_record_id
      AND w.peer_id <> p_peer_id
      AND COALESCE(p.is_in_review, false) = false
      AND COALESCE(p.flagged_for_review, false) = false
      AND COALESCE(p.shadow_banned, false) = false
      AND COALESCE(p.banned, false) = false
      AND public.trust_allows_discovery(v_my_trust_score, COALESCE(p.trust_score, 100), p_safety_mode)
      AND NOT EXISTS (
          SELECT 1
          FROM public.blocked_users bu
          WHERE (bu.blocker_peer_id = p_peer_id AND bu.blocked_peer_id = p.peer_id)
             OR (bu.blocker_peer_id = p.peer_id AND bu.blocked_peer_id = p_peer_id)
      )
    ORDER BY
      CASE WHEN COALESCE(p_safety_mode, false) THEN COALESCE(p.trust_score, 100) ELSE 0 END DESC,
      w.created_at ASC
    LIMIT 1
    FOR UPDATE SKIP LOCKED;

    IF FOUND THEN
        v_new_session_id := gen_random_uuid();

        UPDATE public.waiting_room
        SET status = 'matched',
            session_id = v_new_session_id,
            matched_with = p_peer_id
        WHERE id = v_matched_record.id;

        UPDATE public.waiting_room
        SET status = 'matched',
            session_id = v_new_session_id,
            matched_with = v_matched_record.peer_id
        WHERE id = p_record_id;

        RETURN jsonb_build_object(
            'success', true,
            'peer_id', v_matched_record.peer_id,
            'session_id', v_new_session_id
        );
    END IF;

    RETURN jsonb_build_object('success', false);
END;
$$;

CREATE OR REPLACE FUNCTION public.discover_users(
    p_peer_id text,
    p_limit int DEFAULT 10,
    p_safety_mode boolean DEFAULT false
)
RETURNS TABLE (
    peer_id text,
    user_id uuid,
    display_name text,
    birth_date date,
    is_verified_adult boolean,
    interests text[],
    photos text[],
    trust_score int,
    is_in_review boolean,
    pronouns text,
    gender text,
    sexuality text,
    interested_in text,
    work text,
    bio text,
    created_at timestamptz,
    common_interests_count int
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
    WITH me AS (
        SELECT
            COALESCE(p.trust_score, 100) AS my_trust_score,
            COALESCE(p.interests, '{}'::text[]) AS my_interests
        FROM public.profiles p
        WHERE p.peer_id = p_peer_id
    ),
    candidates AS (
        SELECT
            p.*,
            (
                SELECT count(*)::int
                FROM unnest(COALESCE(p.interests, '{}'::text[])) AS interest
                WHERE interest = ANY (me.my_interests)
            ) AS shared_count,
            public.trust_bracket(COALESCE(p.trust_score, 100)) AS target_bracket,
            public.trust_bracket(me.my_trust_score) AS my_bracket
        FROM public.profiles p
        CROSS JOIN me
        WHERE p.peer_id <> p_peer_id
          AND array_length(COALESCE(p.photos, '{}'::text[]), 1) > 0
          AND COALESCE(p.is_in_review, false) = false
          AND COALESCE(p.flagged_for_review, false) = false
          AND COALESCE(p.shadow_banned, false) = false
          AND COALESCE(p.banned, false) = false
          AND public.trust_allows_discovery(me.my_trust_score, COALESCE(p.trust_score, 100), p_safety_mode)
          AND NOT EXISTS (
              SELECT 1
              FROM public.user_actions ua
              WHERE ua.actor_peer_id = p_peer_id
                AND ua.target_peer_id = p.peer_id
          )
          AND NOT EXISTS (
              SELECT 1
              FROM public.reports r
              WHERE r.reporter_id = p_peer_id
                AND r.reported_id = p.peer_id
          )
          AND NOT EXISTS (
              SELECT 1
              FROM public.blocked_users bu
              WHERE (bu.blocker_peer_id = p_peer_id AND bu.blocked_peer_id = p.peer_id)
                 OR (bu.blocker_peer_id = p.peer_id AND bu.blocked_peer_id = p_peer_id)
          )
    )
    SELECT
        c.peer_id,
        c.user_id,
        c.display_name,
        c.birth_date,
        c.is_verified_adult,
        COALESCE(c.interests, '{}'::text[]) AS interests,
        COALESCE(c.photos, '{}'::text[]) AS photos,
        COALESCE(c.trust_score, 100) AS trust_score,
        COALESCE(c.is_in_review, false) AS is_in_review,
        c.pronouns,
        c.gender,
        c.sexuality,
        c.interested_in,
        c.work,
        c.bio,
        c.created_at,
        c.shared_count AS common_interests_count
    FROM candidates c
    ORDER BY
        CASE WHEN c.target_bracket = c.my_bracket THEN 0 ELSE 1 END,
        c.shared_count DESC,
        COALESCE(c.trust_score, 100) DESC,
        c.created_at DESC
    LIMIT p_limit;
$$;

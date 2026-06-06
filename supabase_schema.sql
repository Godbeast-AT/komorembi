-- 1. Profiles Table
CREATE TABLE IF NOT EXISTS public.profiles (
    peer_id text PRIMARY KEY,
    user_id uuid UNIQUE, 
    display_name text NOT NULL,
    birth_date date NOT NULL,
    is_verified_adult boolean DEFAULT false,
    interests text[] DEFAULT '{}',
    photos text[] DEFAULT '{}',
    trust_score int DEFAULT 100,
    is_in_review boolean DEFAULT false,
    pronouns text,
    gender text,
    sexuality text,
    interested_in text,
    work text,
    bio text,
    created_at timestamptz DEFAULT now()
);

-- Repair older profiles tables that predate newer app fields.
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS user_id uuid,
ADD COLUMN IF NOT EXISTS display_name text,
ADD COLUMN IF NOT EXISTS birth_date date,
ADD COLUMN IF NOT EXISTS is_verified_adult boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS interests text[] DEFAULT '{}',
ADD COLUMN IF NOT EXISTS photos text[] DEFAULT '{}',
ADD COLUMN IF NOT EXISTS trust_score int DEFAULT 100,
ADD COLUMN IF NOT EXISTS is_in_review boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS pronouns text,
ADD COLUMN IF NOT EXISTS gender text,
ADD COLUMN IF NOT EXISTS sexuality text,
ADD COLUMN IF NOT EXISTS interested_in text,
ADD COLUMN IF NOT EXISTS work text,
ADD COLUMN IF NOT EXISTS bio text,
ADD COLUMN IF NOT EXISTS created_at timestamptz DEFAULT now();

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'profiles_user_id_key'
          AND conrelid = 'public.profiles'::regclass
    ) THEN
        ALTER TABLE public.profiles
        ADD CONSTRAINT profiles_user_id_key UNIQUE (user_id);
    END IF;
END;
$$;

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow public read" ON public.profiles;
DROP POLICY IF EXISTS "Allow anonymous profile management" ON public.profiles;
DROP POLICY IF EXISTS "Authenticated users can read profiles" ON public.profiles;
DROP POLICY IF EXISTS "Users can insert own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can delete own profile" ON public.profiles;
CREATE POLICY "Authenticated users can read profiles" ON public.profiles
FOR SELECT TO authenticated
USING (true);
CREATE POLICY "Users can insert own profile" ON public.profiles
FOR INSERT TO authenticated
WITH CHECK (user_id = auth.uid());
CREATE POLICY "Users can update own profile" ON public.profiles
FOR UPDATE TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());
CREATE POLICY "Users can delete own profile" ON public.profiles
FOR DELETE TO authenticated
USING (user_id = auth.uid());

-- 2. Waiting Room Table
CREATE TABLE IF NOT EXISTS public.waiting_room (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    created_at timestamptz DEFAULT now(),
    peer_id text NOT NULL,
    status text DEFAULT 'waiting'::text CHECK (status IN ('waiting', 'matched')),
    session_id uuid,
    matched_with text
);

ALTER TABLE public.waiting_room
ADD COLUMN IF NOT EXISTS created_at timestamptz DEFAULT now(),
ADD COLUMN IF NOT EXISTS peer_id text,
ADD COLUMN IF NOT EXISTS status text DEFAULT 'waiting'::text,
ADD COLUMN IF NOT EXISTS session_id uuid,
ADD COLUMN IF NOT EXISTS matched_with text;

ALTER TABLE public.waiting_room ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all actions in waiting room" ON public.waiting_room;
DROP POLICY IF EXISTS "Users manage own waiting room row" ON public.waiting_room;
CREATE POLICY "Users manage own waiting room row" ON public.waiting_room
FOR ALL TO authenticated
USING (
    EXISTS (
        SELECT 1
        FROM public.profiles p
        WHERE p.peer_id = waiting_room.peer_id
          AND p.user_id = auth.uid()
    )
)
WITH CHECK (
    EXISTS (
        SELECT 1
        FROM public.profiles p
        WHERE p.peer_id = waiting_room.peer_id
          AND p.user_id = auth.uid()
    )
);

-- 3. Call History Table
CREATE TABLE IF NOT EXISTS public.call_history (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    created_at timestamptz DEFAULT now(),
    session_id uuid,
    user_peer_id text NOT NULL REFERENCES public.profiles(peer_id) ON DELETE CASCADE,
    remote_peer_id text NOT NULL CONSTRAINT call_history_remote_peer_id_fkey REFERENCES public.profiles(peer_id) ON DELETE CASCADE,
    CONSTRAINT call_history_session_user_key UNIQUE (session_id, user_peer_id)
);

ALTER TABLE public.call_history
ADD COLUMN IF NOT EXISTS session_id uuid;

CREATE UNIQUE INDEX IF NOT EXISTS call_history_session_user_idx
ON public.call_history (session_id, user_peer_id);

ALTER TABLE public.call_history ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can view their own call history" ON public.call_history;
CREATE POLICY "Users can view their own call history" ON public.call_history
FOR SELECT TO authenticated
USING (
    EXISTS (
        SELECT 1
        FROM public.profiles p
        WHERE p.peer_id = call_history.user_peer_id
          AND p.user_id = auth.uid()
    )
);
DROP POLICY IF EXISTS "Allow insertion of call history" ON public.call_history;
CREATE POLICY "Allow insertion of call history" ON public.call_history
FOR INSERT TO authenticated
WITH CHECK (
    EXISTS (
        SELECT 1
        FROM public.profiles p
        WHERE p.peer_id = call_history.user_peer_id
          AND p.user_id = auth.uid()
    )
);

-- 4. Likes & Chats Table
CREATE TABLE IF NOT EXISTS public.likes (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    created_at timestamptz DEFAULT now(),
    from_peer_id text NOT NULL REFERENCES public.profiles(peer_id),
    to_peer_id text NOT NULL REFERENCES public.profiles(peer_id),
    UNIQUE(from_peer_id, to_peer_id)
);

CREATE TABLE IF NOT EXISTS public.chats (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    created_at timestamptz DEFAULT now(),
    user1_peer_id text NOT NULL REFERENCES public.profiles(peer_id),
    user2_peer_id text NOT NULL REFERENCES public.profiles(peer_id),
    status text DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'declined')),
    priority boolean DEFAULT false,
    last_message text,
    last_activity timestamptz DEFAULT now(),
    initiator_peer_id text REFERENCES public.profiles(peer_id),
    UNIQUE(user1_peer_id, user2_peer_id)
);

CREATE TABLE IF NOT EXISTS public.messages (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    created_at timestamptz DEFAULT now(),
    chat_id uuid NOT NULL REFERENCES public.chats(id) ON DELETE CASCADE,
    sender_peer_id text NOT NULL REFERENCES public.profiles(peer_id),
    content text NOT NULL,
    read_by uuid[] DEFAULT '{}'::uuid[]
);

ALTER TABLE public.chats
ADD COLUMN IF NOT EXISTS status text DEFAULT 'pending',
ADD COLUMN IF NOT EXISTS priority boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS last_message text,
ADD COLUMN IF NOT EXISTS last_activity timestamptz DEFAULT now(),
ADD COLUMN IF NOT EXISTS initiator_peer_id text REFERENCES public.profiles(peer_id);

ALTER TABLE public.messages
ADD COLUMN IF NOT EXISTS read_by uuid[] DEFAULT '{}'::uuid[];

ALTER TABLE public.likes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chats ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all actions for likes" ON public.likes;
DROP POLICY IF EXISTS "Allow all actions for chats" ON public.chats;
DROP POLICY IF EXISTS "Allow all actions for messages" ON public.messages;
DROP POLICY IF EXISTS "Users manage own likes" ON public.likes;
CREATE POLICY "Users manage own likes" ON public.likes
FOR ALL TO authenticated
USING (
    EXISTS (
        SELECT 1
        FROM public.profiles p
        WHERE p.user_id = auth.uid()
          AND p.peer_id IN (from_peer_id, to_peer_id)
    )
)
WITH CHECK (
    EXISTS (
        SELECT 1
        FROM public.profiles p
        WHERE p.user_id = auth.uid()
          AND p.peer_id = from_peer_id
    )
);

-- 5. RPC Functions

-- Find Match (legacy, basic FIFO)
CREATE OR REPLACE FUNCTION public.find_match(current_peer_id text, current_record_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
    matched_record RECORD;
    new_session_id uuid;
BEGIN
    SELECT * INTO matched_record FROM public.waiting_room
    WHERE status = 'waiting' AND id != current_record_id
    ORDER BY created_at ASC LIMIT 1 FOR UPDATE SKIP LOCKED;
    IF FOUND THEN
        new_session_id := gen_random_uuid();
        -- Persist symmetric match metadata for both participants
        UPDATE public.waiting_room
        SET status = 'matched',
            session_id = new_session_id,
            matched_with = current_peer_id
        WHERE id = matched_record.id;

        UPDATE public.waiting_room
        SET status = 'matched',
            session_id = new_session_id,
            matched_with = matched_record.peer_id
        WHERE id = current_record_id;
        RETURN json_build_object('success', true, 'peer_id', matched_record.peer_id, 'session_id', new_session_id);
    ELSE
        RETURN json_build_object('success', false);
    END IF;
END;
$$;

-- Match By Vibe (used by app shuffle)
-- Mirrors client-side call: match_by_vibe(p_peer_id, p_record_id, p_safety_mode)
-- Currently basic FIFO; extend with trust / safety filters as needed.
CREATE OR REPLACE FUNCTION public.match_by_vibe(
    p_peer_id text,
    p_record_id uuid,
    p_safety_mode boolean DEFAULT false
)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
    matched_record RECORD;
    new_session_id uuid;
BEGIN
    -- Simple FIFO match from waiting_room, excluding the current record.
    -- You can plug in trust_engine logic here later using p_safety_mode.
    SELECT * INTO matched_record FROM public.waiting_room
    WHERE status = 'waiting'
      AND id != p_record_id
    ORDER BY created_at ASC
    LIMIT 1
    FOR UPDATE SKIP LOCKED;

    IF FOUND THEN
        new_session_id := gen_random_uuid();

        -- Update the other participant
        UPDATE public.waiting_room
        SET status = 'matched',
            session_id = new_session_id,
            matched_with = p_peer_id
        WHERE id = matched_record.id;

        -- Update the current participant
        UPDATE public.waiting_room
        SET status = 'matched',
            session_id = new_session_id,
            matched_with = matched_record.peer_id
        WHERE id = p_record_id;

        RETURN json_build_object(
            'success', true,
            'peer_id', matched_record.peer_id,
            'session_id', new_session_id
        );
    ELSE
        -- No immediate partner; caller will wait on realtime updates.
        RETURN json_build_object('success', false);
    END IF;
END;
$$;

-- Record Call
CREATE OR REPLACE FUNCTION public.record_call(
    p_user_peer_id text,
    p_remote_peer_id text,
    p_session_id uuid
)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
    INSERT INTO public.call_history (session_id, user_peer_id, remote_peer_id)
    VALUES (p_session_id, p_user_peer_id, p_remote_peer_id)
    ON CONFLICT (session_id, user_peer_id) DO NOTHING;

    INSERT INTO public.call_history (session_id, user_peer_id, remote_peer_id)
    VALUES (p_session_id, p_remote_peer_id, p_user_peer_id)
    ON CONFLICT (session_id, user_peer_id) DO NOTHING;
END;
$$;

-- Handle Like (with Approval Logic)
CREATE OR REPLACE FUNCTION public.handle_like(p_from_peer_id text, p_to_peer_id text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
    existing_chat_id uuid;
    new_chat_id uuid;
    from_name text;
BEGIN
    INSERT INTO public.likes (from_peer_id, to_peer_id) VALUES (p_from_peer_id, p_to_peer_id) ON CONFLICT DO NOTHING;
    SELECT display_name INTO from_name FROM public.profiles WHERE peer_id = p_from_peer_id;
    SELECT id INTO existing_chat_id FROM public.chats 
    WHERE (user1_peer_id = p_from_peer_id AND user2_peer_id = p_to_peer_id)
       OR (user1_peer_id = p_to_peer_id AND user2_peer_id = p_from_peer_id);

    IF existing_chat_id IS NULL THEN
        INSERT INTO public.chats (user1_peer_id, user2_peer_id, status, initiator_peer_id)
        VALUES (LEAST(p_from_peer_id, p_to_peer_id), GREATEST(p_from_peer_id, p_to_peer_id), 'pending', p_from_peer_id)
        RETURNING id INTO new_chat_id;
        INSERT INTO public.messages (chat_id, sender_peer_id, content)
        VALUES (new_chat_id, p_from_peer_id, from_name || ' wants to start a conversation with you! ✨');
        RETURN json_build_object('success', true, 'chat_id', new_chat_id, 'is_new', true, 'status', 'pending');
    ELSE
        RETURN json_build_object('success', true, 'chat_id', existing_chat_id, 'is_new', false);
    END IF;
END;
$$;

-- Final core override: pending chat requests should not create an automatic
-- message. Action logging is handled in the chat approval layer by
-- send_chat_request.
DROP FUNCTION IF EXISTS public.handle_like(text, text);
CREATE OR REPLACE FUNCTION public.handle_like(
    p_from_peer_id text,
    p_to_peer_id text,
    p_priority boolean DEFAULT false
)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
    existing_chat_id uuid;
    new_chat_id uuid;
BEGIN
    INSERT INTO public.likes (from_peer_id, to_peer_id)
    VALUES (p_from_peer_id, p_to_peer_id)
    ON CONFLICT DO NOTHING;

    SELECT id INTO existing_chat_id FROM public.chats 
    WHERE (user1_peer_id = p_from_peer_id AND user2_peer_id = p_to_peer_id)
       OR (user1_peer_id = p_to_peer_id AND user2_peer_id = p_from_peer_id);

    IF existing_chat_id IS NULL THEN
        INSERT INTO public.chats (
            user1_peer_id,
            user2_peer_id,
            status,
            priority,
            initiator_peer_id,
            last_activity
        )
        VALUES (
            LEAST(p_from_peer_id, p_to_peer_id),
            GREATEST(p_from_peer_id, p_to_peer_id),
            'pending',
            COALESCE(p_priority, false),
            p_from_peer_id,
            now()
        )
        RETURNING id INTO new_chat_id;
        RETURN json_build_object('success', true, 'chat_id', new_chat_id, 'is_new', true, 'status', 'pending');
    ELSE
        UPDATE public.chats
        SET priority = priority OR COALESCE(p_priority, false),
            last_activity = now()
        WHERE id = existing_chat_id;
        RETURN json_build_object('success', true, 'chat_id', existing_chat_id, 'is_new', false);
    END IF;
END;
$$;

-- Approve Chat
CREATE OR REPLACE FUNCTION public.approve_chat(p_chat_id uuid, p_user_peer_id text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE v_initiator text;
BEGIN
    SELECT initiator_peer_id INTO v_initiator FROM public.chats 
    WHERE id = p_chat_id AND (user1_peer_id = p_user_peer_id OR user2_peer_id = p_user_peer_id);
    IF v_initiator IS NULL THEN RETURN json_build_object('success', false, 'error', 'Chat not found'); END IF;
    IF v_initiator = p_user_peer_id THEN RETURN json_build_object('success', false, 'error', 'You cannot approve your own request'); END IF;
    UPDATE public.chats SET status = 'approved' WHERE id = p_chat_id;
    RETURN json_build_object('success', true);
END;
$$;

CREATE OR REPLACE FUNCTION public.approve_chat(p_chat_id uuid, p_user_peer_id text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE v_initiator text;
BEGIN
    SELECT initiator_peer_id INTO v_initiator FROM public.chats
    WHERE id = p_chat_id
      AND status = 'pending'
      AND (user1_peer_id = p_user_peer_id OR user2_peer_id = p_user_peer_id);
    IF v_initiator IS NULL THEN RETURN json_build_object('success', false, 'error', 'Chat not found'); END IF;
    IF v_initiator = p_user_peer_id THEN RETURN json_build_object('success', false, 'error', 'You cannot approve your own request'); END IF;
    UPDATE public.chats
    SET status = 'approved',
        last_activity = now()
    WHERE id = p_chat_id;
    RETURN json_build_object('success', true);
END;
$$;

CREATE OR REPLACE FUNCTION public.decline_chat(p_chat_id uuid, p_user_peer_id text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE v_initiator text;
BEGIN
    SELECT initiator_peer_id INTO v_initiator FROM public.chats
    WHERE id = p_chat_id
      AND status = 'pending'
      AND (user1_peer_id = p_user_peer_id OR user2_peer_id = p_user_peer_id);
    IF v_initiator IS NULL THEN RETURN json_build_object('success', false, 'error', 'Chat not found'); END IF;
    IF v_initiator = p_user_peer_id THEN RETURN json_build_object('success', false, 'error', 'You cannot decline your own request'); END IF;
    UPDATE public.chats
    SET status = 'declined',
        last_activity = now()
    WHERE id = p_chat_id;
    RETURN json_build_object('success', true);
END;
$$;

-- Discover Users (Latest First)
CREATE OR REPLACE FUNCTION public.discover_users(p_peer_id text, p_limit int DEFAULT 10)
RETURNS SETOF public.profiles LANGUAGE sql SECURITY DEFINER AS $$
    SELECT * FROM public.profiles 
    WHERE peer_id != p_peer_id 
    AND array_length(photos, 1) > 0
    ORDER BY created_at DESC 
    LIMIT p_limit;
$$;

-- 6. Storage Setup
INSERT INTO storage.buckets (id, name, public) VALUES ('avatars', 'avatars', true) ON CONFLICT (id) DO UPDATE SET public = true;

DROP POLICY IF EXISTS "Avatar Public Access" ON storage.objects;
CREATE POLICY "Avatar Public Access" ON storage.objects FOR SELECT TO public USING (bucket_id = 'avatars');

DROP POLICY IF EXISTS "Avatar Anonymous Upload" ON storage.objects;
CREATE POLICY "Avatar Anonymous Upload" ON storage.objects FOR INSERT TO public WITH CHECK (bucket_id = 'avatars');

-- Allow users to update/delete their own avatars (optional but recommended for maintenance)
DROP POLICY IF EXISTS "Avatar Owner Management" ON storage.objects;
CREATE POLICY "Avatar Owner Management" ON storage.objects FOR ALL TO public USING (bucket_id = 'avatars');

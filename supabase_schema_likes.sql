-- 1. Likes Table
CREATE TABLE IF NOT EXISTS public.likes (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    created_at timestamptz DEFAULT now(),
    from_peer_id text NOT NULL REFERENCES public.profiles(peer_id),
    to_peer_id text NOT NULL REFERENCES public.profiles(peer_id),
    UNIQUE(from_peer_id, to_peer_id)
);

-- 2. Chats (Matches) Table
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

-- 3. Messages Table
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

-- Enable RLS
ALTER TABLE public.likes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chats ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow all actions for likes" ON public.likes;
DROP POLICY IF EXISTS "Allow all actions for chats" ON public.chats;
DROP POLICY IF EXISTS "Allow all actions for messages" ON public.messages;

CREATE POLICY "Allow all actions for likes" ON public.likes FOR ALL USING (true);
CREATE POLICY "Allow all actions for chats" ON public.chats FOR ALL USING (true);
CREATE POLICY "Allow all actions for messages" ON public.messages FOR ALL USING (true);

-- 4. Like / Auto-Chat Function (RPC)
CREATE OR REPLACE FUNCTION public.handle_like(p_from_peer_id text, p_to_peer_id text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    existing_chat_id uuid;
    new_chat_id uuid;
    from_name text;
BEGIN
    -- 1. Insert Like
    INSERT INTO public.likes (from_peer_id, to_peer_id)
    VALUES (p_from_peer_id, p_to_peer_id)
    ON CONFLICT DO NOTHING;

    -- 2. Get sender name
    SELECT display_name INTO from_name FROM public.profiles WHERE peer_id = p_from_peer_id;

    -- 3. Check if a chat already exists
    SELECT id INTO existing_chat_id 
    FROM public.chats 
    WHERE (user1_peer_id = p_from_peer_id AND user2_peer_id = p_to_peer_id)
       OR (user1_peer_id = p_to_peer_id AND user2_peer_id = p_from_peer_id);

    IF existing_chat_id IS NULL THEN
        -- Create new chat
        INSERT INTO public.chats (user1_peer_id, user2_peer_id)
        VALUES (LEAST(p_from_peer_id, p_to_peer_id), GREATEST(p_from_peer_id, p_to_peer_id))
        RETURNING id INTO new_chat_id;
        
        -- Send automatic "Liked you" message
        INSERT INTO public.messages (chat_id, sender_peer_id, content)
        VALUES (new_chat_id, p_from_peer_id, from_name || ' liked you! ✨');
        
        RETURN json_build_object('success', true, 'chat_id', new_chat_id, 'is_new', true);
    ELSE
        -- Chat already exists, maybe just send a notification but let's stick to returning the ID
        RETURN json_build_object('success', true, 'chat_id', existing_chat_id, 'is_new', false);
    END IF;
END;
$$;

-- Final override: likes create pending requests without automatic messages.
DROP FUNCTION IF EXISTS public.handle_like(text, text);
CREATE OR REPLACE FUNCTION public.handle_like(
    p_from_peer_id text,
    p_to_peer_id text,
    p_priority boolean DEFAULT false
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    existing_chat_id uuid;
    new_chat_id uuid;
BEGIN
    INSERT INTO public.likes (from_peer_id, to_peer_id)
    VALUES (p_from_peer_id, p_to_peer_id)
    ON CONFLICT DO NOTHING;

    SELECT id INTO existing_chat_id
    FROM public.chats
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

        RETURN jsonb_build_object('success', true, 'chat_id', new_chat_id, 'is_new', true, 'status', 'pending');
    END IF;

    UPDATE public.chats
    SET priority = priority OR COALESCE(p_priority, false),
        last_activity = now()
    WHERE id = existing_chat_id;

    RETURN jsonb_build_object('success', true, 'chat_id', existing_chat_id, 'is_new', false, 'status', 'pending');
END;
$$;

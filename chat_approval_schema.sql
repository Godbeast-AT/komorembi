-- Final chat approval system.
-- Apply after supabase_schema.sql, supabase_schema_auth_security.sql,
-- supabase_schema_economy.sql, and trust_engine_schema.sql.

ALTER TABLE public.chats
ADD COLUMN IF NOT EXISTS status text DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'declined')),
ADD COLUMN IF NOT EXISTS initiator_peer_id text REFERENCES public.profiles(peer_id),
ADD COLUMN IF NOT EXISTS priority boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS last_message text,
ADD COLUMN IF NOT EXISTS last_activity timestamptz DEFAULT now();

ALTER TABLE public.messages
ADD COLUMN IF NOT EXISTS read_by uuid[] DEFAULT '{}'::uuid[];

DROP POLICY IF EXISTS "Allow all actions for chats" ON public.chats;
DROP POLICY IF EXISTS "Allow all actions for messages" ON public.messages;
DROP POLICY IF EXISTS "Chats participants can read their chats" ON public.chats;
DROP POLICY IF EXISTS "Chats participants can create requests" ON public.chats;
DROP POLICY IF EXISTS "Messages approved participants can read" ON public.messages;
DROP POLICY IF EXISTS "Messages approved participants can send" ON public.messages;
DROP POLICY IF EXISTS "Messages approved participants can update read receipts" ON public.messages;

CREATE POLICY "Chats participants can read their chats" ON public.chats
FOR SELECT
USING (
    EXISTS (
        SELECT 1
        FROM public.profiles p
        WHERE p.user_id = auth.uid()
          AND p.peer_id IN (user1_peer_id, user2_peer_id)
    )
);

CREATE POLICY "Chats participants can create requests" ON public.chats
FOR INSERT
WITH CHECK (
    EXISTS (
        SELECT 1
        FROM public.profiles p
        WHERE p.user_id = auth.uid()
          AND p.peer_id = initiator_peer_id
          AND p.peer_id IN (user1_peer_id, user2_peer_id)
    )
);

CREATE POLICY "Messages approved participants can read" ON public.messages
FOR SELECT
USING (
    EXISTS (
        SELECT 1
        FROM public.chats c
        JOIN public.profiles p ON p.peer_id IN (c.user1_peer_id, c.user2_peer_id)
        WHERE c.id = chat_id
          AND c.status = 'approved'
          AND p.user_id = auth.uid()
    )
);

CREATE POLICY "Messages approved participants can send" ON public.messages
FOR INSERT
WITH CHECK (
    EXISTS (
        SELECT 1
        FROM public.chats c
        JOIN public.profiles p ON p.peer_id = sender_peer_id
        WHERE c.id = chat_id
          AND c.status = 'approved'
          AND sender_peer_id IN (c.user1_peer_id, c.user2_peer_id)
          AND p.user_id = auth.uid()
    )
);

CREATE POLICY "Messages approved participants can update read receipts" ON public.messages
FOR UPDATE
USING (
    EXISTS (
        SELECT 1
        FROM public.chats c
        JOIN public.profiles p ON p.peer_id IN (c.user1_peer_id, c.user2_peer_id)
        WHERE c.id = chat_id
          AND c.status = 'approved'
          AND p.user_id = auth.uid()
    )
)
WITH CHECK (
    EXISTS (
        SELECT 1
        FROM public.chats c
        JOIN public.profiles p ON p.peer_id IN (c.user1_peer_id, c.user2_peer_id)
        WHERE c.id = chat_id
          AND c.status = 'approved'
          AND p.user_id = auth.uid()
    )
);

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

CREATE OR REPLACE FUNCTION public.approve_chat(p_chat_id uuid, p_user_peer_id text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_initiator text;
BEGIN
    SELECT initiator_peer_id INTO v_initiator
    FROM public.chats
    WHERE id = p_chat_id
      AND status = 'pending'
      AND (user1_peer_id = p_user_peer_id OR user2_peer_id = p_user_peer_id);

    IF v_initiator IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'Chat not found');
    END IF;

    IF v_initiator = p_user_peer_id THEN
        RETURN jsonb_build_object('success', false, 'error', 'You cannot approve your own request');
    END IF;

    UPDATE public.chats
    SET status = 'approved',
        last_activity = now()
    WHERE id = p_chat_id;

    RETURN jsonb_build_object('success', true);
END;
$$;

CREATE OR REPLACE FUNCTION public.decline_chat(p_chat_id uuid, p_user_peer_id text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_initiator text;
BEGIN
    SELECT initiator_peer_id INTO v_initiator
    FROM public.chats
    WHERE id = p_chat_id
      AND status = 'pending'
      AND (user1_peer_id = p_user_peer_id OR user2_peer_id = p_user_peer_id);

    IF v_initiator IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'Chat not found');
    END IF;

    IF v_initiator = p_user_peer_id THEN
        RETURN jsonb_build_object('success', false, 'error', 'You cannot decline your own request');
    END IF;

    UPDATE public.chats
    SET status = 'declined',
        last_activity = now()
    WHERE id = p_chat_id;

    RETURN jsonb_build_object('success', true);
END;
$$;

CREATE OR REPLACE FUNCTION public.update_chat_last_message()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    UPDATE public.chats
    SET last_message = NEW.content,
        last_activity = COALESCE(NEW.created_at, now())
    WHERE id = NEW.chat_id;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS messages_after_insert_update_chat ON public.messages;
CREATE TRIGGER messages_after_insert_update_chat
AFTER INSERT ON public.messages
FOR EACH ROW EXECUTE FUNCTION public.update_chat_last_message();

CREATE OR REPLACE FUNCTION public.send_chat_request(
    p_actor_peer_id text,
    p_target_peer_id text,
    p_action_type text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_chat jsonb;
BEGIN
    IF p_action_type NOT IN ('like', 'super_like') THEN
        RETURN jsonb_build_object('success', false, 'error', 'Unsupported request action');
    END IF;

    IF p_actor_peer_id = p_target_peer_id THEN
        RETURN jsonb_build_object('success', false, 'error', 'Cannot request yourself');
    END IF;

    IF EXISTS (
        SELECT 1
        FROM public.blocked_users bu
        WHERE (bu.blocker_peer_id = p_actor_peer_id AND bu.blocked_peer_id = p_target_peer_id)
           OR (bu.blocker_peer_id = p_target_peer_id AND bu.blocked_peer_id = p_actor_peer_id)
    ) THEN
        RETURN jsonb_build_object('success', false, 'error', 'This profile is unavailable');
    END IF;

    IF EXISTS (
        SELECT 1
        FROM public.user_actions ua
        WHERE ua.actor_peer_id = p_actor_peer_id
          AND ua.target_peer_id = p_target_peer_id
          AND ua.action_type IN ('like', 'super_like')
    ) THEN
        RETURN jsonb_build_object('success', false, 'error', 'Request already sent');
    END IF;

    INSERT INTO public.user_actions (actor_peer_id, target_peer_id, action_type)
    VALUES (p_actor_peer_id, p_target_peer_id, p_action_type);

    SELECT public.handle_like(
        p_actor_peer_id,
        p_target_peer_id,
        p_action_type = 'super_like'
    ) INTO v_chat;

    RETURN v_chat
        || jsonb_build_object(
            'success', true,
            'action_type', p_action_type
        );
END;
$$;

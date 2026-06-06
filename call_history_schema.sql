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

-- Enable RLS
ALTER TABLE public.call_history ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their own call history" ON public.call_history;
CREATE POLICY "Users can view their own call history" ON public.call_history
FOR SELECT USING (user_peer_id = user_peer_id); -- For simplicity in guest mode, allow select. In production, restrictive policies would be used.

DROP POLICY IF EXISTS "Allow insertion of call history" ON public.call_history;
CREATE POLICY "Allow insertion of call history" ON public.call_history FOR INSERT WITH CHECK (true);

-- Function to record a call once per bilateral session
CREATE OR REPLACE FUNCTION public.record_call(
    p_user_peer_id text,
    p_remote_peer_id text,
    p_session_id uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    -- Record for User A
    INSERT INTO public.call_history (session_id, user_peer_id, remote_peer_id)
    VALUES (p_session_id, p_user_peer_id, p_remote_peer_id)
    ON CONFLICT (session_id, user_peer_id) DO NOTHING;

    -- Record for User B
    INSERT INTO public.call_history (session_id, user_peer_id, remote_peer_id)
    VALUES (p_session_id, p_remote_peer_id, p_user_peer_id)
    ON CONFLICT (session_id, user_peer_id) DO NOTHING;
END;
$$;

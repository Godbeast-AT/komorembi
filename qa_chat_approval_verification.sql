-- QA CHAT APPROVAL VERIFICATION SCRIPT
-- Apply all schema files first, then run this in Supabase SQL editor.

INSERT INTO public.profiles (peer_id, display_name, birth_date, photos, likes_balance, last_daily_reset)
VALUES
('qa_chat_sender', 'QA Sender', '1995-01-01', ARRAY['https://example.com/sender.jpg'], 200, now()),
('qa_chat_receiver', 'QA Receiver', '1995-02-01', ARRAY['https://example.com/receiver.jpg'], 200, now())
ON CONFLICT (peer_id) DO UPDATE
SET likes_balance = 200,
    last_daily_reset = now();

DELETE FROM public.messages
WHERE chat_id IN (
    SELECT id FROM public.chats
    WHERE user1_peer_id IN ('qa_chat_sender', 'qa_chat_receiver')
       OR user2_peer_id IN ('qa_chat_sender', 'qa_chat_receiver')
);
DELETE FROM public.chats
WHERE user1_peer_id IN ('qa_chat_sender', 'qa_chat_receiver')
   OR user2_peer_id IN ('qa_chat_sender', 'qa_chat_receiver');
DELETE FROM public.user_actions
WHERE actor_peer_id IN ('qa_chat_sender', 'qa_chat_receiver')
   OR target_peer_id IN ('qa_chat_sender', 'qa_chat_receiver');

-- Expected: pending chat, priority true, no automatic messages, sender balance 150.
SELECT public.send_chat_request('qa_chat_sender', 'qa_chat_receiver', 'super_like') AS request_result;

SELECT c.status, c.priority, c.initiator_peer_id, c.last_message, p.likes_balance AS sender_balance
FROM public.chats c
JOIN public.profiles p ON p.peer_id = 'qa_chat_sender'
WHERE c.user1_peer_id = LEAST('qa_chat_sender', 'qa_chat_receiver')
  AND c.user2_peer_id = GREATEST('qa_chat_sender', 'qa_chat_receiver');

SELECT count(*) AS message_count
FROM public.messages m
JOIN public.chats c ON c.id = m.chat_id
WHERE c.user1_peer_id = LEAST('qa_chat_sender', 'qa_chat_receiver')
  AND c.user2_peer_id = GREATEST('qa_chat_sender', 'qa_chat_receiver');

-- Expected: initiator cannot approve own request; receiver can approve.
SELECT public.approve_chat(
    (SELECT id FROM public.chats WHERE initiator_peer_id = 'qa_chat_sender' LIMIT 1),
    'qa_chat_sender'
) AS sender_approve_result;

SELECT public.approve_chat(
    (SELECT id FROM public.chats WHERE initiator_peer_id = 'qa_chat_sender' LIMIT 1),
    'qa_chat_receiver'
) AS receiver_approve_result;

INSERT INTO public.messages (chat_id, sender_peer_id, content)
SELECT id, 'qa_chat_sender', 'Approved hello'
FROM public.chats
WHERE initiator_peer_id = 'qa_chat_sender'
RETURNING chat_id, sender_peer_id, content;

SELECT status, last_message, last_activity
FROM public.chats
WHERE initiator_peer_id = 'qa_chat_sender';

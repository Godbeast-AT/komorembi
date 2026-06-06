-- QA SAFETY + SCHEMA VERIFICATION SCRIPT
-- Verifies blocked user persistence and idempotent call history writes per session.

-- 1. Setup test profiles
INSERT INTO public.profiles (peer_id, display_name, birth_date, likes_balance)
VALUES
('qa_safe_a', 'QA Safe A', '1995-01-01', 200),
('qa_safe_b', 'QA Safe B', '1995-02-01', 200)
ON CONFLICT (peer_id) DO UPDATE
SET display_name = EXCLUDED.display_name;

-- 2. Verify blocked_users table accepts one directional block
INSERT INTO public.blocked_users (blocker_peer_id, blocked_peer_id)
VALUES ('qa_safe_a', 'qa_safe_b')
ON CONFLICT (blocker_peer_id, blocked_peer_id) DO NOTHING;

SELECT blocker_peer_id, blocked_peer_id
FROM public.blocked_users
WHERE blocker_peer_id = 'qa_safe_a' AND blocked_peer_id = 'qa_safe_b';

-- 3. Verify record_call only records one bilateral pair per session
SELECT public.record_call('qa_safe_a', 'qa_safe_b', '11111111-1111-1111-1111-111111111111');
SELECT public.record_call('qa_safe_a', 'qa_safe_b', '11111111-1111-1111-1111-111111111111');

SELECT session_id, user_peer_id, remote_peer_id
FROM public.call_history
WHERE session_id = '11111111-1111-1111-1111-111111111111'
ORDER BY user_peer_id;

-- Expected rows: exactly 2
SELECT count(*) AS session_row_count
FROM public.call_history
WHERE session_id = '11111111-1111-1111-1111-111111111111';

-- QA DISCOVERY ENGINE VERIFICATION SCRIPT
-- Apply all schema files first, then run this in Supabase SQL editor.

INSERT INTO public.profiles (peer_id, display_name, birth_date, interests, photos, trust_score, likes_balance, last_daily_reset)
VALUES
('qa_discover_me', 'QA Discover Me', '1995-01-01', ARRAY['coffee', 'hiking'], ARRAY['https://example.com/me.jpg'], 100, 200, now()),
('qa_discover_shared', 'QA Shared', '1995-02-01', ARRAY['coffee', 'hiking'], ARRAY['https://example.com/shared.jpg'], 110, 200, now()),
('qa_discover_plain', 'QA Plain', '1995-03-01', ARRAY['movies'], ARRAY['https://example.com/plain.jpg'], 100, 200, now()),
('qa_discover_low', 'QA Low Trust', '1995-04-01', ARRAY['coffee'], ARRAY['https://example.com/low.jpg'], 20, 200, now()),
('qa_discover_blocked', 'QA Blocked', '1995-05-01', ARRAY['coffee'], ARRAY['https://example.com/blocked.jpg'], 100, 200, now())
ON CONFLICT (peer_id) DO UPDATE
SET interests = EXCLUDED.interests,
    photos = EXCLUDED.photos,
    trust_score = EXCLUDED.trust_score,
    likes_balance = EXCLUDED.likes_balance,
    last_daily_reset = EXCLUDED.last_daily_reset;

DELETE FROM public.user_actions
WHERE actor_peer_id = 'qa_discover_me'
   OR target_peer_id = 'qa_discover_me';

DELETE FROM public.blocked_users
WHERE blocker_peer_id = 'qa_discover_me'
   OR blocked_peer_id = 'qa_discover_me';

INSERT INTO public.user_actions (actor_peer_id, target_peer_id, action_type)
VALUES ('qa_discover_me', 'qa_discover_plain', 'skip');

INSERT INTO public.blocked_users (blocker_peer_id, blocked_peer_id)
VALUES ('qa_discover_me', 'qa_discover_blocked')
ON CONFLICT (blocker_peer_id, blocked_peer_id) DO NOTHING;

-- Expected: qa_discover_shared appears before lower/no-shared profiles.
-- Excluded: qa_discover_plain, qa_discover_blocked, qa_discover_me.
SELECT peer_id, common_interests_count, trust_score
FROM public.discover_users('qa_discover_me', 10, false);

-- Expected with Safety Mode: qa_discover_low is excluded because it is below my trust bracket.
SELECT peer_id, common_interests_count, trust_score
FROM public.discover_users('qa_discover_me', 10, true);

INSERT INTO public.reports (reporter_id, reported_id, reason, context)
VALUES ('qa_discover_me', 'qa_discover_low', 'qa_reason', '{"source":"qa"}'::jsonb)
RETURNING reporter_id, reported_id, reason, timestamp, context;

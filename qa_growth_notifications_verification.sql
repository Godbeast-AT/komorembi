-- QA PHASE 7 GROWTH & NOTIFICATIONS VERIFICATION
-- Run after growth_notifications_schema.sql.

DELETE FROM public.notification_events
WHERE recipient_peer_id IN ('qa_wait_ref', 'qa_wait_new');
DELETE FROM public.notification_push_tokens
WHERE peer_id IN ('qa_wait_ref', 'qa_wait_new');
DELETE FROM public.waitlist_referrals
WHERE referrer_peer_id IN ('qa_wait_ref', 'qa_wait_new')
   OR referred_peer_id IN ('qa_wait_ref', 'qa_wait_new');
DELETE FROM public.waitlist_entries
WHERE peer_id IN ('qa_wait_ref', 'qa_wait_new');
DELETE FROM public.profiles
WHERE peer_id IN ('qa_wait_ref', 'qa_wait_new');

INSERT INTO public.profiles (peer_id, user_id, display_name, birth_date, photos)
VALUES
('qa_wait_ref', '00000000-0000-0000-0000-000000000711', 'QA Referrer', '1995-01-01', ARRAY['ref.jpg']),
('qa_wait_new', '00000000-0000-0000-0000-000000000712', 'QA New', '1995-01-01', ARRAY['new.jpg'])
ON CONFLICT (peer_id) DO UPDATE
SET user_id = EXCLUDED.user_id,
    display_name = EXCLUDED.display_name,
    photos = EXCLUDED.photos;

BEGIN;
SELECT set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000711', true);
SELECT public.join_waitlist('qa_wait_ref', NULL) AS referrer_join_result;
COMMIT;

SELECT public.apply_invite_referral('qa_wait_new', 'qa_wait_ref') AS referred_join_result;

SELECT peer_id, queue_position, referral_count, referred_by, created_at
FROM public.waitlist_entries
WHERE peer_id IN ('qa_wait_ref', 'qa_wait_new')
ORDER BY queue_position, created_at;

UPDATE public.profiles
SET notification_preferences = jsonb_build_object(
    'likes', false,
    'chat_requests', true,
    'live_matches', true,
    'welcome', true
)
WHERE peer_id = 'qa_wait_new';

SELECT public.queue_notification_event(
    'qa_wait_new',
    'like_received',
    'Someone likes you',
    'Open Komorembi to respond.',
    '{"actor_peer_id":"qa_wait_ref"}'::jsonb
);

INSERT INTO public.notification_push_tokens (peer_id, token, platform)
VALUES ('qa_wait_new', 'qa-growth-fcm-token', 'android')
ON CONFLICT (token) DO UPDATE
SET enabled = true,
    last_seen_at = now(),
    updated_at = now();

SELECT recipient_peer_id, trigger_type, status, data
FROM public.notification_events
WHERE recipient_peer_id = 'qa_wait_new'
ORDER BY created_at DESC
LIMIT 1;

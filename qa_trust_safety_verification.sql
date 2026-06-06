-- QA PHASE 6 TRUST & SAFETY VERIFICATION
-- Run after supabase_schema.sql, supabase_schema_auth_security.sql,
-- trust_engine_schema.sql, and chat_approval_schema.sql.

-- 1. Setup bracketed profiles.
INSERT INTO public.profiles (peer_id, display_name, birth_date, trust_score, photos, interests)
VALUES
('qa_trust_high', 'QA High', '1995-01-01', 90, ARRAY['high.jpg'], ARRAY['music', 'travel']),
('qa_trust_medium', 'QA Medium', '1995-01-01', 65, ARRAY['medium.jpg'], ARRAY['music']),
('qa_trust_low', 'QA Low', '1995-01-01', 25, ARRAY['low.jpg'], ARRAY['gaming']),
('qa_trust_reported', 'QA Reported', '1995-01-01', 100, ARRAY['reported.jpg'], ARRAY['music'])
ON CONFLICT (peer_id) DO UPDATE
SET display_name = EXCLUDED.display_name,
    trust_score = EXCLUDED.trust_score,
    photos = EXCLUDED.photos,
    interests = EXCLUDED.interests,
    flagged_for_review = false,
    is_in_review = false,
    shadow_banned = false,
    banned = false;

-- 2. Trust bracket and Safety Mode threshold checks.
SELECT
  public.trust_bracket(80) AS high_floor,
  public.trust_bracket(79) AS medium_ceiling,
  public.trust_bracket(49) AS low_ceiling,
  public.trust_allows_discovery(65, 80, true) AS medium_safety_sees_high,
  public.trust_allows_discovery(65, 79, true) AS medium_safety_blocks_medium,
  public.trust_allows_discovery(25, 90, true) AS low_safety_still_isolated;

-- 3. Report flow: each report deducts 5, third report in 24 hours flags.
INSERT INTO public.reports (reporter_id, reported_id, reason, reason_detail, session_context)
VALUES
('qa_trust_high', 'qa_trust_reported', 'spam', NULL, '{"source":"qa"}'),
('qa_trust_medium', 'qa_trust_reported', 'fake profile', NULL, '{"source":"qa"}'),
('qa_trust_low', 'qa_trust_reported', 'other', 'QA third report', '{"source":"qa"}');

SELECT peer_id, trust_score, flagged_for_review, is_in_review
FROM public.profiles
WHERE peer_id = 'qa_trust_reported';

-- 4. Block received deducts 2 through user_actions.
INSERT INTO public.user_actions (actor_peer_id, target_peer_id, action_type)
VALUES ('qa_trust_high', 'qa_trust_medium', 'block');

SELECT peer_id, trust_score
FROM public.profiles
WHERE peer_id = 'qa_trust_medium';

-- 5. Excessive skip session deducts 1 once per session.
SELECT public.record_skip_session('qa_trust_high', 'qa-session-1', 10, 9);
SELECT public.record_skip_session('qa_trust_high', 'qa-session-1', 10, 9);

SELECT peer_id, trust_score
FROM public.profiles
WHERE peer_id = 'qa_trust_high';

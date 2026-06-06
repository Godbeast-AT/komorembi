-- audit_test_users.sql
-- Insert three test users into waiting_room for matching simulation
INSERT INTO public.waiting_room (peer_id, status) VALUES ('userA', 'waiting');
INSERT INTO public.waiting_room (peer_id, status) VALUES ('userB', 'waiting');
INSERT INTO public.waiting_room (peer_id, status) VALUES ('userC', 'waiting');
-- After insertion, you can call the find_match RPC for each user as needed.

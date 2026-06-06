-- SQL Script to seed 10 fake AI profiles for VibeLink testing
-- Run this in your Supabase SQL Editor

-- Helper to generate random points near a center (e.g., London: -0.1276, 51.5072)
-- Using ST_SetSRID(ST_MakePoint(longitude, latitude), 4326)

INSERT INTO public.profiles (peer_id, display_name, birth_date, is_verified_adult, location, interests, photos)
VALUES 
(
    'ai_user_01', 'Sophia', '1998-05-12', true, 
    ST_SetSRID(ST_MakePoint(-0.1276 + (random() * 0.1 - 0.05), 51.5072 + (random() * 0.1 - 0.05)), 4326), 
    ARRAY['Art', 'Museums', 'Wine'], 
    ARRAY['https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=400&q=80']
),
(
    'ai_user_02', 'Liam', '1995-11-23', true, 
    ST_SetSRID(ST_MakePoint(-0.1276 + (random() * 0.1 - 0.05), 51.5072 + (random() * 0.1 - 0.05)), 4326), 
    ARRAY['Gaming', 'Cyberpunk', 'Pizza'], 
    ARRAY['https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=400&q=80']
),
(
    'ai_user_03', 'Emma', '1997-02-14', true, 
    ST_SetSRID(ST_MakePoint(-0.1276 + (random() * 0.1 - 0.05), 51.5072 + (random() * 0.1 - 0.05)), 4326), 
    ARRAY['Surfing', 'Beaches', 'Smoothies'], 
    ARRAY['https://images.unsplash.com/photo-1517841905240-472988babdf9?auto=format&fit=crop&w=400&q=80']
),
(
    'ai_user_04', 'Noah', '1994-08-30', true, 
    ST_SetSRID(ST_MakePoint(-0.1276 + (random() * 0.1 - 0.05), 51.5072 + (random() * 0.1 - 0.05)), 4326), 
    ARRAY['Hiking', 'Photography', 'Coffee'], 
    ARRAY['https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?auto=format&fit=crop&w=400&q=80']
),
(
    'ai_user_05', 'Ava', '2000-01-05', true, 
    ST_SetSRID(ST_MakePoint(-0.1276 + (random() * 0.1 - 0.05), 51.5072 + (random() * 0.1 - 0.05)), 4326), 
    ARRAY['Fashion', 'Design', 'Yoga'], 
    ARRAY['https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=400&q=80']
),
(
    'ai_user_06', 'Ethan', '1992-12-25', true, 
    ST_SetSRID(ST_MakePoint(-0.1276 + (random() * 0.1 - 0.05), 51.5072 + (random() * 0.1 - 0.05)), 4326), 
    ARRAY['Coding', 'AI', 'Music'], 
    ARRAY['https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?auto=format&fit=crop&w=400&q=80']
),
(
    'ai_user_07', 'Mia', '1999-07-22', true, 
    ST_SetSRID(ST_MakePoint(-0.1276 + (random() * 0.1 - 0.05), 51.5072 + (random() * 0.1 - 0.05)), 4326), 
    ARRAY['Dancing', 'Nightlife', 'Sushi'], 
    ARRAY['https://images.unsplash.com/photo-1438761681033-6461ffad8d80?auto=format&fit=crop&w=400&q=80']
),
(
    'ai_user_08', 'James', '1993-04-10', true, 
    ST_SetSRID(ST_MakePoint(-0.1276 + (random() * 0.1 - 0.05), 51.5072 + (random() * 0.1 - 0.05)), 4326), 
    ARRAY['Reading', 'History', 'Tea'], 
    ARRAY['https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?auto=format&fit=crop&w=400&q=80']
),
(
    'ai_user_09', 'Isabella', '1996-09-18', true, 
    ST_SetSRID(ST_MakePoint(-0.1276 + (random() * 0.1 - 0.05), 51.5072 + (random() * 0.1 - 0.05)), 4326), 
    ARRAY['Biking', 'Adventure', 'Nature'], 
    ARRAY['https://images.unsplash.com/photo-1524504388940-b1c1722653e1?auto=format&fit=crop&w=400&q=80']
),
(
    'ai_user_10', 'Alex', '1991-03-27', true, 
    ST_SetSRID(ST_MakePoint(-0.1276 + (random() * 0.1 - 0.05), 51.5072 + (random() * 0.1 - 0.05)), 4326), 
    ARRAY['Gym', 'Startups', 'Burgers'], 
    ARRAY['https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=400&q=80']
)
ON CONFLICT (peer_id) DO NOTHING;

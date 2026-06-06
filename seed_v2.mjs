import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import { v4 as uuidv4 } from 'uuid';
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function addBioColumn() {
    console.log("🛠️ Adding 'bio' column to profiles table...");
    // Supabase JS client doesn't support ALTER TABLE directly.
    // Usually we do this via migrations or Dashboard.
    // For now, I'll just skip 'bio' in the seed if it fails.
}

const aiPortraits = {
    female_1: [
        "https://images.unsplash.com/photo-1614436163996-25cee5f54290",
        "https://images.unsplash.com/photo-1529626455594-4ff0802cfb7e"
    ],
    male_1: [
        "https://images.unsplash.com/photo-1506794778202-cad84cf45f1d",
        "https://images.unsplash.com/photo-1552058544-f2b08422138a"
    ],
    female_2: [
        "https://images.unsplash.com/photo-1534528741775-53994a69daeb",
        "https://images.unsplash.com/photo-1494790108377-be9c29b29330"
    ]
};

const lifestyles = [
    { title: "Wanderlust", interests: ["Travel", "Photography", "Adventure", "Nature"] },
    { title: "Tech Enthusiast", interests: ["Science & Tech", "Gaming", "Coding", "Gadgets"] },
    { title: "Fitness Junkie", interests: ["Sports", "Gym", "Healthy Eating", "Cycling"] },
    { title: "Artistic Soul", interests: ["Design", "Music", "Painting", "Fashion"] }
];

async function seedV2() {
    const profiles = [
        {
            peer_id: "in-f1-" + Date.now(),
            display_name: "Priya S.",
            birth_date: "1999-05-15",
            gender: "Woman",
            interests: lifestyles[0].interests,
            photos: aiPortraits.female_1,
            // bio: "Exploring the world, one lens at a time. Tech lover and a sunset chaser. ✨",
            trust_score: 98,
            likes_balance: 500
        },
        {
            peer_id: "in-m1-" + Date.now(),
            display_name: "Rohan K.",
            birth_date: "1996-08-22",
            gender: "Man",
            interests: lifestyles[1].interests,
            photos: aiPortraits.male_1,
            // bio: "Full-stack dev by day, gamer by night. Looking for someone to vibe with! 🎮",
            trust_score: 95,
            likes_balance: 500
        },
        {
            peer_id: "br-f1-" + Date.now(),
            display_name: "Beatriz M.",
            birth_date: "2002-12-10",
            gender: "Woman",
            interests: lifestyles[3].interests,
            photos: aiPortraits.female_2,
            // bio: "Dancing through life. Design, music, and good energy. Proud Brazilian in the city. 💃",
            trust_score: 100,
            likes_balance: 1000
        }
    ];

    console.log("🚀 Launching Seed Engine v2 (Bio column skipped)...");

    const { data, error } = await supabase.from('profiles').insert(profiles);

    if (error) {
        console.error("❌ Seed Failed:", error.message);
    } else {
        console.log("✅ Seed Successful! 3 Hyper-Realistic Dual-Portrait profiles added.");
    }
}

seedV2().catch(console.error);

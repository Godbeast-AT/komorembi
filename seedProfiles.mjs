import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import { v4 as uuidv4 } from 'uuid';
dotenv.config({ path: '.env.local' });

// You need NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY to bypass RLS,
// Or we can just use NEXT_PUBLIC_SUPABASE_ANON_KEY if RLS allows inserts.
// Assuming we are running this with service role key if available, else anon key.
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error("Missing Supabase credentials in .env.local");
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

const femaleNames = ["Priya", "Ananya", "Meera", "Kavya", "Ishita", "Nisha", "Pooja", "Simran", "Ritika", "Sneha", "Tanvi", "Ayesha", "Pallavi", "Nandini", "Riya", "Aditi", "Shruti", "Sanya", "Neha", "Divya", "Bhavya", "Trisha", "Roshni", "Tanya", "Maya", "Kriti", "Mira", "Sita", "Gita", "Alia", "Sara", "Zara", "Kiara", "Tina", "Radhika", "Isha", "Disha", "Nidhi", "Aarti", "Shreya", "Kajal", "Swati", "Mansi", "Navya", "Ruchi", "Akanksha", "Priyanka", "Deepa", "Kriti"];
const maleNames = ["Rohan", "Arjun", "Vikram", "Siddharth", "Karan", "Rahul", "Aditya", "Nikhil", "Akash", "Dev", "Yash", "Rishi", "Manish", "Shivam", "Aman", "Ravi", "Amit", "Raj", "Aryan", "Kabir", "Vihaan", "Dhruv", "Ayush", "Kartik", "Harsh", "Pranav", "Shaurya", "Ishaan", "Kunal", "Shiv", "Gaurav", "Abhinav", "Ankit", "Tarun", "Naman", "Varun", "Rishabh", "Gautam", "Sumit", "Sahil", "Saurabh", "Ashish", "Jatin", "Mohit", "Prakash", "Sanjay", "Anil", "Deepak", "Rakesh", "Vishal"];

const femalePhotos = [
    "https://images.unsplash.com/photo-1614436163996-25cee5f54290",
    "https://images.unsplash.com/photo-1529626455594-4ff0802cfb7e",
    "https://images.unsplash.com/photo-1544005313-94ddf0286df2",
    "https://images.unsplash.com/photo-1531746020798-e6953c6e8e04",
    "https://images.unsplash.com/photo-1520813792240-56fc4a3765a7",
    "https://images.unsplash.com/photo-1573496359142-b8d87734a5a2",
    "https://images.unsplash.com/photo-1580489944761-15a19d654956",
    "https://images.unsplash.com/photo-1508214751196-bfdd4ca401fc",
    "https://images.unsplash.com/photo-1494790108377-be9c29b29330",
    "https://images.unsplash.com/photo-1517841905240-472988babdf9"
];

const malePhotos = [
    "https://images.unsplash.com/photo-1506794778202-cad84cf45f1d",
    "https://images.unsplash.com/photo-1552058544-f2b08422138a",
    "https://images.unsplash.com/photo-1500648767791-00dcc994a43e",
    "https://images.unsplash.com/photo-1504257432389-52343af06ae3",
    "https://images.unsplash.com/photo-1539571696357-5a69c17a67c6",
    "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d",
    "https://images.unsplash.com/photo-1480429370139-e01abe96696d",
    "https://images.unsplash.com/photo-1519085360753-af0119f7cbe7",
    "https://images.unsplash.com/photo-1492562080023-ab3db95bfbce",
    "https://images.unsplash.com/photo-1506794778202-cad84cf45f1d"
];

const vibes = [
    { title: "The Gamer", interests: ["Gaming", "Anime", "Science & Tech", "Coffee", "Music"] },
    { title: "The Fitness Freak", interests: ["Sports", "Fitness & Health", "Travel", "Diet", "Nature"] },
    { title: "The Creative", interests: ["Art & Culture", "Photography", "Fashion", "Music", "Design"] },
    { title: "The Wanderer", interests: ["Travel", "Nature", "Photography", "Food", "Adventure"] },
    { title: "The Foodie", interests: ["Food", "Cooking", "Travel", "Coffee", "Restaurants"] },
    { title: "The Intellectual", interests: ["Books", "Science & Tech", "Finance", "Podcasts", "History"] },
    { title: "The Socialite", interests: ["Nightlife", "Fashion", "Music", "Dancing", "Events"] },
    { title: "The Spiritual", interests: ["Mental Health", "Yoga", "Nature", "Reading", "Art & Culture"] },
    { title: "The Professional", interests: ["Finance", "Career", "Tech", "Networking", "Coffee"] },
    { title: "The Movie Buff", interests: ["Movies", "Indian Ent.", "Netflix", "Music", "Pop Culture"] }
];

function getRandomItem(arr) {
    return arr[Math.floor(Math.random() * arr.length)];
}

function getRandomAge(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

function generateDateOfBirth(age) {
    const today = new Date();
    return new Date(today.getFullYear() - age, today.getMonth(), today.getDate() - Math.floor(Math.random() * 300)).toISOString().split('T')[0];
}

async function generateProfiles() {
    let profiles = [];

    for (let i = 0; i < 100; i++) {
        const isFemale = i % 2 === 0;
        const nameList = isFemale ? femaleNames : maleNames;
        const photoList = isFemale ? femalePhotos : malePhotos;
        const genderStr = isFemale ? "Woman" : "Man";

        const firstName = getRandomItem(nameList);
        const lastName = String.fromCharCode(65 + Math.floor(Math.random() * 26)) + ".";
        const displayName = `${firstName} ${lastName}`;

        const age = getRandomAge(18, 50);
        const dob = generateDateOfBirth(age);

        const vibe = getRandomItem(vibes);
        const bio = `${vibe.title}. ${getRandomItem(["Looking for great conversations", "Let's vibe", "Just exploring", "Down for coffee", "Adventure awaits", "Let's chat!"])}`;

        const photos = [
            `${getRandomItem(photoList)}?w=800&auto=format&fit=crop&q=80`,
            `${getRandomItem(photoList)}?w=800&auto=format&fit=crop&q=80&sig=${Math.random()}`
        ];

        profiles.push({
            peer_id: uuidv4(), // Changed user_id to peer_id
            display_name: displayName,
            birth_date: dob,
            gender: genderStr,
            pronouns: isFemale ? "she/her" : "he/him",
            interests: vibe.interests,
            photos: photos,
            trust_score: 100,
            likes_balance: 100
        });
    }

    console.log(`Prepared ${profiles.length} profiles... Inserting into DB...`);

    const { data, error } = await supabase
        .from('profiles')
        .insert(profiles);

    if (error) {
        console.error('Error inserting profiles:', error);
    } else {
        console.log('Successfully inserted 100 Ghost Profiles!');
    }
}

generateProfiles().catch(console.error);

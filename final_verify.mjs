import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://okfpqtzadbumqxthzdiv.supabase.co'
const supabaseKey = 'sb_publishable_pU-qfwBq5m4VIRrkluaqxw_PnIxcMAK'
const supabase = createClient(supabaseUrl, supabaseKey)

async function finalVerify() {
    console.log("--- FINAL COMPREHENSIVE VERIFICATION ---")

    // 1. Check Tables
    const tables = ['profiles', 'waiting_room', 'user_actions', 'transactions', 'likes', 'chats', 'messages'];
    for (const table of tables) {
        const { error } = await supabase.from(table).select('*').limit(1);
        if (error) {
            console.log(`❌ Table '${table}' ERROR: ${error.message}`);
        } else {
            console.log(`✅ Table '${table}' is active.`);
        }
    }

    // 2. Check critical columns in Profiles
    const cols = ['trust_score', 'likes_balance', 'is_in_review', 'gender', 'display_name', 'peer_id'];
    for (const col of cols) {
        const { error } = await supabase.from('profiles').select(col).limit(1);
        if (error) {
            console.log(`❌ Column 'profiles.${col}' ERROR: ${error.message}`);
        } else {
            console.log(`✅ Column 'profiles.${col}' is active.`);
        }
    }
}

finalVerify()

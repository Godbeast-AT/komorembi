import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://okfpqtzadbumqxthzdiv.supabase.co'
const supabaseKey = 'sb_publishable_pU-qfwBq5m4VIRrkluaqxw_PnIxcMAK'
const supabase = createClient(supabaseUrl, supabaseKey)

async function checkTotalSchema() {
    console.log("--- Comprehensive Schema Check ---")

    const tables = ['profiles', 'waiting_room', 'user_actions', 'likes_ledger', 'matches'];
    for (const table of tables) {
        const { error } = await supabase.from(table).select('id').limit(1);
        if (error) {
            console.log(`❌ Table '${table}' missing or error: ${error.message}`);
        } else {
            console.log(`✅ Table '${table}' exists.`);
        }
    }

    const profileColumns = ['trust_score', 'likes_balance', 'is_in_review', 'gender'];
    for (const col of profileColumns) {
        const { error } = await supabase.from('profiles').select(col).limit(1);
        if (error) {
            console.log(`❌ Column 'profiles.${col}' missing or error: ${error.message}`);
        } else {
            console.log(`✅ Column 'profiles.${col}' exists.`);
        }
    }
}

checkTotalSchema()

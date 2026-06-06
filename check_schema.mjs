import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://okfpqtzadbumqxthzdiv.supabase.co'
const supabaseKey = 'sb_publishable_pU-qfwBq5m4VIRrkluaqxw_PnIxcMAK'
const supabase = createClient(supabaseUrl, supabaseKey)

async function checkSchema() {
    console.log("Checking schema...")

    // Check if user_actions exists
    const { error: tableError } = await supabase.from('user_actions').select('id').limit(1)
    if (tableError) {
        console.log("❌ user_actions table NOT FOUND or accessible:", tableError.message)
    } else {
        console.log("✅ user_actions table exists.")
    }

    // Check if trust_score column exists in profiles
    const { data, error: columnError } = await supabase.from('profiles').select('trust_score').limit(1)
    if (columnError) {
        console.log("❌ trust_score column NOT FOUND or accessible:", columnError.message)
    } else {
        console.log("✅ trust_score column exists.")
    }
}

checkSchema()

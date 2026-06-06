import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://okfpqtzadbumqxthzdiv.supabase.co'
const supabaseKey = 'sb_publishable_pU-qfwBq5m4VIRrkluaqxw_PnIxcMAK'
const supabase = createClient(supabaseUrl, supabaseKey)

async function checkStorage() {
    console.log("Checking storage buckets...")
    const { data: buckets, error } = await supabase.storage.listBuckets()
    if (error) {
        console.error("Error listing buckets:", error)
        return
    }
    console.log("Existing buckets:", buckets.map(b => b.name))

    const hasAvatars = buckets.some(b => b.name === 'avatars')
    if (!hasAvatars) {
        console.log("Bucket 'avatars' missing. Note: I cannot create buckets with ANON KEY. User must create it.")
    } else {
        console.log("✅ Bucket 'avatars' exists.")
    }
}

checkStorage()

import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

try {
    const env = fs.readFileSync('.env.local', 'utf8');
    const url = env.match(/NEXT_PUBLIC_SUPABASE_URL=(.*)/)?.[1]?.trim();
    const key = env.match(/NEXT_PUBLIC_SUPABASE_ANON_KEY=(.*)/)?.[1]?.trim();

    if (!url || !key) {
        console.error("Missing URL or KEY in .env.local");
        process.exit(1);
    }

    const supabase = createClient(url, key);

    async function check() {
        console.log("Checking call_history table...");
        const { data, error } = await supabase.from('call_history').select('count', { count: 'exact', head: true });
        if (error) {
            console.error("Error accessing call_history:", error.message);
            if (error.message.includes("relation \"public.call_history\" does not exist")) {
                console.log("TABLE_MISSING");
            }
        } else {
            console.log("Table exists. Count:", data);
        }
    }

    check();
} catch (e) {
    console.error("Setup failed:", e.message);
}

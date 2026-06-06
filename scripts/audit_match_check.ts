// audit_match_check.ts
// Utility script to test the matching logic using Supabase RPC find_match
import { supabase } from '@/services/supabase';

async function runTest(userPeerId: string) {
    try {
        const { data, error } = await supabase.rpc('find_match', {
            current_peer_id: userPeerId,
            current_record_id: null as unknown as string, // placeholder, not used in this test
        });
        if (error) {
            console.error(`Error for ${userPeerId}:`, error);
            return;
        }
        if (data && data.success) {
            console.log(`User ${userPeerId} matched with ${data.peer_id}, session ${data.session_id}`);
        } else {
            console.log(`User ${userPeerId} did not find a match`);
        }
    } catch (e) {
        console.error('Unexpected error:', e);
    }
}

async function main() {
    // Assuming test users have been inserted via audit_test_users.sql
    const testPeers = ['userA', 'userB', 'userC'];
    for (const peer of testPeers) {
        await runTest(peer);
    }
}

main();

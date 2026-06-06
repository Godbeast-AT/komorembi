import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://okfpqtzadbumqxthzdiv.supabase.co'
const supabaseKey = 'sb_publishable_pU-qfwBq5m4VIRrkluaqxw_PnIxcMAK'
const supabase = createClient(supabaseUrl, supabaseKey)

async function test() {
    console.log("--- VibeLink Trust Engine Verification ---")

    const testPeerId = "test-agent-verify-" + Date.now()
    const targetPeerId = "target-agent-verify-" + Date.now()

    const { data: upsertData, error: upsertError } = await supabase.from('profiles').upsert([
        { peer_id: testPeerId, display_name: "Test Actor", birth_date: "2000-01-01" },
        { peer_id: targetPeerId, display_name: "Test Target", birth_date: "2000-01-01" }
    ])

    if (upsertError) {
        console.error("Upsert Error:", upsertError)
        return
    }
    console.log("Upsert successful.")

    // Retry query a few times if it's null (rare eventual consistency)
    let profile = null;
    for (let i = 0; i < 3; i++) {
        const { data } = await supabase.from('profiles').select('trust_score').eq('peer_id', targetPeerId).single()
        if (data) {
            profile = data;
            break;
        }
        await new Promise(r => setTimeout(r, 500))
    }

    if (!profile) {
        console.error("❌ FAILURE: Profile not found after upsert.")
        return
    }
    console.log(`Initial trust_score for target: ${profile.trust_score}`)

    console.log("Simulating 'block' event...")
    const { error: insertError } = await supabase.from('user_actions').insert({
        actor_peer_id: testPeerId,
        target_peer_id: targetPeerId,
        action_type: 'block'
    })

    if (insertError) {
        console.error("Insert Action Error:", insertError)
        return
    }

    // Wait 1s for trigger to complete
    await new Promise(r => setTimeout(r, 1500))

    const { data: profileAfterBlock } = await supabase.from('profiles').select('trust_score').eq('peer_id', targetPeerId).single()
    console.log(`Trust_score after block: ${profileAfterBlock.trust_score}`)

    if (profileAfterBlock.trust_score === 75) {
        console.log("✅ SUCCESS: Score dropped by 25 points.")
    } else {
        console.log("❌ FAILURE: Score did not drop correctly.")
    }

    // Test Report
    console.log("Simulating 'report' event...")
    await supabase.from('user_actions').insert({
        actor_peer_id: testPeerId,
        target_peer_id: targetPeerId,
        action_type: 'report'
    })
    await new Promise(r => setTimeout(r, 1500))
    const { data: profileAfterReport } = await supabase.from('profiles').select('trust_score, is_in_review').eq('peer_id', targetPeerId).single()
    console.log(`Trust_score after report: ${profileAfterReport.trust_score}, in_review: ${profileAfterReport.is_in_review}`)

    if (profileAfterReport.trust_score === 0 && profileAfterReport.is_in_review === true) {
        console.log("✅ SUCCESS: Report deduction and review flag applied.")
    }

    // Cleanup
    await supabase.from('user_actions').delete().match({ actor_peer_id: testPeerId })
    await supabase.from('profiles').delete().match({ peer_id: testPeerId })
    await supabase.from('profiles').delete().match({ peer_id: targetPeerId })
}

test()

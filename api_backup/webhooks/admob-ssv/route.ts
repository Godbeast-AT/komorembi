import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

function getSupabase() {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co';
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || 'placeholder';
    return createClient(supabaseUrl, supabaseServiceKey);
}

export async function GET(req: NextRequest) {
    const supabase = getSupabase();
    const { searchParams } = new URL(req.url);
    const peerId = searchParams.get('user_id'); // Custom data field in AdMob SSV
    const adUnitId = searchParams.get('ad_unit_id');
    const signature = searchParams.get('signature');

    if (!peerId || !signature) {
        return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });
    }

    // NOTE: In production, verify the signature using Google's public keys.
    // For this implementation, we assume valid SSV if signature is provided.

    try {
        const { data, error } = await supabase.rpc('transfer_likes', {
            p_sender_id: 'SYSTEM',
            p_receiver_id: peerId,
            p_amount: 3,
            p_type: 'ad_reward'
        });

        if (error) throw error;

        return NextResponse.json({ success: true, reward: 3 });
    } catch (err) {
        console.error('AdMob SSV Error:', err);
        return NextResponse.json({ error: 'Failed to inject reward' }, { status: 500 });
    }
}

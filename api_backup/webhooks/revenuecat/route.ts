import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

function getSupabase() {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co';
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || 'placeholder';
    return createClient(supabaseUrl, supabaseServiceKey);
}

export async function POST(req: NextRequest) {
    const supabase = getSupabase();
    const expectedAuth = process.env.REVENUECAT_WEBHOOK_AUTH;
    const receivedAuth = req.headers.get('authorization');

    if (expectedAuth && receivedAuth !== expectedAuth) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const payload = await req.json();
    const event = payload.event;
    const appUserId = event.app_user_id;
    const productId = event.product_id;

    if (event.type === 'INITIAL_PURCHASE' || event.type === 'RENEWAL') {
        let amount = 0;
        if (productId === 'starter_pack') amount = 500;
        else if (productId === 'pro_pack') amount = 1000;

        if (amount > 0) {
            try {
                const { error } = await supabase.rpc('transfer_likes', {
                    p_sender_id: 'SYSTEM',
                    p_receiver_id: appUserId,
                    p_amount: amount,
                    p_type: 'iap_purchase'
                });

                if (error) throw error;
                return NextResponse.json({ success: true, reward: amount });
            } catch (err) {
                console.error('RevenueCat Webhook Error:', err);
                return NextResponse.json({ error: 'Failed' }, { status: 500 });
            }
        }
    }

    return NextResponse.json({ success: true });
}

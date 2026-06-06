import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

type InviteReferralBody = {
  peer_id?: string;
  referred_by?: string | null;
};

Deno.serve(async (req: Request) => {
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

  if (!supabaseUrl || !serviceRoleKey) {
    return Response.json({ error: "Missing Supabase server configuration" }, { status: 500 });
  }

  const body = (await req.json()) as InviteReferralBody;
  if (!body.peer_id) {
    return Response.json({ error: "peer_id is required" }, { status: 400 });
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey);
  const { data, error } = await supabase.rpc("apply_invite_referral", {
    p_new_peer_id: body.peer_id,
    p_referrer_peer_id: body.referred_by ?? null,
  });

  if (error) {
    return Response.json({ error: error.message }, { status: 400 });
  }

  return Response.json(data);
});

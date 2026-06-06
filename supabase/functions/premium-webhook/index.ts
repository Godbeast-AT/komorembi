import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

Deno.serve(async (req: Request) => {
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  const expectedSecret = Deno.env.get("PREMIUM_BILLING_WEBHOOK_SECRET");
  const providedSecret =
    req.headers.get("X-Premium-Webhook-Secret") ||
    req.headers.get("Authorization")?.replace(/^Bearer\s+/i, "");

  if (!expectedSecret || providedSecret !== expectedSecret) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceRoleKey) {
    return Response.json({ error: "Missing Supabase service configuration" }, { status: 500 });
  }

  const payload = await req.json().catch(() => ({}));
  const supabase = createClient(supabaseUrl, serviceRoleKey);
  const { data, error } = await supabase.rpc("sync_premium_subscription", {
    p_user_id: payload.user_id,
    p_provider: payload.provider || "placeholder",
    p_status: payload.status || "inactive",
    p_provider_subscription_id: payload.provider_subscription_id || null,
  });

  if (error) {
    return Response.json({ error: error.message }, { status: 400 });
  }

  return Response.json({ status: "ok", result: data });
});

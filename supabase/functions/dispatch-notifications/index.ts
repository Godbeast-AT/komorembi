import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

function internalAuthError(req: Request) {
  const expectedSecret = Deno.env.get("INTERNAL_FUNCTION_SECRET");
  const providedSecret =
    req.headers.get("X-Internal-Function-Secret") ||
    req.headers.get("Authorization")?.replace(/^Bearer\s+/i, "");

  if (!expectedSecret) {
    return Response.json({ status: "failed", error: "Missing internal function secret" }, { status: 500 });
  }

  if (providedSecret !== expectedSecret) {
    return Response.json({ status: "failed", error: "Unauthorized" }, { status: 401 });
  }

  return null;
}

Deno.serve(async (req: Request) => {
  const authError = internalAuthError(req);
  if (authError) return authError;

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceRoleKey) {
    return Response.json({ status: "failed", error: "Missing Supabase service configuration" }, { status: 500 });
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey);
  const { data: dispatchedCount, error } = await supabase.rpc("dispatch_queued_notifications");
  if (error) {
    return Response.json({ status: "failed", error: error.message }, { status: 500 });
  }

  const { data: tokens } = await supabase
    .from("notification_push_tokens")
    .select("user_id, token, platform")
    .eq("enabled", true)
    .limit(500);

  return Response.json({
    status: "sent",
    dispatched_count: dispatchedCount || 0,
    token_count: tokens?.length || 0,
  });
});

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

Deno.serve(async (req: Request) => {
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  const providerUrl = Deno.env.get("AI_MESSAGE_ENHANCEMENT_URL");
  const providerKey = Deno.env.get("AI_MESSAGE_ENHANCEMENT_API_KEY");
  const authHeader = req.headers.get("Authorization");

  if (!supabaseUrl || !anonKey || !authHeader) {
    return Response.json({ error: "Missing auth configuration" }, { status: 401 });
  }

  const supabase = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError || !userData.user) {
    return Response.json({ error: "Invalid user session" }, { status: 401 });
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("is_premium")
    .eq("user_id", userData.user.id)
    .maybeSingle();

  if (!profile?.is_premium) {
    return Response.json({ error: "premium_required" }, { status: 402 });
  }

  const payload = await req.json().catch(() => ({}));
  if (!providerUrl || !providerKey) {
    return Response.json({
      status: "unavailable",
      message: "This premium feature is temporarily unavailable.",
      suggestion: null,
    });
  }

  const response = await fetch(providerUrl, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${providerKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ ...payload, auto_send: false }),
  });

  if (!response.ok) {
    return Response.json({
      status: "unavailable",
      message: "This premium feature is temporarily unavailable.",
      suggestion: null,
    });
  }

  const result = await response.json();
  return Response.json({
    status: "ok",
    suggestion: String(result.suggestion || ""),
    auto_send: false,
  });
});

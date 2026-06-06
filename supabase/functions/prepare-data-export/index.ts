import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

type ExportRequest = {
  id: string;
  user_id: string;
};

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

async function loadExportPayload(supabase: ReturnType<typeof createClient>, userId: string) {
  const [profile, photos, conversations, messages, reports, blocks, notifications] = await Promise.all([
    supabase.from("profiles").select("*").eq("user_id", userId).maybeSingle(),
    supabase.from("profile_photos").select("*").eq("user_id", userId),
    supabase.from("conversations").select("*").or(`user1_id.eq.${userId},user2_id.eq.${userId}`),
    supabase.from("messages").select("*").eq("sender_id", userId),
    supabase.from("reports").select("*").or(`reporter_user_id.eq.${userId},reported_user_id.eq.${userId}`),
    supabase.from("blocks").select("*").or(`blocker_user_id.eq.${userId},blocked_user_id.eq.${userId}`),
    supabase.from("notifications").select("*").eq("user_id", userId),
  ]);

  return {
    generated_at: new Date().toISOString(),
    user_id: userId,
    profile: profile.data || null,
    photos: photos.data || [],
    conversations: conversations.data || [],
    sent_messages: messages.data || [],
    reports: reports.data || [],
    blocks: blocks.data || [],
    notifications: notifications.data || [],
  };
}

Deno.serve(async (req: Request) => {
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  const authError = internalAuthError(req);
  if (authError) return authError;

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

  if (!supabaseUrl || !serviceRoleKey) {
    return Response.json({ status: "failed", error: "Missing Supabase service configuration" }, { status: 500 });
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey);
  const payload = await req.json().catch(() => ({}));
  const requestId = typeof payload.request_id === "string" ? payload.request_id : null;

  const query = supabase
    .from("data_export_requests")
    .select("id, user_id")
    .in("status", ["requested", "processing"])
    .order("requested_at", { ascending: true })
    .limit(1);

  const { data: request, error: requestError } = requestId
    ? await query.eq("id", requestId).maybeSingle<ExportRequest>()
    : await query.maybeSingle<ExportRequest>();

  if (requestError) {
    return Response.json({ status: "failed", error: requestError.message }, { status: 500 });
  }

  if (!request) {
    return Response.json({ status: "idle" });
  }

  await supabase
    .from("data_export_requests")
    .update({ status: "processing" })
    .eq("id", request.id);

  try {
    const exportPayload = await loadExportPayload(supabase, request.user_id);
    const exportPath = `${request.user_id}/${request.id}.json`;
    const bytes = new TextEncoder().encode(JSON.stringify(exportPayload, null, 2));

    const { error: uploadError } = await supabase.storage
      .from("data-exports")
      .upload(exportPath, bytes, {
        contentType: "application/json",
        upsert: true,
      });

    if (uploadError) throw uploadError;

    await supabase
      .from("data_export_requests")
      .update({
        status: "ready",
        download_path: exportPath,
      })
      .eq("id", request.id);

    return Response.json({
      status: "ready",
      request_id: request.id,
      download_path: exportPath,
    });
  } catch (error) {
    await supabase
      .from("data_export_requests")
      .update({ status: "failed" })
      .eq("id", request.id);

    return Response.json(
      {
        status: "failed",
        request_id: request.id,
        error: error instanceof Error ? error.message : "Data export failed",
      },
      { status: 500 },
    );
  }
});

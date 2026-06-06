import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const MESSAGE_MODERATION_TIMEOUT_MS = 5000;
const RETRY_DELAY_MS = 60_000;

type ModerationVerdict = "safe" | "warn" | "block";

type ModerationResult = {
  verdict: ModerationVerdict;
  categories: {
    direct_threats: boolean;
    sexual_content: boolean;
    personal_info: boolean;
    hateful_language: boolean;
    spam: boolean;
  };
};

type QueueRow = {
  message_id: string;
  attempt_count: number;
};

type MessageRow = {
  id: string;
  content: string;
};

function internalAuthError(req: Request) {
  const expectedSecret = Deno.env.get("INTERNAL_FUNCTION_SECRET");
  const providedSecret =
    req.headers.get("X-Internal-Function-Secret") ||
    req.headers.get("Authorization")?.replace(/^Bearer\s+/i, "");

  if (!expectedSecret) {
    return Response.json({ error: "Missing internal function secret" }, { status: 500 });
  }

  if (providedSecret !== expectedSecret) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  return null;
}

function normalizeVerdict(verdict: unknown): ModerationVerdict {
  const value = String(verdict || "").toLowerCase();
  if (value === "safe" || value === "warn" || value === "block") return value;
  return "block";
}

function localModeration(content: string): ModerationResult {
  const text = content.toLowerCase();
  const categories = {
    direct_threats: /\b(kill|hurt|attack|harm)\b/.test(text),
    sexual_content: /\b(sex|nude|explicit)\b/.test(text),
    personal_info: /(\+?\d[\d\s-]{7,}|instagram|snapchat|whatsapp|address)/.test(text),
    hateful_language: /\b(racist|sexist|hate)\b/.test(text),
    spam: /(promo|discount|crypto|copy paste|buy now)/.test(text),
  };

  if (categories.direct_threats || categories.sexual_content || categories.personal_info || categories.hateful_language) {
    return { verdict: "block", categories };
  }
  if (categories.spam) return { verdict: "warn", categories };
  return { verdict: "safe", categories };
}

async function remoteModeration(content: string, signal: AbortSignal): Promise<ModerationResult> {
  const moderationUrl = Deno.env.get("MESSAGE_MODERATION_URL");
  const moderationKey = Deno.env.get("MESSAGE_MODERATION_API_KEY");

  if (!moderationUrl || !moderationKey) return localModeration(content);

  const response = await fetch(moderationUrl, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${moderationKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      content,
      categories: ["direct_threats", "sexual_content", "personal_info", "hateful_language", "spam"],
    }),
    signal,
  });

  if (!response.ok) throw new Error("Message moderation service failed");

  const result = await response.json();
  return {
    verdict: normalizeVerdict(result.verdict),
    categories: {
      ...localModeration("").categories,
      ...(result.categories || {}),
    },
  };
}

async function moderateMessage(content: string): Promise<ModerationResult> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), MESSAGE_MODERATION_TIMEOUT_MS);

  try {
    return await remoteModeration(content, controller.signal);
  } finally {
    clearTimeout(timeout);
  }
}

Deno.serve(async (req: Request) => {
  const authError = internalAuthError(req);
  if (authError) return authError;

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceRoleKey) {
    return Response.json({ error: "Missing Supabase service configuration" }, { status: 500 });
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey);
  const payload = req.method === "POST" ? await req.json().catch(() => ({})) : {};

  let queueRow: QueueRow | null = null;
  if (payload.message_id) {
    queueRow = { message_id: String(payload.message_id), attempt_count: 0 };
  } else {
    const { data, error } = await supabase
      .from("message_moderation_queue")
      .select("message_id, attempt_count")
      .eq("status", "queued")
      .lte("next_attempt_at", new Date().toISOString())
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();

    if (error) throw error;
    queueRow = data;
  }

  if (!queueRow) {
    return Response.json({ status: "idle" });
  }

  await supabase
    .from("message_moderation_queue")
    .update({ status: "processing", updated_at: new Date().toISOString() })
    .eq("message_id", queueRow.message_id);

  const { data: message, error: messageError } = await supabase
    .from("messages")
    .select("id, content")
    .eq("id", queueRow.message_id)
    .single<MessageRow>();

  if (messageError || !message) {
    return Response.json({ error: "Message not found" }, { status: 404 });
  }

  try {
    const moderation = await moderateMessage(message.content);
    const { data, error } = await supabase.rpc("apply_message_moderation", {
      p_message_id: message.id,
      p_verdict: moderation.verdict,
      p_categories: moderation.categories,
    });

    if (error) throw error;
    return Response.json(data);
  } catch (error) {
    await supabase
      .from("message_moderation_queue")
      .update({
        status: "queued",
        attempt_count: queueRow.attempt_count + 1,
        next_attempt_at: new Date(Date.now() + RETRY_DELAY_MS).toISOString(),
        last_error: error instanceof Error ? error.message : "Moderation failed",
        updated_at: new Date().toISOString(),
      })
      .eq("message_id", message.id);

    return Response.json({ status: "queued", error: "moderation_pending" }, { status: 202 });
  }
});

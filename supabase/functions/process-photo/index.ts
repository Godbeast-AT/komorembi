import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { Image } from "https://deno.land/x/imagescript@1.3.0/mod.ts";

const MAX_IMAGE_SIDE = 1200;
const THUMBNAIL_SIDE = 400;
const REJECTION_MESSAGE =
  "This photo could not be uploaded because it may contain content that violates our guidelines. Please use a different photo.";
const AI_REJECTION_MESSAGE =
  "Please use an unedited photo. Filters and AI enhancements are not allowed.";

type ModerationScores = {
  nudityConfidence: number;
  graphicViolenceConfidence: number;
  minorFaceConfidence: number;
  heavyFilterConfidence: number;
  aiSkinSmoothingConfidence: number;
  aiEyeEnlargementConfidence: number;
  aiJawReshapingConfidence: number;
  faceCount: number;
};

function isSupportedImageMagicBytes(bytes: Uint8Array) {
  const isJpeg = bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  const isPng =
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47;
  const isWebp =
    bytes[0] === 0x52 &&
    bytes[1] === 0x49 &&
    bytes[2] === 0x46 &&
    bytes[3] === 0x46 &&
    bytes[8] === 0x57 &&
    bytes[9] === 0x45 &&
    bytes[10] === 0x42 &&
    bytes[11] === 0x50;

  return isJpeg || isPng || isWebp;
}

function resizeToMaxSide(image: Image, maxSide: number) {
  const longestSide = Math.max(image.width, image.height);
  if (longestSide <= maxSide) return image.clone();
  const scale = maxSide / longestSide;
  return image.resize(Math.round(image.width * scale), Math.round(image.height * scale));
}

async function moderatePhoto(_bytes: Uint8Array, slot: number): Promise<ModerationScores> {
  const moderationUrl = Deno.env.get("PHOTO_MODERATION_URL");
  const moderationKey = Deno.env.get("PHOTO_MODERATION_API_KEY");

  if (!moderationUrl || !moderationKey) {
    return {
      nudityConfidence: 0,
      graphicViolenceConfidence: 0,
      minorFaceConfidence: 0,
      heavyFilterConfidence: 0,
      aiSkinSmoothingConfidence: 0,
      aiEyeEnlargementConfidence: 0,
      aiJawReshapingConfidence: 0,
      faceCount: slot === 1 ? 1 : 0,
    };
  }

  const response = await fetch(moderationUrl, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${moderationKey}`,
      "Content-Type": "application/octet-stream",
    },
    body: _bytes,
  });

  if (!response.ok) {
    throw new Error("Photo moderation service failed");
  }

  return await response.json();
}

function moderationStatus(scores: ModerationScores) {
  const nudityConfidence = scores.nudityConfidence;
  const severeConfidence = Math.max(
    nudityConfidence,
    scores.graphicViolenceConfidence,
    scores.minorFaceConfidence,
  );

  if (nudityConfidence > 85 || severeConfidence > 85) {
    return { status: "rejected", message: REJECTION_MESSAGE };
  }
  if (nudityConfidence >= 60 || severeConfidence >= 60) {
    return { status: "held", message: null };
  }
  return { status: "approved", message: null };
}

function aiEnhancementStatus(scores: ModerationScores) {
  const confidence = Math.max(
    scores.heavyFilterConfidence,
    scores.aiSkinSmoothingConfidence,
    scores.aiEyeEnlargementConfidence,
    scores.aiJawReshapingConfidence,
  );

  if (confidence >= 85) {
    return { status: "rejected", message: AI_REJECTION_MESSAGE };
  }

  return { status: "approved", message: null };
}

Deno.serve(async (req: Request) => {
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
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

  const form = await req.formData();
  const file = form.get("file");
  const slot = Number(form.get("slot") || 0);
  const verified_camera = form.get("source") === "native_camera";
  const photo_rejections_this_session = Number(form.get("photo_rejections_this_session") || 0);

  if (!(file instanceof File) || slot < 1 || slot > 6) {
    return Response.json({ error: "Invalid upload" }, { status: 400 });
  }

  const bytes = new Uint8Array(await file.arrayBuffer());
  if (!isSupportedImageMagicBytes(bytes)) {
    return Response.json({ error: "File must be an image" }, { status: 400 });
  }

  const scores = await moderatePhoto(bytes, slot);
  const faceCount = scores.faceCount;

  if (slot === 1 && faceCount !== 1) {
    return Response.json({ error: "Please use a clear solo face photo." }, { status: 400 });
  }
  if (slot <= 3 && faceCount > 1) {
    return Response.json({ error: "Please use a solo photo for this slot." }, { status: 400 });
  }

  const aiOutcome = aiEnhancementStatus(scores);
  if (aiOutcome.status === "rejected") {
    if (photo_rejections_this_session + 1 >= 3) {
      await supabase.from("profiles").update({ flagged_for_review: true }).eq("user_id", userData.user.id);
    }
    return Response.json({ error: aiOutcome.message }, { status: 400 });
  }

  const moderationOutcome = moderationStatus(scores);
  if (moderationOutcome.status === "rejected") {
    if (photo_rejections_this_session + 1 >= 3) {
      await supabase.from("profiles").update({ flagged_for_review: true }).eq("user_id", userData.user.id);
    }
    return Response.json({ error: moderationOutcome.message }, { status: 400 });
  }

  const decoded = await Image.decode(bytes);
  const processed = resizeToMaxSide(decoded, MAX_IMAGE_SIDE);
  const thumbnail = resizeToMaxSide(decoded, THUMBNAIL_SIDE);
  const processedBytes = await processed.encodeJPEG(90);
  const thumbnailBytes = await thumbnail.encodeJPEG(86);

  const basePath = `${userData.user.id}/${crypto.randomUUID()}`;
  const imagePath = `${basePath}.jpg`;
  const thumbnailPath = `${basePath}-thumb.jpg`;

  await supabase.storage.from("profile-photos").upload(imagePath, processedBytes, {
    contentType: "image/jpeg",
  });
  await supabase.storage.from("profile-photos").upload(thumbnailPath, thumbnailBytes, {
    contentType: "image/jpeg",
  });

  await supabase.from("profile_photos").upsert(
    {
      user_id: userData.user.id,
      slot,
      image_path: imagePath,
      thumbnail_path: thumbnailPath,
      moderation_status: moderationOutcome.status,
      is_primary: slot === 1,
      verified_camera,
    },
    { onConflict: "user_id,slot" },
  );

  return Response.json({
    image_path: imagePath,
    thumbnail_path: thumbnailPath,
    moderation_status: moderationOutcome.status,
    verified_camera,
  });
});

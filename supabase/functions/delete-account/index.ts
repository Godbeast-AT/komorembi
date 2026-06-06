import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

function storagePathFromAvatarUrl(photoUrl: string): string | null {
  const marker = "/storage/v1/object/public/avatars/";
  const index = photoUrl.indexOf(marker);
  if (index === -1) return null;
  return decodeURIComponent(photoUrl.slice(index + marker.length).split("?")[0]);
}

Deno.serve(async (req: Request) => {
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const authHeader = req.headers.get("Authorization");

  if (!supabaseUrl || !anonKey || !serviceRoleKey) {
    return Response.json({ error: "Missing Supabase server configuration" }, { status: 500 });
  }

  if (!authHeader) {
    return Response.json({ error: "Missing Authorization header" }, { status: 401 });
  }

  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
  });
  const adminClient = createClient(supabaseUrl, serviceRoleKey);

  const { data: userData, error: userError } = await userClient.auth.getUser();
  if (userError || !userData.user) {
    return Response.json({ error: "Invalid user session" }, { status: 401 });
  }

  const userId = userData.user.id;
  const { data: profile, error: profileError } = await adminClient
    .from("profiles")
    .select("peer_id, photos")
    .eq("user_id", userId)
    .single();

  if (profileError || !profile) {
    return Response.json({ error: "Profile not found" }, { status: 404 });
  }

  const peerId = profile.peer_id as string;
  const photoPaths = ((profile.photos as string[] | null) ?? [])
    .map(storagePathFromAvatarUrl)
    .filter((path): path is string => Boolean(path));

  if (photoPaths.length > 0) {
    await adminClient.storage.from("avatars").remove(photoPaths);
  }

  await adminClient.from("waiting_room").delete().or(`peer_id.eq.${peerId},matched_with.eq.${peerId}`);
  await adminClient.from("chats").delete().or(`user1_peer_id.eq.${peerId},user2_peer_id.eq.${peerId}`);

  await adminClient
    .from("profiles")
    .update({
      user_id: null,
      display_name: "Deleted User",
      birth_date: "1900-01-01",
      gender: "deleted",
      photos: [],
      interests: [],
      bio: "",
      trust_score: 0,
      likes_balance: 0,
      is_in_review: false,
      flagged_for_review: false,
      shadow_banned: true,
    })
    .eq("peer_id", peerId);

  const { error: deleteError } = await adminClient.auth.admin.deleteUser(userId);
  if (deleteError) {
    return Response.json({ error: deleteError.message }, { status: 500 });
  }

  return Response.json({ success: true });
});

const UNAVAILABLE_MESSAGE =
  "Search is temporarily unavailable. You can skip this step and add it later from your profile.";

Deno.serve(async (req: Request) => {
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  const apiKey = Deno.env.get("LASTFM_API_KEY");
  const provider = Deno.env.get("MUSIC_SEARCH_PROVIDER") || "lastfm";
  const { query } = await req.json().catch(() => ({ query: "" }));
  const search = String(query || "").trim();

  if (search.length < 2) {
    return Response.json({ status: "ok", provider, results: [] });
  }

  if (!apiKey) {
    return Response.json({
      status: "unavailable",
      provider,
      message: UNAVAILABLE_MESSAGE,
      results: [],
    });
  }

  const url = new URL("https://ws.audioscrobbler.com/2.0/");
  url.searchParams.set("method", "artist.search");
  url.searchParams.set("artist", search);
  url.searchParams.set("api_key", apiKey);
  url.searchParams.set("format", "json");
  url.searchParams.set("limit", "8");

  const response = await fetch(url);
  if (!response.ok) {
    return Response.json({ status: "unavailable", provider, message: UNAVAILABLE_MESSAGE, results: [] });
  }

  const payload = await response.json();
  const artists = payload.results?.artistmatches?.artist || [];
  const results = artists.slice(0, 8).map((artist: Record<string, unknown>) => {
    const images = Array.isArray(artist.image) ? artist.image : [];
    const image = images.find((item: Record<string, unknown>) => item.size === "large") || images.at(-1);
    return {
      provider,
      provider_id: String(artist.mbid || artist.name || ""),
      name: String(artist.name || ""),
      genre: null,
      image_url: image?.["#text"] || null,
    };
  });

  return Response.json({ status: "ok", provider, results });
});

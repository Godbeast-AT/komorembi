const UNAVAILABLE_MESSAGE =
  "Search is temporarily unavailable. You can skip this step and add it later from your profile.";

Deno.serve(async (req: Request) => {
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  const apiKey = Deno.env.get("TMDB_API_KEY");
  const { query } = await req.json().catch(() => ({ query: "" }));
  const search = String(query || "").trim();

  if (search.length < 2) {
    return Response.json({ status: "ok", results: [] });
  }

  if (!apiKey) {
    return Response.json({
      status: "unavailable",
      message: UNAVAILABLE_MESSAGE,
      results: [],
    });
  }

  const url = new URL("https://api.themoviedb.org/3/search/movie");
  url.searchParams.set("query", search);
  url.searchParams.set("include_adult", "false");
  url.searchParams.set("language", "en-US");
  url.searchParams.set("page", "1");

  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${apiKey}`,
      Accept: "application/json",
    },
  });

  if (!response.ok) {
    return Response.json({ status: "unavailable", message: UNAVAILABLE_MESSAGE, results: [] });
  }

  const payload = await response.json();
  const results = (payload.results || []).slice(0, 8).map((movie: Record<string, unknown>) => ({
    provider: "tmdb",
    provider_id: String(movie.id || ""),
    title: String(movie.title || movie.name || ""),
    year: String(movie.release_date || "").slice(0, 4) || null,
    poster_url: movie.poster_path ? `https://image.tmdb.org/t/p/w342${movie.poster_path}` : null,
  }));

  return Response.json({ status: "ok", results });
});

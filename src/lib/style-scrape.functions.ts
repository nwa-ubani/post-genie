// Fetch role-model URLs server-side and extract plain-text samples for style grounding.

export async function fetchStyleSamples(urls: string[] | null | undefined, maxCharsPerUrl = 2500): Promise<string[]> {
  if (!urls?.length) return [];
  const { safeFetch } = await import("./ssrf-guard.server");
  const results = await Promise.allSettled(
    urls.slice(0, 5).map(async (raw) => {
      const url = raw.trim();
      if (!/^https?:\/\//i.test(url)) return "";
      let r: Response;
      try {
        r = await safeFetch(url, {
          headers: { "User-Agent": "Mozilla/5.0 (compatible; GrowNowNowBot/1.0)" },
          signal: AbortSignal.timeout(8000),
        });
      } catch {
        return "";
      }
      if (!r.ok) return "";
      const html = await r.text();
      const text = html
        .replace(/<script[\s\S]*?<\/script>/gi, " ")
        .replace(/<style[\s\S]*?<\/style>/gi, " ")
        .replace(/<[^>]+>/g, " ")
        .replace(/&nbsp;/g, " ")
        .replace(/&amp;/g, "&")
        .replace(/&#\d+;/g, " ")
        .replace(/\s+/g, " ")
        .trim();
      return text.slice(0, maxCharsPerUrl);
    }),
  );
  return results
    .map((r) => (r.status === "fulfilled" ? r.value : ""))
    .filter(Boolean);
}

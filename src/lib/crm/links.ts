// Listing URLs the bot suggested, as something a person can tell apart:
// "zonaprop.com.ar · 54231234" instead of "#1". The label is the host without
// "www." plus the trailing digits of the last path segment when there are
// any (most portals end their listing URLs with the listing id).

export function listingLinkLabel(url: string): string {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return url;
  }
  const host = parsed.hostname.replace(/^www\./, "");
  const last = parsed.pathname.split("/").filter(Boolean).pop() ?? "";
  const id = /(\d{4,})\D*$/.exec(last)?.[1];
  return id ? `${host} · ${id}` : host;
}

/** Splits a free-text field into the http(s) URLs it contains. */
export function extractUrls(value: string): string[] {
  return value
    .split(/[\s,]+/)
    .map((u) => u.trim())
    .filter((u) => /^https?:\/\//.test(u));
}

// Browser-side caller for /api/leads/*. Mirrors postCampaign(): never throws,
// returns the typed error code so the UI can map it to a vertical label.

export type LeadApiPath =
  | "set-stage"
  | "assign"
  | "event"
  | "reminder-set"
  | "reminder-done"
  | "set-priority";

export async function postLead(
  path: LeadApiPath,
  body: Record<string, unknown>,
): Promise<{ ok: boolean; error?: string }> {
  try {
    const res = await fetch(`/api/leads/${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string };
    return { ok: res.ok && data.ok === true, error: data.error };
  } catch {
    return { ok: false, error: "network" };
  }
}

export function errorText(errors: Record<string, string>, code: string | undefined): string {
  return (code && errors[code]) || errors.network || "Error";
}

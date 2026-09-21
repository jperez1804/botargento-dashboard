// Phone number → the same identifier WhatsApp uses (contact_wa_id: country
// code + number, digits only). A lead registered by hand is keyed by it, so
// when that person later writes to the bot the conversation lands on the SAME
// lead — no duplicates, no manual merge.
//
// Argentina is the default market: WhatsApp ids for AR mobiles are
// 54 9 <area> <number> (10 digits after "549"). We normalize the common ways
// people type them — including the local "15" mobile prefix ("011 15
// 4444-7777") — and anything else passes through as international digits.
// The form shows the normalized result before saving, so a wrong guess is
// visible instead of silent.

export type PhoneResult = { ok: true; waId: string } | { ok: false };

const MIN_DIGITS = 11;
const MAX_DIGITS = 15;

/**
 * An AR national number written with the "15" mobile prefix has 12 digits:
 * area (2–4) + "15" + number. Drops it, trying Buenos Aires ("11") first and
 * then 3- and 4-digit area codes. Returns null when there is no "15" to drop.
 */
function dropMobile15(national: string): string | null {
  if (national.length !== 12) return null;
  const areaLengths = national.startsWith("11") ? [2] : [3, 4];
  for (const n of areaLengths) {
    if (national.slice(n, n + 2) === "15") return national.slice(0, n) + national.slice(n + 2);
  }
  return null;
}

export function normalizeLeadPhone(raw: string): PhoneResult {
  const international = raw.trim().startsWith("+");
  let digits = raw.replace(/\D/g, "");
  if (digits.startsWith("00")) digits = digits.slice(2); // international prefix
  if (!international && digits.startsWith("0")) digits = digits.slice(1); // AR trunk "0"

  // The "15" mobile prefix, with or without the country code in front.
  const national =
    digits.startsWith("549") && digits.length === 15
      ? digits.slice(3)
      : digits.startsWith("54") && digits.length === 14
        ? digits.slice(2)
        : !international && digits.length === 12
          ? digits
          : null;
  const without15 = national ? dropMobile15(national) : null;
  if (without15) digits = without15;

  if (digits.length === 10) {
    // Area + number with no country code: an Argentine mobile.
    digits = `549${digits}`;
  } else if (digits.startsWith("54") && !digits.startsWith("549") && digits.length === 12) {
    // "54" + area + number: WhatsApp needs the mobile "9".
    digits = `549${digits.slice(2)}`;
  }

  if (digits.length < MIN_DIGITS || digits.length > MAX_DIGITS) return { ok: false };
  return { ok: true, waId: digits };
}

/** Readable form for the preview: "+54 9 1155550000" / "+34613793210". */
export function formatLeadPhone(waId: string): string {
  if (waId.startsWith("549") && waId.length === 13) return `+54 9 ${waId.slice(3)}`;
  return `+${waId}`;
}

/** Ҳар қандай киритилган матндан +998XXXXXXXXX кўринишини олиш */
export function normalizePhone(input: string): string | null {
  let digits = input.replace(/\D/g, "");
  if (digits.length === 9) digits = "998" + digits;
  if (digits.length !== 12 || !digits.startsWith("998")) return null;
  return "+" + digits;
}

/** +998901234567 → +998 (90) 123-45-67 */
export function formatPhone(p: string): string {
  const m = /^\+998(\d{2})(\d{3})(\d{2})(\d{2})$/.exec(p);
  return m ? `+998 (${m[1]}) ${m[2]}-${m[3]}-${m[4]}` : p;
}

/** Киритиш пайтида маска: +998 (90) 123-45-67 */
export function maskPhoneInput(raw: string): string {
  let d = raw.replace(/\D/g, "");
  if (d.startsWith("998")) d = d.slice(3);
  d = d.slice(0, 9);
  let out = "+998";
  if (d.length > 0) out += " (" + d.slice(0, 2);
  if (d.length >= 2) out += ")";
  if (d.length > 2) out += " " + d.slice(2, 5);
  if (d.length > 5) out += "-" + d.slice(5, 7);
  if (d.length > 7) out += "-" + d.slice(7, 9);
  return out;
}

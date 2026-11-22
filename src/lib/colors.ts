/** Бронлар учун 12 рангли палитра (оқ матн билан контраст ≥ 4.5:1) */
export const PALETTE = [
  "#1F5FA8", "#0E7C66", "#B3412E", "#7A4CB0", "#A8650A", "#2F7D32",
  "#C2185B", "#00727F", "#5D4AA8", "#8D5524", "#3B6E9E", "#9C2F5A",
];

export function hashString(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export function bookingColor(b: { color: string | null; organization: string }): string {
  if (b.color && /^#[0-9a-f]{6}$/i.test(b.color)) return b.color;
  return PALETTE[hashString(b.organization.trim().toLowerCase()) % PALETTE.length];
}

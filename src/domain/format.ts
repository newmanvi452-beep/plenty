// Formatting and quantity helpers, ported from the Plenty prototype.
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const WD = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
export const THANKSGIVING = new Date(2026, 10, 26);
const PLURAL: Record<string, string> = { cup: "cups", can: "cans", bag: "bags", box: "boxes", jar: "jars", bunch: "bunches", stick: "sticks", pint: "pints", bottle: "bottles", sheet: "sheets", packet: "packets", clove: "cloves", head: "heads", pack: "packs", gallon: "gallons", quart: "quarts" };

export function tgDay(daysBefore: number): string {
  const d = new Date(THANKSGIVING.getFullYear(), THANKSGIVING.getMonth(), THANKSGIVING.getDate() - daysBefore);
  return WD[d.getDay()] + ", " + MONTHS[d.getMonth()] + " " + d.getDate();
}
export function clock(m: number): string {
  const x = ((m % 1440) + 1440) % 1440; const h = Math.floor(x / 60), mm = x % 60;
  const ap = h >= 12 ? "PM" : "AM"; let h12 = h % 12; if (h12 === 0) h12 = 12;
  return h12 + ":" + (mm < 10 ? "0" : "") + mm + " " + ap;
}
export function hourLabel(m: number): string {
  const h = Math.floor(m / 60); const ap = h >= 12 ? "PM" : "AM"; let h12 = h % 12; if (h12 === 0) h12 = 12;
  return h === 12 ? "Noon" : h12 + " " + ap;
}
export function frac(x: number): string {
  let w = Math.floor(x + 1e-9); let q = Math.round((x - w) * 4);
  if (q === 4) { w++; q = 0; }
  const f = ["", "¼", "½", "¾"][q];
  if (w === 0) return f || "0";
  return f ? w + " " + f : "" + w;
}
export const ceilTo = (x: number, step: number) => Math.ceil(x / step - 1e-9) * step;
export function unitStr(q: number, u: string): string { if (!u) return ""; if (q > 1 && PLURAL[u]) return PLURAL[u]; return u; }
export function qtyStr(q: number, u: string): string { const n = frac(q); const us = unitStr(q, u); return us ? n + " " + us : n; }
export function hm(m: number): string { const h = Math.floor(m / 60), r = m % 60; return h + " hr" + (r ? " " + r + " min" : ""); }
export const round5 = (m: number) => Math.round(m / 5) * 5;

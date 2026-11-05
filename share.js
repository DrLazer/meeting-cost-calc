// Meeting links are base64url-encoded JSON in the URL hash (#m=...).
// A finished meeting also carries r: { c: cost in pence, t: elapsed ms, s: start time (epoch ms) }.
export function encode(obj) {
  const bytes = new TextEncoder().encode(JSON.stringify(obj));
  let bin = "";
  bytes.forEach((b) => (bin += String.fromCharCode(b)));
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
export function decode(str) {
  try {
    const bin = atob(str.replace(/-/g, "+").replace(/_/g, "/"));
    return JSON.parse(new TextDecoder().decode(Uint8Array.from(bin, (c) => c.charCodeAt(0))));
  } catch {}
  return null;
}
export function readMeetingHash() {
  const m = location.hash.match(/^#m=(.+)$/);
  if (!m) return null;
  const s = decode(decodeURIComponent(m[1]));
  return s && Array.isArray(s.rows) ? s : null;
}

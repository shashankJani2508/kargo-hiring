export const SESSION_COOKIE = "kargo_session";

export function authEnabled() {
  return !!process.env.DASHBOARD_PASSWORD;
}

export async function sessionToken() {
  const secret = process.env.AUTH_SECRET || "kargo-dev-secret";
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(`kargo:${process.env.DASHBOARD_PASSWORD ?? ""}`));
  return Array.from(new Uint8Array(sig), (b) => b.toString(16).padStart(2, "0")).join("");
}

export async function isValidSession(value: string | undefined) {
  if (!authEnabled()) return true;
  if (!value) return false;
  const expected = await sessionToken();
  if (value.length !== expected.length) return false;
  let diff = 0;
  for (let i = 0; i < value.length; i++) diff |= value.charCodeAt(i) ^ expected.charCodeAt(i);
  return diff === 0;
}

import crypto from "node:crypto";

const secret = process.env.NEXTAUTH_SECRET || "development-secret-change-me-in-production-please";

function base64url(value) {
  return Buffer.from(value).toString("base64url");
}

function parseBase64url(value) {
  return Buffer.from(value, "base64url").toString("utf8");
}

export function signRealtimeToken(payload) {
  const body = base64url(JSON.stringify({ ...payload, exp: Date.now() + 1000 * 60 * 60 * 12 }));
  const signature = crypto.createHmac("sha256", secret).update(body).digest("base64url");
  return `${body}.${signature}`;
}

export function verifyRealtimeToken(token) {
  if (typeof token !== "string" || !token.includes(".")) return null;
  const [body, signature] = token.split(".");
  const expected = crypto.createHmac("sha256", secret).update(body).digest("base64url");
  if (signature.length !== expected.length) return null;
  if (!crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) return null;
  try {
    const payload = JSON.parse(parseBase64url(body));
    if (!payload.exp || payload.exp < Date.now()) return null;
    return payload;
  } catch {
    return null;
  }
}

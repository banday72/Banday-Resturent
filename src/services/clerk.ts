import { HttpError } from "@/lib/session";

const CLERK_API = "https://api.clerk.com/v1";

function clerkSecret() {
  const key = process.env.CLERK_SECRET_KEY;
  if (!key) throw new HttpError(503, "Demo email OTP is not configured. Add CLERK_SECRET_KEY.");
  return key;
}

async function clerkRequest<T>(path: string, init: RequestInit = {}) {
  const response = await fetch(`${CLERK_API}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${clerkSecret()}`,
      "Content-Type": "application/json",
      ...(init.headers ?? {}),
    },
    cache: "no-store",
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message = payload?.errors?.[0]?.message ?? payload?.message ?? "Clerk request failed";
    throw new HttpError(response.status >= 500 ? 503 : 400, message);
  }
  return payload as T;
}

type ClerkUserPayload = {
  id: string;
  email_addresses?: Array<{ id: string; email_address: string }>;
};

type ClerkVerificationPayload = {
  id?: string;
  verification_id?: string;
  status?: string;
  verification?: { id?: string; status?: string };
};

export async function createClerkDemoUser(input: { externalId: string; email: string; name: string }) {
  const payload = await clerkRequest<ClerkUserPayload>("/users", {
    method: "POST",
    body: JSON.stringify({
      external_id: input.externalId,
      first_name: input.name,
      email_address: [input.email],
      email_address_identification_status: ["reserved"],
      skip_password_requirement: true,
      skip_password_checks: true,
      skip_restriction_checks: true,
    }),
  });
  const emailAddressId = payload.email_addresses?.[0]?.id;
  if (!emailAddressId) throw new HttpError(500, "Clerk user was created without an email address");
  return { clerkUserId: payload.id, emailAddressId };
}

export async function prepareClerkEmailOtp(emailAddressId: string) {
  const payload = await clerkRequest<ClerkVerificationPayload>(`/email_addresses/${encodeURIComponent(emailAddressId)}/prepare_verification`, {
    method: "POST",
    body: "{}",
  });
  const verificationId = payload.verification_id ?? payload.verification?.id ?? payload.id;
  if (!verificationId) throw new HttpError(502, "Clerk did not return a verification id");
  return verificationId;
}

export async function attemptClerkEmailOtp(emailAddressId: string, verificationId: string, code: string) {
  const payload = await clerkRequest<ClerkVerificationPayload>(`/email_addresses/${encodeURIComponent(emailAddressId)}/attempt_verification`, {
    method: "POST",
    body: JSON.stringify({ verification_id: verificationId, code }),
  });
  const status = payload.status ?? payload.verification?.status;
  if (status && status !== "verified") throw new HttpError(400, "Invalid or expired demo code");
}

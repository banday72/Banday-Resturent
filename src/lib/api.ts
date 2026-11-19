import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { HttpError } from "@/lib/session";

export function ok<T>(data: T, status = 200) {
  return NextResponse.json({ ok: true, data }, { status });
}

export function fail(status: number, message: string, details?: unknown) {
  return NextResponse.json({ ok: false, error: message, details }, { status });
}

export async function handleRoute(handler: () => Promise<Response>) {
  try {
    return await handler();
  } catch (error) {
    if (error instanceof HttpError) return fail(error.status, error.message);
    if (error instanceof ZodError) {
      return fail(400, "Validation failed", error.issues.map((issue) => ({ path: issue.path.join("."), message: issue.message })));
    }
    console.error(error);
    return fail(500, "Internal server error");
  }
}

export async function readJson(request: Request) {
  try {
    return await request.json();
  } catch {
    throw new HttpError(400, "Invalid JSON body");
  }
}

export function getSearchParam(request: Request, key: string) {
  return new URL(request.url).searchParams.get(key);
}

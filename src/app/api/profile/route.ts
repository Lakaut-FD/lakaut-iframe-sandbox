import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions, isAllowedEmail } from "@/lib/auth";
import { ProfileInputSchema } from "@/lib/profile-schema";
import { deleteProfile, getProfile, setProfile } from "@/lib/kv";
import type { UserProfile } from "@/types/lakaut";

async function authorizedEmail(): Promise<string | null> {
  const session = await getServerSession(authOptions);
  const email = session?.user?.email ?? "";
  if (!isAllowedEmail(email)) return null;
  return email;
}

export async function GET() {
  const email = await authorizedEmail();
  if (!email) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const profile = await getProfile(email);
  return NextResponse.json(profile);
}

export async function POST(req: Request) {
  const email = await authorizedEmail();
  if (!email) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  // Forzar email del session (no del body)
  const candidate = { ...(body as Record<string, unknown>), email };
  const parsed = ProfileInputSchema.safeParse(candidate);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const now = new Date().toISOString();
  const existing = await getProfile(email);
  const profile: UserProfile = {
    ...parsed.data,
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
  };

  await setProfile(profile);
  return NextResponse.json(profile);
}

export async function DELETE() {
  const email = await authorizedEmail();
  if (!email) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  await deleteProfile(email);
  return NextResponse.json({ deleted: true });
}

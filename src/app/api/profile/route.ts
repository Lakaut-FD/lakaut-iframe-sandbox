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
  const sessionEmail = await authorizedEmail();
  if (!sessionEmail) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const profile = await getProfile(sessionEmail);
  return NextResponse.json(profile);
}

export async function POST(req: Request) {
  const sessionEmail = await authorizedEmail();
  if (!sessionEmail) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  // El email del body PUEDE ser distinto del session email (editable por el user
  // para mandar al iframe el email de un registro real con cert emitido).
  // La KV key sigue siendo el session email — identidad estable del user en sandbox.
  const parsed = ProfileInputSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const now = new Date().toISOString();
  const existing = await getProfile(sessionEmail);
  const profile: UserProfile = {
    ...parsed.data,
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
  };

  await setProfile(sessionEmail, profile);
  return NextResponse.json(profile);
}

export async function DELETE() {
  const sessionEmail = await authorizedEmail();
  if (!sessionEmail) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  await deleteProfile(sessionEmail);
  return NextResponse.json({ deleted: true });
}

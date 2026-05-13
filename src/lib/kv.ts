import { kv } from "@vercel/kv";
import type { UserProfile } from "@/types/lakaut";

/**
 * KV key = email del login Google (identidad estable del user en sandbox).
 * El campo `profile.email` puede ser distinto del session email (editable por el
 * user para mandar al iframe el email de otro registro con cert válido).
 */
function key(sessionEmail: string): string {
  return `profile:${sessionEmail.toLowerCase()}`;
}

export async function getProfile(sessionEmail: string): Promise<UserProfile | null> {
  const value = await kv.get<UserProfile>(key(sessionEmail));
  return value ?? null;
}

export async function setProfile(sessionEmail: string, profile: UserProfile): Promise<void> {
  await kv.set(key(sessionEmail), profile);
}

export async function deleteProfile(sessionEmail: string): Promise<void> {
  await kv.del(key(sessionEmail));
}

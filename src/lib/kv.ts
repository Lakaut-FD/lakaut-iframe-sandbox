import { kv } from "@vercel/kv";
import type { UserProfile } from "@/types/lakaut";

function key(email: string): string {
  return `profile:${email.toLowerCase()}`;
}

export async function getProfile(email: string): Promise<UserProfile | null> {
  const value = await kv.get<UserProfile>(key(email));
  return value ?? null;
}

export async function setProfile(profile: UserProfile): Promise<void> {
  const normalized: UserProfile = {
    ...profile,
    email: profile.email.toLowerCase(),
  };
  await kv.set(key(normalized.email), normalized);
}

export async function deleteProfile(email: string): Promise<void> {
  await kv.del(key(email));
}

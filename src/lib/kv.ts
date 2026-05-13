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
  await kv.set(key(profile.email), profile);
}

export async function deleteProfile(email: string): Promise<void> {
  await kv.del(key(email));
}

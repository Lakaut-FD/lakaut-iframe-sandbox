import type { SessionResponse } from "@/types/lakaut";

interface CreateSessionParams {
  integratorId: string;
  apiKey: string;
}

/**
 * Llama a web2 prod para crear un sessionToken. Solo server-side.
 *
 * Endpoint: POST {WEB2_BASE_URL}/api/integration/session/new?id={integratorId}
 * Header:   X-API-Key: {apiKey}
 *
 * web2 source: `lakautac-web2/src/app/api/integration/session/new/route.ts`
 * service:     `lakautac-web2/src/server/services/iframeService.ts` (CreateSession)
 */
export async function createSession({ integratorId, apiKey }: CreateSessionParams): Promise<SessionResponse> {
  const base = process.env.WEB2_BASE_URL;
  if (!base) throw new Error("WEB2_BASE_URL env var no configurada");
  if (!integratorId) throw new Error("integratorId requerido");
  if (!apiKey) throw new Error("apiKey requerido");

  const url = `${base}/api/integration/session/new?id=${encodeURIComponent(integratorId)}`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "X-API-Key": apiKey },
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`web2 createSession failed: ${res.status} ${text}`);
  }

  return (await res.json()) as SessionResponse;
}

export type Gender = "M" | "F" | "X";

/**
 * UserData según docu oficial del iframe.
 * Required: email, gender, phone. Either dni o cuil (al menos uno).
 * Optional: dni, cuil, name, address.
 */
export interface UserData {
  dni?: string;
  cuil?: string;
  email: string;
  gender: Gender;
  phone: string;
  name?: string;
  address?: string;
}

/**
 * Profile persistido en Vercel KV por usuario (key: `profile:<email>`).
 * El sandbox lo crea durante onboarding y lo usa para llenar el `userData`
 * que se manda al iframe en cada session.
 */
export interface UserProfile {
  email: string;        // mismo del Google login; también es la KV key
  name?: string;
  dni?: string;
  cuil?: string;
  gender: Gender;
  phone: string;
  createdAt: string;    // ISO 8601
  updatedAt: string;
}

export interface AutoLoadFile {
  fileName: string;
  mime: string;
  base64: string;
}

export type Mode = "server" | "client";

export interface EventLog {
  timestamp: number;
  type: string;
  payload?: unknown;
  origin?: string;
  via?: "server" | "client";
  status?: number;
  corsError?: boolean;
}

export interface SignedDoc {
  signedDocId: string;
  document?: { mime?: string };
  mime?: string;
  delivery?: {
    mode: "binary" | "url";
    fileBase64?: string;
    url?: string;
  };
}

/**
 * Response de web2 `/api/integration/session/new`.
 * El campo se llama `tokenSession` (confirmado contra lakautac-web2).
 */
export interface SessionResponse {
  tokenSession: string;
  validUntil?: string;
}

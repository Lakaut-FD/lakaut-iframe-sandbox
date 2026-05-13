export type Gender = "M" | "F" | "X";

/**
 * UserData que se envía al iframe en lakaut.init.
 * El iframe valida persona física: requiere DNI (no CUIL/CUIT).
 */
export interface UserData {
  dni: string;
  email: string;
  gender: Gender;
  phone: string;
  name?: string;
}

/**
 * Profile persistido en Vercel KV por usuario (key: `profile:<email>`).
 */
export interface UserProfile {
  email: string;        // mismo del Google login; también es la KV key
  name?: string;
  dni: string;
  gender: Gender;
  phone: string;
  createdAt: string;
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
 */
export interface SessionResponse {
  tokenSession: string;
  validUntil?: string;
}

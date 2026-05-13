export type Gender = "M" | "F" | "X";

/**
 * UserData según docu oficial:
 * https://lakaut-fd.github.io/documentacion-docusaurus/docs/guias-practicas/firma-iframe/referencia-mensajes
 *
 * Required: email, gender, phone. Either dni o cuil (o ambos).
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
 * El campo se llama `tokenSession` (no sessionToken) — confirmado contra el código de
 * lakautac-web2 (iFrameSessionInfo) y la docu oficial.
 */
export interface SessionResponse {
  tokenSession: string;
  validUntil?: string;
}

export const EMPTY_USER_DATA: UserData = {
  dni: "",
  email: "",
  gender: "M",
  phone: "",
  name: "",
};

export const MOCK_USER_DATA: UserData = {
  dni: "30000000",
  cuil: "20-30000000-9",
  email: "sandbox@lakaut.com.ar",
  gender: "M",
  phone: "1111111111",
  name: "Sandbox User",
  address: "Av. de Mayo 1234, CABA",
};

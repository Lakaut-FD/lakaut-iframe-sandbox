export type Gender = "M" | "F" | "X";

export interface UserData {
  dni: string;
  email: string;
  gender: Gender;
  phone: string;
  name: string;
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

export interface SessionResponse {
  /** JWT que el iframe consume como sessionToken */
  sessionToken: string;
  /** Eco/extra metadata (opcional, viene de web2) */
  [key: string]: unknown;
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
  email: "sandbox@lakaut.com.ar",
  gender: "M",
  phone: "1111111111",
  name: "Sandbox User",
};

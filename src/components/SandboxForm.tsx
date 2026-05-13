"use client";

import { useState } from "react";
import { ModeToggle } from "./ModeToggle";
import { UserDataInputs } from "./UserDataInputs";
import { fileToBase64 } from "@/lib/pdf";
import type { AutoLoadFile, EventLog, Mode, SessionResponse, UserData } from "@/types/lakaut";
import { MOCK_USER_DATA } from "@/types/lakaut";

const WEB2_BASE_URL = process.env.NEXT_PUBLIC_WEB2_BASE_URL ?? "";

interface SubmittedSession {
  sessionToken: string;
  userData: UserData;
  file?: AutoLoadFile;
}

interface Props {
  onSession: (s: SubmittedSession) => void;
  onLog: (e: EventLog) => void;
}

export function SandboxForm({ onSession, onLog }: Props) {
  const [mode, setMode] = useState<Mode>("server");
  const [integratorId, setIntegratorId] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [userData, setUserData] = useState<UserData>(MOCK_USER_DATA);
  const [pdf, setPdf] = useState<AutoLoadFile | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleFile = async (file: File | null) => {
    if (!file) {
      setPdf(null);
      return;
    }
    if (file.type !== "application/pdf") {
      setError("El archivo debe ser PDF");
      return;
    }
    setError(null);
    const base64 = await fileToBase64(file);
    setPdf({ fileName: file.name, mime: file.type, base64 });
  };

  const submit = async () => {
    setError(null);
    setSubmitting(true);
    try {
      if (mode === "client" && !apiKey) {
        throw new Error("API Key es requerida en Client mode");
      }

      let session: SessionResponse;

      if (mode === "server") {
        const res = await fetch("/api/sessions", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            integratorId: integratorId || undefined,
            apiKey: apiKey || undefined,
          }),
        });
        onLog({ timestamp: Date.now(), type: "sandbox.session.created", via: "server", status: res.status });
        if (!res.ok) {
          const errBody = await res.json().catch(() => ({}));
          throw new Error((errBody as { error?: string }).error ?? `HTTP ${res.status}`);
        }
        session = (await res.json()) as SessionResponse;
      } else {
        if (!WEB2_BASE_URL) throw new Error("NEXT_PUBLIC_WEB2_BASE_URL no configurada");
        if (!integratorId) throw new Error("integratorId es requerido en Client mode");
        const url = `${WEB2_BASE_URL}/api/integration/session/new?id=${encodeURIComponent(integratorId)}`;
        let res: Response;
        try {
          res = await fetch(url, {
            method: "POST",
            headers: { "X-API-Key": apiKey, "Content-Type": "application/json" },
          });
        } catch (e) {
          onLog({
            timestamp: Date.now(),
            type: "sandbox.session.created",
            via: "client",
            corsError: true,
            payload: { error: e instanceof Error ? e.message : String(e) },
          });
          throw new Error("Fetch falló — probable CORS o network. Ver console.");
        }
        onLog({ timestamp: Date.now(), type: "sandbox.session.created", via: "client", status: res.status });
        if (!res.ok) {
          const errText = await res.text().catch(() => "");
          throw new Error(`web2 ${res.status}: ${errText}`);
        }
        session = (await res.json()) as SessionResponse;
      }

      if (!session.sessionToken) {
        throw new Error("Respuesta sin sessionToken — inspeccionar EventConsole");
      }

      onSession({ sessionToken: session.sessionToken, userData, file: pdf ?? undefined });
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-4 rounded border border-gray-200 p-4">
      <div className="flex items-center justify-between">
        <h2 className="text-base font-semibold">Config</h2>
        <ModeToggle value={mode} onChange={setMode} />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <label className="text-xs">Integrator ID {mode === "server" && <span className="text-gray-400">(opc — usa env)</span>}
          <input
            type="text"
            value={integratorId}
            onChange={(e) => setIntegratorId(e.target.value)}
            placeholder="default desde env (Server mode)"
            className="mt-1 block w-full rounded border border-gray-300 px-2 py-1 text-sm"
          />
        </label>
        <label className="text-xs">API Key {mode === "client" && <span className="text-red-600">(requerida)</span>}
          <input
            type="password"
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            placeholder={mode === "server" ? "default desde env" : "X-API-Key obligatoria"}
            className="mt-1 block w-full rounded border border-gray-300 px-2 py-1 text-sm"
          />
        </label>
      </div>

      <UserDataInputs value={userData} onChange={setUserData} />

      <label className="block text-xs">PDF
        <input
          type="file"
          accept="application/pdf"
          onChange={(e) => handleFile(e.target.files?.[0] ?? null)}
          className="mt-1 block w-full text-sm"
        />
      </label>
      {pdf && <p className="text-xs text-gray-600">Loaded: {pdf.fileName}</p>}

      {error && <p className="text-sm text-red-600">{error}</p>}

      <button
        type="button"
        onClick={submit}
        disabled={submitting}
        className="w-full rounded bg-indigo-600 px-3 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:bg-indigo-300"
      >
        {submitting ? "Creating session..." : "Start session"}
      </button>
    </div>
  );
}

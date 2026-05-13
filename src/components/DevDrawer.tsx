"use client";

import { useState } from "react";
import { EventConsole } from "./EventConsole";
import { ModeToggle } from "./ModeToggle";
import type { EventLog, Mode, SessionResponse } from "@/types/lakaut";

interface Props {
  events: EventLog[];
  onClearEvents: () => void;
  onReloadWithOverrides: (token: string) => void;
  onLog: (e: EventLog) => void;
  onClose: () => void;
}

const WEB2_BASE_URL = process.env.NEXT_PUBLIC_WEB2_BASE_URL ?? "";

export function DevDrawer({ events, onClearEvents, onReloadWithOverrides, onLog, onClose }: Props) {
  const [mode, setMode] = useState<Mode>("server");
  const [integratorId, setIntegratorId] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const reload = async () => {
    setError(null);
    setBusy(true);
    try {
      if (mode === "client" && (!integratorId || !apiKey)) {
        throw new Error("Client mode: integratorId y apiKey requeridos");
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
          const body = await res.json().catch(() => ({}));
          throw new Error((body as { error?: string }).error ?? `HTTP ${res.status}`);
        }
        session = (await res.json()) as SessionResponse;
      } else {
        if (!WEB2_BASE_URL) throw new Error("NEXT_PUBLIC_WEB2_BASE_URL no configurada");
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
          throw new Error("Fetch falló — probable CORS o network");
        }
        onLog({ timestamp: Date.now(), type: "sandbox.session.created", via: "client", status: res.status });
        if (!res.ok) {
          const text = await res.text().catch(() => "");
          throw new Error(`web2 ${res.status}: ${text}`);
        }
        session = (await res.json()) as SessionResponse;
      }
      if (!session.tokenSession) throw new Error("Respuesta sin tokenSession");
      onReloadWithOverrides(session.tokenSession);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <aside className="fixed inset-y-0 right-0 z-40 flex w-96 flex-col gap-3 overflow-y-auto border-l border-gray-300 bg-white p-4 shadow-xl">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold">⚙ Dev tools</h2>
        <button onClick={onClose} className="text-xs text-gray-500 hover:text-gray-900" aria-label="Close">✕</button>
      </div>

      <section className="space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium">Mode</span>
          <ModeToggle value={mode} onChange={setMode} />
        </div>
        <label className="block text-xs">
          Integrator ID
          <input
            type="text"
            value={integratorId}
            onChange={(e) => setIntegratorId(e.target.value)}
            placeholder={mode === "server" ? "default desde env" : "obligatorio"}
            className="mt-1 block w-full rounded border border-gray-300 px-2 py-1 text-xs"
          />
        </label>
        <label className="block text-xs">
          API Key
          <input
            type="password"
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            placeholder={mode === "server" ? "default desde env" : "obligatorio"}
            className="mt-1 block w-full rounded border border-gray-300 px-2 py-1 text-xs"
          />
        </label>
        {error && <p className="text-xs text-red-600">{error}</p>}
        <button
          type="button"
          onClick={reload}
          disabled={busy}
          className="w-full rounded bg-indigo-600 px-3 py-2 text-xs font-medium text-white hover:bg-indigo-700 disabled:bg-indigo-300"
        >
          {busy ? "Creando session..." : "Recargar con overrides"}
        </button>
      </section>

      <hr className="border-gray-200" />

      <EventConsole events={events} onClear={onClearEvents} />
    </aside>
  );
}

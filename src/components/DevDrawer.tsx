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
const inputClass =
  "mt-1 block w-full rounded-md border border-zinc-300 bg-white px-2.5 py-1.5 font-mono text-xs text-zinc-900 placeholder:text-zinc-400 focus:border-zinc-900 focus:outline-none focus:ring-1 focus:ring-zinc-900";

export function DevDrawer({
  events,
  onClearEvents,
  onReloadWithOverrides,
  onLog,
  onClose,
}: Props) {
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
        onLog({
          timestamp: Date.now(),
          type: "sandbox.session.created",
          via: "server",
          status: res.status,
        });
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
        onLog({
          timestamp: Date.now(),
          type: "sandbox.session.created",
          via: "client",
          status: res.status,
        });
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
    <aside className="fixed inset-y-0 right-0 z-40 flex w-[400px] flex-col gap-5 overflow-y-auto border-l border-zinc-200 bg-white p-5 shadow-2xl">
      <div className="flex items-center justify-between border-b border-zinc-200 pb-3">
        <h2 className="text-sm font-semibold text-zinc-900">Dev tools</h2>
        <button
          onClick={onClose}
          className="rounded-md p-1 text-zinc-500 transition-colors hover:bg-zinc-100 hover:text-zinc-900"
          aria-label="Cerrar"
        >
          ✕
        </button>
      </div>

      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium uppercase tracking-wide text-zinc-600">Mode</span>
          <ModeToggle value={mode} onChange={setMode} />
        </div>

        <div>
          <label className="block text-xs font-medium text-zinc-700">Integrator ID</label>
          <input
            type="text"
            value={integratorId}
            onChange={(e) => setIntegratorId(e.target.value)}
            placeholder={mode === "server" ? "default desde env" : "obligatorio"}
            className={inputClass}
          />
        </div>

        <div>
          <label className="block text-xs font-medium text-zinc-700">API Key</label>
          <input
            type="password"
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            placeholder={mode === "server" ? "default desde env" : "obligatorio"}
            className={inputClass}
          />
        </div>

        {error && (
          <p className="rounded-md border border-red-200 bg-red-50 px-2 py-1.5 text-xs text-red-700">
            {error}
          </p>
        )}

        <button
          type="button"
          onClick={reload}
          disabled={busy}
          className="w-full rounded-md bg-zinc-900 px-3 py-2 text-xs font-medium text-white transition-colors hover:bg-zinc-800 disabled:cursor-not-allowed disabled:bg-zinc-400"
        >
          {busy ? "Creando session..." : "Recargar con overrides"}
        </button>
      </section>

      <EventConsole events={events} onClear={onClearEvents} />
    </aside>
  );
}

"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useSession } from "next-auth/react";
import { SandboxForm } from "@/components/SandboxForm";
import { LakautEmbed } from "@/components/LakautEmbed";
import { EventConsole } from "@/components/EventConsole";
import { SignOutButton } from "@/components/SignOutButton";
import { downloadBase64 } from "@/lib/pdf";
import type { AutoLoadFile, EventLog, SessionResponse, SignedDoc, UserData } from "@/types/lakaut";
import { MOCK_USER_DATA } from "@/types/lakaut";

interface ActiveSession {
  sessionToken: string;
  userData: UserData;
  file?: AutoLoadFile;
}

export default function Home() {
  const { data: session, status } = useSession();
  const [active, setActive] = useState<ActiveSession | null>(null);
  const [events, setEvents] = useState<EventLog[]>([]);
  const [signed, setSigned] = useState<SignedDoc | null>(null);
  const autoStartedRef = useRef(false);

  const logEvent = useCallback((e: EventLog) => {
    setEvents((prev) => [...prev, e]);
  }, []);

  const handleEvent = useCallback(
    ({ type, payload, origin }: { type: string; payload?: unknown; origin?: string }) => {
      logEvent({ timestamp: Date.now(), type, payload, origin });
    },
    [logEvent]
  );

  const handleSignCompleted = useCallback((payload: unknown) => {
    setSigned(payload as SignedDoc);
  }, []);

  const handleSession = useCallback((s: ActiveSession) => {
    setActive(s);
    setSigned(null);
  }, []);

  // Auto-arrancar session al cargar la página (server mode con defaults de env + MOCK_USER_DATA).
  // El usuario puede sobreescribir después via SandboxForm.
  useEffect(() => {
    if (status !== "authenticated") return;
    if (autoStartedRef.current) return;
    autoStartedRef.current = true;

    (async () => {
      try {
        const res = await fetch("/api/sessions", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({}),
        });
        logEvent({
          timestamp: Date.now(),
          type: "sandbox.session.created",
          via: "server",
          status: res.status,
          payload: { auto: true },
        });
        if (!res.ok) {
          const errBody = await res.json().catch(() => ({}));
          logEvent({
            timestamp: Date.now(),
            type: "sandbox.autostart.failed",
            payload: { error: (errBody as { error?: string }).error ?? `HTTP ${res.status}` },
          });
          return;
        }
        const data = (await res.json()) as SessionResponse;
        if (!data.tokenSession) {
          logEvent({
            timestamp: Date.now(),
            type: "sandbox.autostart.failed",
            payload: { error: "Respuesta sin tokenSession", received: data },
          });
          return;
        }
        setActive({ sessionToken: data.tokenSession, userData: MOCK_USER_DATA });
      } catch (e) {
        logEvent({
          timestamp: Date.now(),
          type: "sandbox.autostart.failed",
          payload: { error: e instanceof Error ? e.message : String(e) },
        });
      }
    })();
  }, [status, logEvent]);

  const handleDownload = useCallback(() => {
    if (!signed) return;
    if (signed.delivery?.mode === "binary" && signed.delivery.fileBase64) {
      const mime = signed.document?.mime ?? signed.mime ?? "application/pdf";
      downloadBase64(signed.delivery.fileBase64, `signed-${signed.signedDocId}.pdf`, mime);
      logEvent({ timestamp: Date.now(), type: "sandbox.download.triggered", payload: { mode: "binary" } });
    } else if (signed.delivery?.mode === "url" && signed.delivery.url) {
      window.open(signed.delivery.url, "_blank");
      logEvent({ timestamp: Date.now(), type: "sandbox.download.triggered", payload: { mode: "url" } });
    }
  }, [signed, logEvent]);

  return (
    <main className="mx-auto max-w-7xl px-4 py-6">
      <header className="mb-6 flex items-center justify-between">
        <h1 className="text-xl font-semibold">Lakaut Iframe Sandbox</h1>
        <div className="flex items-center gap-4 text-sm text-gray-600">
          <span>{session?.user?.email}</span>
          <SignOutButton />
        </div>
      </header>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <section className="lg:col-span-1">
          <SandboxForm onSession={handleSession} onLog={logEvent} />
          {signed && (
            <button
              type="button"
              onClick={handleDownload}
              className="mt-3 w-full rounded bg-emerald-600 px-3 py-2 text-sm font-medium text-white hover:bg-emerald-700"
            >
              Download signed PDF
            </button>
          )}
        </section>

        <section className="lg:col-span-2 space-y-4">
          {active ? (
            <LakautEmbed
              sessionToken={active.sessionToken}
              userData={active.userData}
              autoLoadFile={active.file}
              onEvent={handleEvent}
              onSignCompleted={handleSignCompleted}
            />
          ) : (
            <div className="flex h-[400px] items-center justify-center rounded border border-dashed border-gray-300 text-sm text-gray-500">
              {status === "authenticated" ? "Cargando session..." : "Start a session to embed the iframe."}
            </div>
          )}

          <EventConsole events={events} onClear={() => setEvents([])} />
        </section>
      </div>
    </main>
  );
}

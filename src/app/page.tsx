"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import useSWR from "swr";
import { Header } from "@/components/Header";
import { ProdBanner } from "@/components/ProdBanner";
import { LakautEmbed } from "@/components/LakautEmbed";
import { DevDrawer } from "@/components/DevDrawer";
import { downloadBase64, fileToBase64 } from "@/lib/pdf";
import type {
  AutoLoadFile,
  EventLog,
  SessionResponse,
  SignedDoc,
  UserData,
  UserProfile,
} from "@/types/lakaut";

interface ActiveSession {
  sessionToken: string;
  userData: UserData;
}

function profileToUserData(profile: UserProfile): UserData {
  return {
    email: profile.email,
    name: profile.name,
    dni: profile.dni,
    gender: profile.gender,
    phone: profile.phone,
  };
}

export default function Home() {
  const router = useRouter();
  const { status } = useSession();
  const { data: profile, isLoading: profileLoading } = useSWR<UserProfile | null>("/api/profile");
  const [active, setActive] = useState<ActiveSession | null>(null);
  const [pdf, setPdf] = useState<AutoLoadFile | null>(null);
  const [pdfError, setPdfError] = useState<string | null>(null);
  const [events, setEvents] = useState<EventLog[]>([]);
  const [signed, setSigned] = useState<SignedDoc | null>(null);
  const [devMode, setDevMode] = useState(false);
  const autoStartedRef = useRef(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    setDevMode(window.localStorage.getItem("sandbox.devMode") === "true");
  }, []);

  const toggleDevMode = useCallback(() => {
    setDevMode((prev) => {
      const next = !prev;
      if (typeof window !== "undefined") {
        window.localStorage.setItem("sandbox.devMode", String(next));
      }
      return next;
    });
  }, []);

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

  // Redirect a onboarding si no hay profile
  useEffect(() => {
    if (status !== "authenticated") return;
    if (profileLoading) return;
    if (!profile) router.replace("/onboarding");
  }, [status, profile, profileLoading, router]);

  // Auto-arrancar session
  useEffect(() => {
    if (status !== "authenticated") return;
    if (!profile) return;
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
          const body = await res.json().catch(() => ({}));
          logEvent({
            timestamp: Date.now(),
            type: "sandbox.autostart.failed",
            payload: { error: (body as { error?: string }).error ?? `HTTP ${res.status}` },
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
        setActive({ sessionToken: data.tokenSession, userData: profileToUserData(profile) });
      } catch (e) {
        logEvent({
          timestamp: Date.now(),
          type: "sandbox.autostart.failed",
          payload: { error: e instanceof Error ? e.message : String(e) },
        });
      }
    })();
  }, [status, profile, logEvent]);

  const handleReloadWithOverrides = useCallback(
    (token: string) => {
      if (!profile) return;
      setActive({ sessionToken: token, userData: profileToUserData(profile) });
      setSigned(null);
    },
    [profile]
  );

  const handlePdfChange = useCallback(async (file: File | null) => {
    setPdfError(null);
    if (!file) {
      setPdf(null);
      return;
    }
    if (file.type !== "application/pdf") {
      setPdfError("El archivo debe ser PDF.");
      return;
    }
    try {
      const base64 = await fileToBase64(file);
      setPdf({ fileName: file.name, mime: file.type, base64 });
    } catch (e) {
      setPdfError(e instanceof Error ? e.message : "Error al leer el archivo");
    }
  }, []);

  const handleDownload = useCallback(() => {
    if (!signed) return;
    if (signed.delivery?.mode === "binary" && signed.delivery.fileBase64) {
      const mime = signed.document?.mime ?? signed.mime ?? "application/pdf";
      downloadBase64(signed.delivery.fileBase64, `signed-${signed.signedDocId}.pdf`, mime);
      logEvent({
        timestamp: Date.now(),
        type: "sandbox.download.triggered",
        payload: { mode: "binary" },
      });
    } else if (signed.delivery?.mode === "url" && signed.delivery.url) {
      window.open(signed.delivery.url, "_blank");
      logEvent({
        timestamp: Date.now(),
        type: "sandbox.download.triggered",
        payload: { mode: "url" },
      });
    }
  }, [signed, logEvent]);

  if (status !== "authenticated" || profileLoading || !profile) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-zinc-50 text-sm text-zinc-500">
        Cargando...
      </main>
    );
  }

  return (
    <main
      className={
        "min-h-screen bg-zinc-50 transition-[padding] " + (devMode ? "pr-[400px]" : "")
      }
    >
      <div className="mx-auto max-w-6xl px-4 pb-12">
        <Header devMode={devMode} onToggleDevMode={toggleDevMode} />
        <ProdBanner />

        {/* PDF picker */}
        <section className="mb-6 rounded-lg border border-zinc-200 bg-white p-5 shadow-sm">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-sm font-semibold text-zinc-900">Documento a firmar</h2>
              <p className="mt-0.5 text-xs text-zinc-500">
                Subí el PDF que vas a firmar — el sandbox lo manda al iframe automáticamente.
              </p>
            </div>
            <label className="inline-flex cursor-pointer items-center gap-2 self-start rounded-md border border-zinc-300 bg-white px-3 py-1.5 text-xs font-medium text-zinc-700 transition-colors hover:bg-zinc-50">
              <input
                type="file"
                accept="application/pdf"
                onChange={(e) => handlePdfChange(e.target.files?.[0] ?? null)}
                className="sr-only"
              />
              {pdf ? "Cambiar PDF" : "Elegir PDF"}
            </label>
          </div>

          {pdf && (
            <p className="mt-3 inline-flex items-center gap-2 rounded-md bg-zinc-100 px-2.5 py-1 font-mono text-xs text-zinc-700">
              <span>📄</span>
              {pdf.fileName}
              <button
                type="button"
                onClick={() => setPdf(null)}
                className="ml-1 text-zinc-500 hover:text-zinc-900"
                title="Quitar"
              >
                ✕
              </button>
            </p>
          )}

          {pdfError && (
            <p className="mt-3 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
              {pdfError}
            </p>
          )}
        </section>

        {/* Iframe */}
        <section className="overflow-hidden rounded-lg border border-zinc-200 bg-white shadow-sm">
          {active ? (
            <LakautEmbed
              sessionToken={active.sessionToken}
              userData={active.userData}
              autoLoadFile={pdf ?? undefined}
              onEvent={handleEvent}
              onSignCompleted={handleSignCompleted}
            />
          ) : (
            <div className="flex h-[400px] items-center justify-center text-sm text-zinc-500">
              Cargando session...
            </div>
          )}
        </section>

        {signed && (
          <div className="mt-4">
            <button
              type="button"
              onClick={handleDownload}
              className="inline-flex items-center gap-2 rounded-md bg-emerald-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-emerald-700"
            >
              ↓ Descargar PDF firmado
            </button>
          </div>
        )}
      </div>

      {devMode && (
        <DevDrawer
          events={events}
          onClearEvents={() => setEvents([])}
          onReloadWithOverrides={handleReloadWithOverrides}
          onLog={logEvent}
          onClose={toggleDevMode}
        />
      )}
    </main>
  );
}

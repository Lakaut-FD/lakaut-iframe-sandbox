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
  file: AutoLoadFile;
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

async function createSession(): Promise<SessionResponse> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 15000);
  try {
    const res = await fetch("/api/sessions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
      signal: controller.signal,
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      const err = (body as { error?: string }).error ?? `HTTP ${res.status}`;
      throw new Error(err);
    }
    const data = (await res.json()) as SessionResponse;
    if (!data.tokenSession) throw new Error("Respuesta sin tokenSession");
    return data;
  } finally {
    clearTimeout(timeoutId);
  }
}

export default function Home() {
  const router = useRouter();
  const { status } = useSession();
  const { data: profile, isLoading: profileLoading } = useSWR<UserProfile | null>("/api/profile");
  const [active, setActive] = useState<ActiveSession | null>(null);
  const [pdf, setPdf] = useState<AutoLoadFile | null>(null);
  const [pdfError, setPdfError] = useState<string | null>(null);
  const [sessionStartError, setSessionStartError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [events, setEvents] = useState<EventLog[]>([]);
  const [signed, setSigned] = useState<SignedDoc | null>(null);
  const [devMode, setDevMode] = useState(false);
  const dragOverRef = useRef(false);
  const [dragOver, setDragOver] = useState(false);

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

  // Cuando hay PDF + profile y NO hay session activa, arrancarla
  const startSession = useCallback(async () => {
    if (!profile || !pdf) return;
    setCreating(true);
    setSessionStartError(null);
    try {
      const data = await createSession();
      logEvent({
        timestamp: Date.now(),
        type: "sandbox.session.created",
        via: "server",
        status: 200,
      });
      setActive({
        sessionToken: data.tokenSession,
        userData: profileToUserData(profile),
        file: pdf,
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setSessionStartError(msg);
      logEvent({
        timestamp: Date.now(),
        type: "sandbox.session.failed",
        payload: { error: msg },
      });
    } finally {
      setCreating(false);
    }
  }, [profile, pdf, logEvent]);

  // Auto-arrancar session cuando recién se carga el PDF (y aún no hay session activa)
  useEffect(() => {
    if (active) return;
    if (!profile || !pdf) return;
    if (creating) return;
    if (sessionStartError) return; // si falló, esperar a que el usuario clickee Reintentar
    void startSession();
  }, [active, profile, pdf, creating, sessionStartError, startSession]);

  const handleReloadWithOverrides = useCallback(
    (token: string) => {
      if (!profile || !pdf) return;
      setActive({
        sessionToken: token,
        userData: profileToUserData(profile),
        file: pdf,
      });
      setSigned(null);
    },
    [profile, pdf]
  );

  const handlePdfFile = useCallback(async (file: File | null) => {
    setPdfError(null);
    setSessionStartError(null);
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
      setActive(null); // reset: nueva session se crea con el nuevo PDF
      setSigned(null);
      logEvent({
        timestamp: Date.now(),
        type: "sandbox.pdf.loaded",
        payload: { fileName: file.name, sizeKb: Math.round(file.size / 1024) },
      });
    } catch (e) {
      setPdfError(e instanceof Error ? e.message : "Error al leer el archivo");
    }
  }, [logEvent]);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      dragOverRef.current = false;
      setDragOver(false);
      const file = e.dataTransfer.files?.[0] ?? null;
      void handlePdfFile(file);
    },
    [handlePdfFile]
  );

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    if (!dragOverRef.current) {
      dragOverRef.current = true;
      setDragOver(true);
    }
  }, []);

  const handleDragLeave = useCallback(() => {
    dragOverRef.current = false;
    setDragOver(false);
  }, []);

  const handleChangePdf = useCallback(() => {
    setPdf(null);
    setActive(null);
    setSigned(null);
    setSessionStartError(null);
    setPdfError(null);
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

        {!pdf ? (
          /* DROPZONE — sin PDF aún */
          <section
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            className={
              "rounded-lg border-2 border-dashed bg-white p-12 text-center transition-colors " +
              (dragOver ? "border-zinc-900 bg-zinc-50" : "border-zinc-300")
            }
          >
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-zinc-100 text-2xl">
              📄
            </div>
            <h2 className="text-lg font-semibold text-zinc-900">Subí el PDF a firmar</h2>
            <p className="mt-1 text-sm text-zinc-600">
              Arrastrá un PDF acá o usá el botón. La firma se va a hacer sobre este documento.
            </p>
            <label className="mt-5 inline-flex cursor-pointer items-center gap-2 rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-zinc-800">
              <input
                type="file"
                accept="application/pdf"
                onChange={(e) => handlePdfFile(e.target.files?.[0] ?? null)}
                className="sr-only"
              />
              Elegir PDF
            </label>
            {pdfError && (
              <p className="mt-4 inline-block rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                {pdfError}
              </p>
            )}
          </section>
        ) : (
          /* PDF cargado: mostrar iframe o estado de loading */
          <div className="space-y-4">
            {/* Bar con info del PDF + Cambiar */}
            <section className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-zinc-200 bg-white px-4 py-2.5 shadow-sm">
              <div className="flex items-center gap-2 text-sm text-zinc-700">
                <span>📄</span>
                <span className="font-mono">{pdf.fileName}</span>
                <span className="text-xs text-zinc-400">
                  ({Math.round(pdf.base64.length * 0.75 / 1024)} KB)
                </span>
              </div>
              <button
                type="button"
                onClick={handleChangePdf}
                className="rounded-md border border-zinc-300 bg-white px-2.5 py-1.5 text-xs font-medium text-zinc-700 transition-colors hover:bg-zinc-50"
              >
                Cambiar PDF
              </button>
            </section>

            {sessionStartError ? (
              <section className="rounded-lg border border-red-200 bg-red-50 p-6">
                <h3 className="text-sm font-semibold text-red-900">No se pudo crear la session</h3>
                <p className="mt-1 text-sm text-red-800">{sessionStartError}</p>
                <button
                  type="button"
                  onClick={() => {
                    setSessionStartError(null);
                    void startSession();
                  }}
                  className="mt-4 rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-zinc-800"
                >
                  Reintentar
                </button>
              </section>
            ) : !active ? (
              <section className="flex h-[400px] items-center justify-center rounded-lg border border-zinc-200 bg-white text-sm text-zinc-500">
                {creating ? "Creando session..." : "Preparando..."}
              </section>
            ) : (
              <section className="overflow-hidden rounded-lg border border-zinc-200 bg-white shadow-sm">
                <LakautEmbed
                  sessionToken={active.sessionToken}
                  userData={active.userData}
                  autoLoadFile={active.file}
                  onEvent={handleEvent}
                  onSignCompleted={handleSignCompleted}
                />
              </section>
            )}

            {signed && (
              <button
                type="button"
                onClick={handleDownload}
                className="inline-flex items-center gap-2 rounded-md bg-emerald-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-emerald-700"
              >
                ↓ Descargar PDF firmado
              </button>
            )}
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

"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import useSWR from "swr";
import { Header } from "@/components/Header";
import { ProdBanner } from "@/components/ProdBanner";
import { LakautEmbed } from "@/components/LakautEmbed";
import { DevDrawer } from "@/components/DevDrawer";
import { downloadBase64 } from "@/lib/pdf";
import type { EventLog, SessionResponse, SignedDoc, UserData, UserProfile } from "@/types/lakaut";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

interface ActiveSession {
  sessionToken: string;
  userData: UserData;
}

function profileToUserData(profile: UserProfile): UserData {
  return {
    email: profile.email,
    name: profile.name,
    dni: profile.dni,
    cuil: profile.cuil,
    gender: profile.gender,
    phone: profile.phone,
  };
}

export default function Home() {
  const router = useRouter();
  const { status } = useSession();
  const { data: profile, isLoading: profileLoading } = useSWR<UserProfile | null>("/api/profile", fetcher);
  const [active, setActive] = useState<ActiveSession | null>(null);
  const [events, setEvents] = useState<EventLog[]>([]);
  const [signed, setSigned] = useState<SignedDoc | null>(null);
  const [devMode, setDevMode] = useState(false);
  const autoStartedRef = useRef(false);

  // Cargar preferencia devMode desde localStorage al montar
  useEffect(() => {
    if (typeof window === "undefined") return;
    setDevMode(window.localStorage.getItem("sandbox.devMode") === "true");
  }, []);

  const toggleDevMode = useCallback(() => {
    setDevMode((prev) => {
      const next = !prev;
      if (typeof window !== "undefined") window.localStorage.setItem("sandbox.devMode", String(next));
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
    if (!profile) {
      router.replace("/onboarding");
    }
  }, [status, profile, profileLoading, router]);

  // Auto-arrancar session cuando hay profile y NextAuth está autenticado
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

  if (status !== "authenticated" || profileLoading || !profile) {
    return (
      <main className="flex min-h-screen items-center justify-center text-sm text-gray-500">
        Cargando...
      </main>
    );
  }

  return (
    <main className={"mx-auto max-w-7xl px-4 py-4 " + (devMode ? "pr-[26rem]" : "")}>
      <Header devMode={devMode} onToggleDevMode={toggleDevMode} />
      <ProdBanner />

      {active ? (
        <LakautEmbed
          sessionToken={active.sessionToken}
          userData={active.userData}
          onEvent={handleEvent}
          onSignCompleted={handleSignCompleted}
        />
      ) : (
        <div className="flex h-[400px] items-center justify-center rounded border border-dashed border-gray-300 text-sm text-gray-500">
          Cargando session...
        </div>
      )}

      {signed && (
        <div className="mt-4">
          <button
            type="button"
            onClick={handleDownload}
            className="rounded bg-emerald-600 px-3 py-2 text-sm font-medium text-white hover:bg-emerald-700"
          >
            Download signed PDF
          </button>
        </div>
      )}

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

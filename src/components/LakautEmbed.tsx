"use client";

import { useEffect, useMemo, useRef } from "react";
import type { AutoLoadFile, UserData } from "@/types/lakaut";

const IFRAME_ORIGIN_URL = process.env.NEXT_PUBLIC_IFRAME_EMBED_URL ?? "";

function getOriginFromUrl(maybeUrl: string): string {
  try {
    return new URL(maybeUrl).origin;
  } catch {
    return maybeUrl;
  }
}

function buildIframeSrc(base: string, sessionToken: string): string {
  if (!base) return base;
  try {
    const u = new URL(base);
    u.searchParams.set("sessionToken", sessionToken);
    return u.toString();
  } catch {
    const sep = base.includes("?") ? "&" : "?";
    return `${base}${sep}sessionToken=${encodeURIComponent(sessionToken)}`;
  }
}

interface Props {
  sessionToken: string;
  userData: UserData;
  autoLoadFile?: AutoLoadFile;
  onEvent: (event: { type: string; payload?: unknown; origin?: string }) => void;
  onSignCompleted: (payload: unknown) => void;
}

export function LakautEmbed({ sessionToken, userData, autoLoadFile, onEvent, onSignCompleted }: Props) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const hasHandshakeAck = useRef(false);
  const runtimeOrigin = useRef<string | null>(null);
  const retryTimer = useRef<number | null>(null);
  const retryCount = useRef(0);
  const onEventRef = useRef(onEvent);
  const onSignCompletedRef = useRef(onSignCompleted);

  // UUIDs estables por sesión (mientras no cambien sessionToken/userData/file).
  // Docu oficial los marca requeridos en lakaut.init para idempotencia.
  const ids = useMemo(
    () => ({
      nonce: crypto.randomUUID(),
      idemKey: crypto.randomUUID(),
    }),
    [sessionToken, userData, autoLoadFile]
  );

  const iframeSrc = useMemo(
    () => buildIframeSrc(IFRAME_ORIGIN_URL, sessionToken),
    [sessionToken]
  );

  useEffect(() => {
    onEventRef.current = onEvent;
  }, [onEvent]);

  useEffect(() => {
    onSignCompletedRef.current = onSignCompleted;
  }, [onSignCompleted]);

  useEffect(() => {
    hasHandshakeAck.current = false;
    runtimeOrigin.current = null;
    retryCount.current = 0;

    const expectedOrigin = getOriginFromUrl(IFRAME_ORIGIN_URL);

    const sendInit = () => {
      const iframe = iframeRef.current;
      if (!iframe?.contentWindow) return;
      const target = runtimeOrigin.current || expectedOrigin || "*";
      iframe.contentWindow.postMessage(
        {
          type: "lakaut.init",
          payload: {
            nonce: ids.nonce,
            idemKey: ids.idemKey,
            sessionToken,
            userData,
            autoLoadFile,
          },
        },
        target
      );
      onEventRef.current({
        type: "lakaut.init",
        payload: { nonce: ids.nonce, idemKey: ids.idemKey, hasFile: !!autoLoadFile },
      });
    };

    const scheduleRetry = () => {
      if (hasHandshakeAck.current || retryCount.current >= 10) return;
      if (retryTimer.current) window.clearTimeout(retryTimer.current);
      retryCount.current += 1;
      retryTimer.current = window.setTimeout(() => {
        if (!hasHandshakeAck.current) {
          sendInit();
          scheduleRetry();
        }
      }, 500);
    };

    const onMessage = (event: MessageEvent) => {
      if (!event.data || typeof event.data.type !== "string") return;
      const { type, payload } = event.data;

      // Aprender origen del iframe en el primer mensaje lakaut.*
      if (type.startsWith("lakaut.") && !runtimeOrigin.current) {
        runtimeOrigin.current = event.origin;
      }

      // Aceptar solo mensajes del origen conocido (después del primero)
      const expected = runtimeOrigin.current || expectedOrigin;
      if (event.origin !== expected && type.startsWith("lakaut.")) {
        console.warn("[Sandbox] mensaje de origen inesperado", event.origin, "vs", expected);
        return;
      }

      onEventRef.current({ type, payload, origin: event.origin });

      if (type === "lakaut.ready") {
        if (!hasHandshakeAck.current) sendInit();
      } else if (type === "lakaut.handshake.ack") {
        hasHandshakeAck.current = true;
        if (retryTimer.current) {
          window.clearTimeout(retryTimer.current);
          retryTimer.current = null;
        }
      } else if (type === "lakaut.signature.completed") {
        onSignCompletedRef.current(payload);
      }
    };

    window.addEventListener("message", onMessage);
    // Primer intento de init poco después del mount (por si el iframe ya está listo)
    const initialDelay = window.setTimeout(() => {
      sendInit();
      scheduleRetry();
    }, 300);

    return () => {
      window.removeEventListener("message", onMessage);
      window.clearTimeout(initialDelay);
      if (retryTimer.current) window.clearTimeout(retryTimer.current);
    };
  }, [sessionToken, userData, autoLoadFile, ids]);

  if (!IFRAME_ORIGIN_URL) {
    return <div className="rounded border border-red-300 bg-red-50 p-3 text-sm text-red-700">
      NEXT_PUBLIC_IFRAME_EMBED_URL no configurada.
    </div>;
  }

  return (
    <iframe
      ref={iframeRef}
      src={iframeSrc}
      title="Lakaut iframe"
      className="block w-full"
      style={{ height: 820, border: "1px solid #d1d5db", borderRadius: 8 }}
      allow="camera; microphone; clipboard-read; clipboard-write"
    />
  );
}

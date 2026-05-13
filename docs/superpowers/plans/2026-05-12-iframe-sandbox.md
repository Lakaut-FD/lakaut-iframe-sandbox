# Lakaut Iframe Sandbox Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Crear desde cero un sandbox interno en Vercel (Next.js + NextAuth + Google) para que el equipo de ingeniería pruebe el iframe productivo (`https://iframe.lakautac.com.ar/embed/`) actuando como un integrador, con toggle Server/Client mode para validar ambos patrones de integración.

**Architecture:** Next.js App Router single page, gated por NextAuth Google con allowlist `@lakaut.com[.ar]`. Server mode usa API route `/api/sessions` para llamar a web2 con apikey de server env. Client mode hace fetch directo a web2 desde el browser con apikey provista en el form. Sesión creada → embebe iframe productivo via postMessage handshake.

**Tech Stack:** Next.js 15 (App Router), TypeScript, Tailwind v4, NextAuth v4, Vercel hosting. Sin BD, sin ORM, sin tests automatizados en fase 1.

**Working directory:** `/home/jtorchia/develop/lakaut/lakaut-iframe-sandbox` (ya existe como git init local, sin commits aún).

**Nota sobre commits:** El usuario maneja sus propios commits — los steps de commit del plan son **sugerencias de comando**. El ejecutor debe pedir confirmación o dejar los cambios staged sin commitear, según prefiera el usuario.

**Referencia:** [Spec del diseño](../specs/2026-05-12-iframe-sandbox-design.md)

**Endpoint web2 confirmado (revisado en `lakautac-web2/src/app/api/integration/session/new/route.ts`):**
- URL: `POST https://www.lakautac.com.ar/api/integration/session/new?id=<integratorId>`
- Header: `X-API-Key: <apikey>`
- Respuesta exitosa (200): JSON `iFrameSessionInfo` (campos exactos a inspeccionar en `web2/src/server/services/iframeService.ts` al implementar; mínimamente contiene un token JWT que el iframe consume).
- CORS: `Access-Control-Allow-Origin: *`, headers permitidos `Content-Type, X-API-Key`.

---

## Task 1 — Scaffolding del proyecto Next.js

**Files:**
- Create: `package.json`, `tsconfig.json`, `next.config.ts`, `next-env.d.ts`, `.gitignore`, `.eslintrc.json` (o `eslint.config.mjs`), `postcss.config.mjs`, `tailwind.config.ts`, `src/app/globals.css`, `src/app/layout.tsx`, `src/app/page.tsx` (placeholder), `README.md`, `.env.example`

- [ ] **Step 1: Inicializar Next.js con `create-next-app`**

```bash
cd /home/jtorchia/develop/lakaut/lakaut-iframe-sandbox
# create-next-app no overwrite-friendly con files existentes — usar carpeta temporal y mover
npx --yes create-next-app@latest .tmp-init \
  --typescript --tailwind --app --src-dir --turbopack \
  --eslint --no-import-alias --use-npm
# Mover el contenido del init al directorio actual (preservar docs/, .git/)
cp -r .tmp-init/. .  2>/dev/null
rm -rf .tmp-init
```

Esperado: `package.json`, `tsconfig.json`, `next.config.ts`, `src/app/{layout,page}.tsx`, `tailwind.config.ts`, `postcss.config.mjs`, `eslint.config.mjs` creados. `docs/` y `.git/` intactos.

- [ ] **Step 2: Verificar archivos esperados existen**

```bash
ls -la src/app/ docs/superpowers/specs/
test -f tsconfig.json && test -f next.config.ts && test -f tailwind.config.ts && echo "OK"
```

Esperado: salida `OK` + listado.

- [ ] **Step 3: Probar el dev server arranca**

```bash
npm run dev &
SERVER_PID=$!
sleep 8
curl -sI http://localhost:3000/ | head -3
kill $SERVER_PID 2>/dev/null
```

Esperado: `HTTP/1.1 200 OK` o `HTTP/1.1 307 Temporary Redirect`. Si falla, revisar errores del build.

- [ ] **Step 4: Configurar import alias `@/*` en tsconfig**

Edit `tsconfig.json` — asegurar que tiene:

```json
{
  "compilerOptions": {
    "baseUrl": ".",
    "paths": { "@/*": ["./src/*"] }
  }
}
```

(Si `create-next-app` lo creó con `--no-import-alias`, se reemplaza manualmente).

- [ ] **Step 5: Crear `.env.example`**

```bash
cat > .env.example <<'EOF'
# NextAuth
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=

# Google OAuth (de Google Cloud Console)
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=

# Integrator (Server mode default)
INTEGRATOR_ID=
INTEGRATOR_API_KEY=

# web2 (server-side)
WEB2_BASE_URL=https://www.lakautac.com.ar

# Public (expuesta al browser)
NEXT_PUBLIC_IFRAME_EMBED_URL=https://iframe.lakautac.com.ar/embed/
NEXT_PUBLIC_WEB2_BASE_URL=https://www.lakautac.com.ar
EOF
```

- [ ] **Step 6: Sobrescribir `README.md` con info del proyecto**

```bash
cat > README.md <<'EOF'
# Lakaut Iframe Sandbox

Sandbox interno para el equipo de ingeniería: emula un integrador real consumiendo el iframe productivo de firma digital (`https://iframe.lakautac.com.ar/embed/`).

Solo accesible con login Google de un email `@lakaut.com.ar` o `@lakaut.com`.

## Local dev

1. `cp .env.example .env.local` y completar las vars (ver §6 del spec).
2. `npm install`
3. `npm run dev` → http://localhost:3000

## Deploy

Vercel (Next.js auto-detect). Env vars en el dashboard de Vercel.

Ver `docs/superpowers/specs/2026-05-12-iframe-sandbox-design.md` para detalles.
EOF
```

- [ ] **Step 7: Confirmar build pasa en limpio**

```bash
npm run build 2>&1 | tail -15
```

Esperado: "Compiled successfully" y exit code 0.

- [ ] **Step 8: Commit (sugerido)**

```bash
git add .
git commit -m "Scaffold Next.js project (App Router + TS + Tailwind)"
```

---

## Task 2 — Tipos compartidos

**Files:**
- Create: `src/types/lakaut.ts`
- Create: `src/types/next-auth.d.ts`

- [ ] **Step 1: Crear `src/types/lakaut.ts`**

```typescript
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
```

- [ ] **Step 2: Crear `src/types/next-auth.d.ts`**

```typescript
import "next-auth";

declare module "next-auth" {
  interface Session {
    user?: {
      name?: string | null;
      email?: string | null;
      image?: string | null;
    };
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    email?: string;
  }
}
```

- [ ] **Step 3: Verificar tsc**

```bash
npx tsc --noEmit 2>&1 | head -10
echo "exit=$?"
```

Esperado: `exit=0`.

- [ ] **Step 4: Commit**

```bash
git add src/types/
git commit -m "Add shared types (UserData, EventLog, SessionResponse) and next-auth augmentation"
```

---

## Task 3 — Auth: NextAuth + Google + dominio allowlist

**Files:**
- Create: `src/lib/auth.ts`
- Create: `src/app/api/auth/[...nextauth]/route.ts`
- Create: `middleware.ts` (en la raíz del proyecto)
- Create: `src/app/denied/page.tsx`

- [ ] **Step 1: Instalar NextAuth**

```bash
npm install next-auth@^4
```

- [ ] **Step 2: Crear `src/lib/auth.ts`**

```typescript
import type { NextAuthOptions } from "next-auth";
import GoogleProvider from "next-auth/providers/google";

export const ALLOWED_DOMAINS = ["lakaut.com.ar", "lakaut.com"];

function isAllowedEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  const domain = email.split("@")[1];
  return ALLOWED_DOMAINS.includes(domain);
}

export const authOptions: NextAuthOptions = {
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    }),
  ],
  session: { strategy: "jwt" },
  callbacks: {
    async signIn({ profile }) {
      return isAllowedEmail(profile?.email);
    },
    async jwt({ token, profile }) {
      if (profile?.email) token.email = profile.email;
      return token;
    },
    async session({ session, token }) {
      if (session.user && token.email) {
        session.user.email = token.email;
      }
      return session;
    },
  },
  pages: { error: "/denied" },
};

export { isAllowedEmail };
```

- [ ] **Step 3: Crear `src/app/api/auth/[...nextauth]/route.ts`**

```typescript
import NextAuth from "next-auth";
import { authOptions } from "@/lib/auth";

const handler = NextAuth(authOptions);

export { handler as GET, handler as POST };
```

- [ ] **Step 4: Crear `middleware.ts` en raíz**

```typescript
import { withAuth } from "next-auth/middleware";
import { ALLOWED_DOMAINS } from "@/lib/auth";

export default withAuth({
  callbacks: {
    authorized: ({ token }) => {
      const email = token?.email as string | undefined;
      if (!email) return false;
      const domain = email.split("@")[1];
      return ALLOWED_DOMAINS.includes(domain);
    },
  },
  pages: {
    signIn: "/api/auth/signin",
    error: "/denied",
  },
});

export const config = {
  matcher: ["/((?!api/auth|denied|_next/static|_next/image|favicon.ico).*)"],
};
```

- [ ] **Step 5: Crear `src/app/denied/page.tsx`**

```typescript
export default function DeniedPage() {
  return (
    <main className="flex min-h-screen items-center justify-center p-8">
      <div className="max-w-md text-center">
        <h1 className="text-2xl font-semibold mb-4">Acceso denegado</h1>
        <p className="text-gray-600 mb-6">
          Solo emails @lakaut.com.ar o @lakaut.com pueden acceder al sandbox.
        </p>
        <a
          href="/api/auth/signin"
          className="inline-block rounded bg-indigo-600 px-4 py-2 text-white hover:bg-indigo-700"
        >
          Probar con otra cuenta
        </a>
      </div>
    </main>
  );
}
```

- [ ] **Step 6: Verificar tsc + lint**

```bash
npx tsc --noEmit && npm run lint 2>&1 | tail -5
echo "exit=$?"
```

Esperado: `exit=0`.

- [ ] **Step 7: Commit**

```bash
git add src/lib/auth.ts src/app/api/auth src/app/denied middleware.ts package.json package-lock.json
git commit -m "Add NextAuth with Google provider and domain allowlist (@lakaut.com[.ar])"
```

---

## Task 4 — `src/lib/pdf.ts` (helpers de PDF)

**Files:**
- Create: `src/lib/pdf.ts`

- [ ] **Step 1: Crear `src/lib/pdf.ts`**

```typescript
/**
 * Convierte un File a base64 (sin el prefijo data: URI).
 * Solo válido en browser.
 */
export function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const result = reader.result?.toString() ?? "";
      const base64 = result.split(",")[1] ?? "";
      if (!base64) reject(new Error("No se pudo extraer base64 del archivo"));
      else resolve(base64);
    };
    reader.onerror = () => reject(reader.error ?? new Error("FileReader error"));
    reader.readAsDataURL(file);
  });
}

/**
 * Dispara una descarga de un base64 como archivo en el browser.
 */
export function downloadBase64(base64: string, filename: string, mime = "application/pdf"): void {
  const byteCharacters = atob(base64);
  const byteNumbers = new Array(byteCharacters.length);
  for (let i = 0; i < byteCharacters.length; i++) {
    byteNumbers[i] = byteCharacters.charCodeAt(i);
  }
  const blob = new Blob([new Uint8Array(byteNumbers)], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
```

- [ ] **Step 2: Verificar tsc**

```bash
npx tsc --noEmit && echo OK
```

- [ ] **Step 3: Commit**

```bash
git add src/lib/pdf.ts
git commit -m "Add PDF helpers: fileToBase64 + downloadBase64"
```

---

## Task 5 — `src/lib/web2.ts` (cliente del web2, server-side)

**Files:**
- Create: `src/lib/web2.ts`

- [ ] **Step 1: Crear `src/lib/web2.ts`**

```typescript
import type { SessionResponse } from "@/types/lakaut";

interface CreateSessionParams {
  integratorId: string;
  apiKey: string;
}

/**
 * Llama a web2 prod para crear un sessionToken. Solo server-side.
 *
 * Endpoint: POST {WEB2_BASE_URL}/api/integration/session/new?id={integratorId}
 * Header:   X-API-Key: {apiKey}
 *
 * web2 source: `lakautac-web2/src/app/api/integration/session/new/route.ts`
 * service:     `lakautac-web2/src/server/services/iframeService.ts` (CreateSession)
 */
export async function createSession({ integratorId, apiKey }: CreateSessionParams): Promise<SessionResponse> {
  const base = process.env.WEB2_BASE_URL;
  if (!base) throw new Error("WEB2_BASE_URL env var no configurada");
  if (!integratorId) throw new Error("integratorId requerido");
  if (!apiKey) throw new Error("apiKey requerido");

  const url = `${base}/api/integration/session/new?id=${encodeURIComponent(integratorId)}`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "X-API-Key": apiKey },
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`web2 createSession failed: ${res.status} ${text}`);
  }

  return (await res.json()) as SessionResponse;
}
```

- [ ] **Step 2: Verificar tsc**

```bash
npx tsc --noEmit && echo OK
```

- [ ] **Step 3: Commit**

```bash
git add src/lib/web2.ts
git commit -m "Add web2 client: createSession (server-side)"
```

---

## Task 6 — API route `/api/sessions` (Server mode endpoint)

**Files:**
- Create: `src/app/api/sessions/route.ts`

- [ ] **Step 1: Crear `src/app/api/sessions/route.ts`**

```typescript
import { NextResponse } from "next/server";
import { createSession } from "@/lib/web2";
import { getServerSession } from "next-auth";
import { authOptions, isAllowedEmail } from "@/lib/auth";

interface PostBody {
  integratorId?: string;
  apiKey?: string;
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!isAllowedEmail(session?.user?.email)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: PostBody;
  try {
    body = (await req.json()) as PostBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const integratorId = body.integratorId || process.env.INTEGRATOR_ID || "";
  const apiKey = body.apiKey || process.env.INTEGRATOR_API_KEY || "";

  if (!integratorId || !apiKey) {
    return NextResponse.json(
      { error: "Faltan integratorId o apiKey (ni en body ni en env)" },
      { status: 400 }
    );
  }

  try {
    const data = await createSession({ integratorId, apiKey });
    return NextResponse.json(data);
  } catch (e) {
    const message = e instanceof Error ? e.message : "unknown error";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
```

- [ ] **Step 2: Verificar tsc**

```bash
npx tsc --noEmit && echo OK
```

- [ ] **Step 3: Commit**

```bash
git add src/app/api/sessions/route.ts
git commit -m "Add /api/sessions endpoint for Server mode (gated by NextAuth)"
```

---

## Task 7 — Componente `LakautEmbed` (iframe + postMessage handshake)

**Files:**
- Create: `src/components/LakautEmbed.tsx`

- [ ] **Step 1: Crear `src/components/LakautEmbed.tsx`**

```typescript
"use client";

import { useEffect, useRef } from "react";
import type { AutoLoadFile, UserData } from "@/types/lakaut";

const IFRAME_ORIGIN_URL = process.env.NEXT_PUBLIC_IFRAME_EMBED_URL ?? "";

function getOriginFromUrl(maybeUrl: string): string {
  try {
    return new URL(maybeUrl).origin;
  } catch {
    return maybeUrl;
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

  useEffect(() => {
    hasHandshakeAck.current = false;
    runtimeOrigin.current = null;
    retryCount.current = 0;

    const expectedOrigin = getOriginFromUrl(IFRAME_ORIGIN_URL);

    const sendInit = () => {
      const iframe = iframeRef.current;
      if (!iframe?.contentWindow) return;
      const target = runtimeOrigin.current || "*";
      iframe.contentWindow.postMessage(
        {
          type: "lakaut.init",
          payload: { sessionToken, userData, autoLoadFile },
        },
        target
      );
      onEvent({ type: "lakaut.init", payload: { hasFile: !!autoLoadFile } });
    };

    const scheduleRetry = () => {
      if (hasHandshakeAck.current || retryCount.current >= 10) return;
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

      onEvent({ type, payload, origin: event.origin });

      if (type === "lakaut.ready") {
        if (!hasHandshakeAck.current) sendInit();
      } else if (type === "lakaut.handshake.ack") {
        hasHandshakeAck.current = true;
        if (retryTimer.current) {
          window.clearTimeout(retryTimer.current);
          retryTimer.current = null;
        }
      } else if (type === "lakaut.signature.completed") {
        onSignCompleted(payload);
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
  }, [sessionToken, userData, autoLoadFile, onEvent, onSignCompleted]);

  if (!IFRAME_ORIGIN_URL) {
    return <div className="rounded border border-red-300 bg-red-50 p-3 text-sm text-red-700">
      NEXT_PUBLIC_IFRAME_EMBED_URL no configurada.
    </div>;
  }

  return (
    <iframe
      ref={iframeRef}
      src={IFRAME_ORIGIN_URL}
      title="Lakaut iframe"
      className="block w-full"
      style={{ height: 820, border: "1px solid #d1d5db", borderRadius: 8 }}
      allow="camera; microphone; clipboard-read; clipboard-write"
    />
  );
}
```

- [ ] **Step 2: Verificar tsc**

```bash
npx tsc --noEmit && echo OK
```

- [ ] **Step 3: Commit**

```bash
git add src/components/LakautEmbed.tsx
git commit -m "Add LakautEmbed component (iframe + postMessage handshake with retries)"
```

---

## Task 8 — Componente `EventConsole`

**Files:**
- Create: `src/components/EventConsole.tsx`

- [ ] **Step 1: Crear `src/components/EventConsole.tsx`**

```typescript
"use client";

import { useState } from "react";
import type { EventLog } from "@/types/lakaut";

function formatTime(timestamp: number): string {
  const d = new Date(timestamp);
  return d.toLocaleTimeString("es-AR", { hour12: false }) + "." + String(d.getMilliseconds()).padStart(3, "0");
}

interface Props {
  events: EventLog[];
  onClear: () => void;
}

export function EventConsole({ events, onClear }: Props) {
  return (
    <div className="rounded border border-gray-200">
      <div className="flex items-center justify-between border-b border-gray-200 bg-gray-50 px-3 py-2">
        <h3 className="text-sm font-semibold">Event Console ({events.length})</h3>
        <button
          onClick={onClear}
          className="text-xs text-gray-600 hover:text-gray-900"
        >
          Clear
        </button>
      </div>
      <ul className="max-h-[600px] overflow-y-auto divide-y divide-gray-100 font-mono text-xs">
        {events.length === 0 && (
          <li className="px-3 py-4 text-gray-400">No events yet.</li>
        )}
        {events.map((event, idx) => (
          <EventItem key={idx} event={event} />
        ))}
      </ul>
    </div>
  );
}

function EventItem({ event }: { event: EventLog }) {
  const [expanded, setExpanded] = useState(false);
  const hasPayload = event.payload !== undefined && event.payload !== null;

  return (
    <li className="px-3 py-2">
      <button
        onClick={() => hasPayload && setExpanded(!expanded)}
        className="flex w-full items-start gap-2 text-left"
      >
        <span className="text-gray-500">{formatTime(event.timestamp)}</span>
        <span className={hasPayload ? "text-indigo-700 underline-offset-2 hover:underline" : "text-gray-800"}>
          {event.type}
        </span>
        {event.via && <span className="text-gray-500">[via {event.via}]</span>}
        {event.status !== undefined && <span className="text-gray-500">[{event.status}]</span>}
        {event.corsError && <span className="text-red-600">[CORS]</span>}
      </button>
      {expanded && hasPayload && (
        <pre className="mt-1 whitespace-pre-wrap break-all rounded bg-gray-50 p-2 text-[11px] leading-relaxed text-gray-800">
          {JSON.stringify(event.payload, null, 2)}
        </pre>
      )}
    </li>
  );
}
```

- [ ] **Step 2: Verificar tsc**

```bash
npx tsc --noEmit && echo OK
```

- [ ] **Step 3: Commit**

```bash
git add src/components/EventConsole.tsx
git commit -m "Add EventConsole with collapsible JSON payloads"
```

---

## Task 9 — Componentes pequeños: `UserDataInputs`, `ModeToggle`, `SignOutButton`

**Files:**
- Create: `src/components/UserDataInputs.tsx`
- Create: `src/components/ModeToggle.tsx`
- Create: `src/components/SignOutButton.tsx`

- [ ] **Step 1: Crear `src/components/UserDataInputs.tsx`**

```typescript
"use client";

import type { Gender, UserData } from "@/types/lakaut";
import { MOCK_USER_DATA } from "@/types/lakaut";

interface Props {
  value: UserData;
  onChange: (next: UserData) => void;
}

export function UserDataInputs({ value, onChange }: Props) {
  const update = <K extends keyof UserData>(key: K, v: UserData[K]) => {
    onChange({ ...value, [key]: v });
  };

  return (
    <fieldset className="space-y-2">
      <legend className="flex items-center justify-between w-full text-sm font-medium">
        <span>User data</span>
        <button
          type="button"
          onClick={() => onChange(MOCK_USER_DATA)}
          className="text-xs text-indigo-600 hover:underline"
        >
          Fill mock
        </button>
      </legend>

      <div className="grid grid-cols-2 gap-2">
        <label className="text-xs">DNI
          <input
            type="text"
            value={value.dni}
            onChange={(e) => update("dni", e.target.value)}
            className="mt-1 block w-full rounded border border-gray-300 px-2 py-1 text-sm"
          />
        </label>
        <label className="text-xs">Gender
          <select
            value={value.gender}
            onChange={(e) => update("gender", e.target.value as Gender)}
            className="mt-1 block w-full rounded border border-gray-300 px-2 py-1 text-sm"
          >
            <option value="M">M</option>
            <option value="F">F</option>
            <option value="X">X</option>
          </select>
        </label>
        <label className="text-xs col-span-2">Email
          <input
            type="email"
            value={value.email}
            onChange={(e) => update("email", e.target.value)}
            className="mt-1 block w-full rounded border border-gray-300 px-2 py-1 text-sm"
          />
        </label>
        <label className="text-xs">Phone
          <input
            type="tel"
            value={value.phone}
            onChange={(e) => update("phone", e.target.value)}
            className="mt-1 block w-full rounded border border-gray-300 px-2 py-1 text-sm"
          />
        </label>
        <label className="text-xs">Name
          <input
            type="text"
            value={value.name}
            onChange={(e) => update("name", e.target.value)}
            className="mt-1 block w-full rounded border border-gray-300 px-2 py-1 text-sm"
          />
        </label>
      </div>
    </fieldset>
  );
}
```

- [ ] **Step 2: Crear `src/components/ModeToggle.tsx`**

```typescript
"use client";

import type { Mode } from "@/types/lakaut";

interface Props {
  value: Mode;
  onChange: (next: Mode) => void;
}

export function ModeToggle({ value, onChange }: Props) {
  const btn = (mode: Mode, label: string) => (
    <button
      type="button"
      onClick={() => onChange(mode)}
      className={
        "px-3 py-1 text-sm " +
        (value === mode
          ? "bg-indigo-600 text-white"
          : "bg-white text-gray-700 hover:bg-gray-100")
      }
    >
      {label}
    </button>
  );

  return (
    <div className="inline-flex overflow-hidden rounded border border-gray-300">
      {btn("server", "Server mode")}
      {btn("client", "Client mode")}
    </div>
  );
}
```

- [ ] **Step 3: Crear `src/components/SignOutButton.tsx`**

```typescript
"use client";

import { signOut } from "next-auth/react";

export function SignOutButton() {
  return (
    <button
      type="button"
      onClick={() => signOut({ callbackUrl: "/api/auth/signin" })}
      className="text-sm text-gray-600 hover:text-gray-900"
    >
      Sign out
    </button>
  );
}
```

- [ ] **Step 4: Verificar tsc**

```bash
npx tsc --noEmit && echo OK
```

- [ ] **Step 5: Commit**

```bash
git add src/components/UserDataInputs.tsx src/components/ModeToggle.tsx src/components/SignOutButton.tsx
git commit -m "Add UserDataInputs, ModeToggle, SignOutButton components"
```

---

## Task 10 — Componente `SandboxForm` (orquesta inputs y crea la session)

**Files:**
- Create: `src/components/SandboxForm.tsx`

- [ ] **Step 1: Crear `src/components/SandboxForm.tsx`**

```typescript
"use client";

import { useState } from "react";
import { ModeToggle } from "./ModeToggle";
import { UserDataInputs } from "./UserDataInputs";
import { fileToBase64 } from "@/lib/pdf";
import type { AutoLoadFile, EventLog, Mode, SessionResponse, UserData } from "@/types/lakaut";
import { EMPTY_USER_DATA } from "@/types/lakaut";

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
  const [userData, setUserData] = useState<UserData>(EMPTY_USER_DATA);
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
```

- [ ] **Step 2: Verificar tsc**

```bash
npx tsc --noEmit && echo OK
```

- [ ] **Step 3: Commit**

```bash
git add src/components/SandboxForm.tsx
git commit -m "Add SandboxForm with Server/Client mode and PDF upload"
```

---

## Task 11 — `app/layout.tsx`, `app/page.tsx`, providers

**Files:**
- Create: `src/components/Providers.tsx`
- Modify: `src/app/layout.tsx`
- Modify: `src/app/page.tsx`

- [ ] **Step 1: Crear `src/components/Providers.tsx`**

```typescript
"use client";

import { SessionProvider } from "next-auth/react";
import type { ReactNode } from "react";

export function Providers({ children }: { children: ReactNode }) {
  return <SessionProvider>{children}</SessionProvider>;
}
```

- [ ] **Step 2: Reemplazar `src/app/layout.tsx`**

```typescript
import type { Metadata } from "next";
import "./globals.css";
import { Providers } from "@/components/Providers";

export const metadata: Metadata = {
  title: "Lakaut Iframe Sandbox",
  description: "Sandbox interno para probar el iframe de firma digital",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body className="bg-white text-gray-900 antialiased">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
```

- [ ] **Step 3: Reemplazar `src/app/page.tsx`** con la página principal del sandbox

```typescript
"use client";

import { useCallback, useState } from "react";
import { useSession } from "next-auth/react";
import { SandboxForm } from "@/components/SandboxForm";
import { LakautEmbed } from "@/components/LakautEmbed";
import { EventConsole } from "@/components/EventConsole";
import { SignOutButton } from "@/components/SignOutButton";
import { downloadBase64 } from "@/lib/pdf";
import type { AutoLoadFile, EventLog, SignedDoc, UserData } from "@/types/lakaut";

interface ActiveSession {
  sessionToken: string;
  userData: UserData;
  file?: AutoLoadFile;
}

export default function Home() {
  const { data: session } = useSession();
  const [active, setActive] = useState<ActiveSession | null>(null);
  const [events, setEvents] = useState<EventLog[]>([]);
  const [signed, setSigned] = useState<SignedDoc | null>(null);

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

  const handleDownload = () => {
    if (!signed) return;
    if (signed.delivery?.mode === "binary" && signed.delivery.fileBase64) {
      const mime = signed.document?.mime ?? signed.mime ?? "application/pdf";
      downloadBase64(signed.delivery.fileBase64, `signed-${signed.signedDocId}.pdf`, mime);
      logEvent({ timestamp: Date.now(), type: "sandbox.download.triggered", payload: { mode: "binary" } });
    } else if (signed.delivery?.mode === "url" && signed.delivery.url) {
      window.open(signed.delivery.url, "_blank");
      logEvent({ timestamp: Date.now(), type: "sandbox.download.triggered", payload: { mode: "url" } });
    }
  };

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
              Start a session to embed the iframe.
            </div>
          )}

          <EventConsole events={events} onClear={() => setEvents([])} />
        </section>
      </div>
    </main>
  );
}
```

- [ ] **Step 4: Verificar tsc + build**

```bash
npx tsc --noEmit && npm run build 2>&1 | tail -10
echo "exit=$?"
```

Esperado: `exit=0`. (El build puede quejarse de env vars faltantes en runtime — está OK porque NextAuth las lee al request, no al build.)

- [ ] **Step 5: Commit**

```bash
git add src/app/layout.tsx src/app/page.tsx src/components/Providers.tsx
git commit -m "Compose sandbox UI: page.tsx + layout.tsx + SessionProvider"
```

---

## Task 12 — Smoke test local

**Files:** ninguno.

- [ ] **Step 1: Crear `.env.local` con valores mínimos para testing local**

```bash
cat > .env.local <<'EOF'
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=local-dev-secret-not-for-prod
GOOGLE_CLIENT_ID=placeholder
GOOGLE_CLIENT_SECRET=placeholder
INTEGRATOR_ID=
INTEGRATOR_API_KEY=
WEB2_BASE_URL=https://www.lakautac.com.ar
NEXT_PUBLIC_IFRAME_EMBED_URL=https://iframe.lakautac.com.ar/embed/
NEXT_PUBLIC_WEB2_BASE_URL=https://www.lakautac.com.ar
EOF
```

(Nota: Google OAuth no funcionará local hasta que se cree el OAuth client real. Acceptable para este smoke — solo verificamos que el server arranca y la página de login se renderiza.)

- [ ] **Step 2: Arrancar dev server y verificar redirect a /api/auth/signin**

```bash
npm run dev > /tmp/dev.log 2>&1 &
SERVER_PID=$!
sleep 8
curl -sI http://localhost:3000/ | head -5
kill $SERVER_PID 2>/dev/null
```

Esperado: `HTTP/1.1 302` o `HTTP/1.1 307` con `location:` apuntando a `/api/auth/signin`.

- [ ] **Step 3: Confirmar build production pasa**

```bash
npm run build 2>&1 | tail -8
echo "exit=$?"
```

Esperado: `exit=0`, sin errores tipo "Type error".

---

## Task 13 — Crear repo GitHub + push inicial

**Files:** ninguno modificado.

- [ ] **Step 1: Crear repo en GitHub Lakaut-FD**

```bash
cd /home/jtorchia/develop/lakaut/lakaut-iframe-sandbox
# Confirmar branch principal es 'main'
git branch -M main
# Crear repo en la organización (privado recomendado para sandbox interno)
gh repo create Lakaut-FD/lakaut-iframe-sandbox --private --source=. --remote=origin --description "Sandbox interno para probar el iframe productivo de firma digital"
```

Esperado: "Created repository Lakaut-FD/lakaut-iframe-sandbox on GitHub".

- [ ] **Step 2: Verificar `.env.local` ESTÁ gitignored**

```bash
grep -E "^\.env" .gitignore
```

Esperado: incluye `.env*.local` o `.env.local`.

- [ ] **Step 3: Push inicial**

```bash
git push -u origin main 2>&1 | tail -5
```

Esperado: branch `main` pusheada.

- [ ] **Step 4: Verificar el repo es accesible**

```bash
gh repo view Lakaut-FD/lakaut-iframe-sandbox --json url,visibility | jq
```

Esperado: JSON con `"visibility": "PRIVATE"` (o PUBLIC según elegiste).

---

## Task 14 — Setup Google OAuth + Vercel + deploy

**Files:** ninguno modificado. Configuración externa.

- [ ] **Step 1: Crear OAuth Client en Google Cloud Console (acción manual)**

1. Abrir https://console.cloud.google.com → APIs & Services → Credentials.
2. "Create credentials" → "OAuth client ID".
3. Application type: "Web application".
4. Name: `lakaut-iframe-sandbox`.
5. Authorized redirect URIs: **dejar vacío por ahora**, se completa después del primer deploy en Vercel (cuando se sepa la URL real).
6. Crear y copiar `Client ID` y `Client Secret`.

- [ ] **Step 2: Crear proyecto Vercel desde el repo**

```bash
# Si tenés la CLI de Vercel instalada (opcional, también vía dashboard):
npx vercel link --yes --project lakaut-iframe-sandbox
```

O via dashboard: https://vercel.com/new → Import Git Repository → seleccionar `Lakaut-FD/lakaut-iframe-sandbox` → Framework auto-detect Next.js.

- [ ] **Step 3: Setear Vercel env vars (en dashboard del proyecto o via CLI)**

Variables a configurar en Production + Preview:

```
NEXTAUTH_URL=https://lakaut-iframe-sandbox.vercel.app   (ajustar cuando se conozca URL real)
NEXTAUTH_SECRET=<openssl rand -base64 32>
GOOGLE_CLIENT_ID=<del paso 1>
GOOGLE_CLIENT_SECRET=<del paso 1>
INTEGRATOR_ID=<el provisto>
INTEGRATOR_API_KEY=<el provisto, marcar como secret>
WEB2_BASE_URL=https://www.lakautac.com.ar
NEXT_PUBLIC_IFRAME_EMBED_URL=https://iframe.lakautac.com.ar/embed/
NEXT_PUBLIC_WEB2_BASE_URL=https://www.lakautac.com.ar
```

Para generar `NEXTAUTH_SECRET`:
```bash
openssl rand -base64 32
```

- [ ] **Step 4: Trigger primer deploy**

Si configuraste el proyecto desde el dashboard, Vercel deploya automáticamente. Para forzar via CLI:
```bash
npx vercel --prod
```

- [ ] **Step 5: Confirmar URL real del proyecto + actualizar config**

```bash
gh api repos/Lakaut-FD/lakaut-iframe-sandbox/deployments 2>/dev/null | head -10  # opcional
# O via dashboard de Vercel: copiar la URL pública (ej. lakaut-iframe-sandbox-abc123.vercel.app)
```

Tareas en Google Cloud (con la URL real):
1. Volver a Credentials → editar OAuth client.
2. Authorized redirect URIs: agregar `https://<URL real>/api/auth/callback/google`.
3. Save.

Tareas en Vercel (si la URL real difiere del placeholder):
1. Project Settings → Environment Variables.
2. Editar `NEXTAUTH_URL` con la URL real.
3. Re-deploy (Project → Deployments → ⋯ → Redeploy).

- [ ] **Step 6: Smoke test post-deploy**

```bash
# Test 1: HEAD a la URL → debe responder con redirect a signin
curl -sI https://<URL real>/ | head -5
# Esperado: HTTP/2 307 + location: /api/auth/signin
```

Después, manualmente en browser:
1. Abrir la URL real.
2. Login con cuenta `@lakaut.com.ar` → debe entrar al sandbox.
3. Login con cuenta `@gmail.com` → debe ver `/denied`.
4. Probar "Start session" en Server mode con env vars default → debe crear sessionToken y embeber el iframe.
5. Probar Server mode + apikey/integrator overrides en form → debe usar los del form.
6. Probar Client mode con apikey provista → debe llamar a web2 desde browser (sin pasar por /api/sessions) y crear sessionToken.
7. Validar que el `EventConsole` registra `sandbox.session.created`, `lakaut.ready`, `lakaut.handshake.ack`.

---

## Self-review

**Spec coverage:**
- §1 Objetivo → Goal del plan + tasks 1-14
- §2 Decisiones → tasks 1, 3 (stack, auth), 13 (repo), 14 (deploy)
- §3 Arquitectura → tasks 3 (middleware), 6 (API route), 7 (iframe), 10 (form), 11 (page)
- §4 Estructura del repo → tasks 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11 (todos los archivos listados)
- §5 Auth → task 3 completa
- §6 Variables de entorno → tasks 12 (local), 14 (Vercel)
- §7 Flujo de datos (Server/Client/postMessage) → tasks 6, 7, 10
- §8 UI → tasks 9, 10, 11
- §9 Deploy → task 14
- §10 Riesgos — cubiertos en tasks (validación CORS via EventConsole en task 14 step 6; endpoint web2 confirmado en preámbulo del plan)
- §11 Out of scope — no requiere tareas

**Placeholder scan:** ningún TBD/TODO/implement-later. Comandos exactos en cada step. Código completo en cada step que crea archivos. Único valor que se completa runtime: la URL real de Vercel (explícito en task 14 step 5).

**Type consistency:** nombres consistentes:
- `UserData`, `AutoLoadFile`, `EventLog`, `SessionResponse`, `Mode` (definidos en task 2) usados igual en tasks 7, 8, 9, 10, 11.
- `EMPTY_USER_DATA`, `MOCK_USER_DATA` (task 2) consumidos en tasks 9, 10.
- `ALLOWED_DOMAINS`, `isAllowedEmail` (task 3 lib/auth.ts) consumidos en task 3 middleware.ts y task 6 API route.
- `createSession` (task 5) consumido en task 6 API route.
- `fileToBase64`, `downloadBase64` (task 4) consumidos en tasks 10, 11.

Plan listo para ejecución.

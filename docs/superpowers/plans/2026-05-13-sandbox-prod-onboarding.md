# Sandbox Prod Onboarding Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Re-encuadrar el sandbox como herramienta de firma productiva: onboarding `/onboarding` con disclaimer + perfil persistente en Vercel KV (cross-device) + main page auto-cargando el iframe + debug tools detrás de toggle "Modo dev".

**Architecture:** Nueva ruta `/onboarding` gated por middleware NextAuth. Profile persiste en Vercel KV con key `profile:<email>`. Main page usa SWR para fetchear el profile; si no existe redirige a onboarding; si existe auto-arranca la session con apikey de env y embebe el iframe. Debug tools (Mode toggle, override credenciales, EventConsole) viven en un drawer lateral activable.

**Tech Stack:** Next.js 16 App Router, TypeScript, Tailwind v4, NextAuth v4, **Vercel KV (nuevo)**, **SWR (nuevo)**, **zod (nuevo)**.

**Working directory:** `/home/jtorchia/develop/lakaut/lakaut-iframe-sandbox`.

**Branch base:** `main` (post-PR #2 merged).

**Nota sobre commits:** El usuario maneja sus propios commits — los steps de commit son sugerencias. El ejecutor debe pedir confirmación o dejar staged según prefiera el usuario.

**Referencia:** [Spec](../specs/2026-05-13-sandbox-prod-onboarding-design.md)

**Node PATH gotcha:** El zsh nvm está roto en el shell. ALWAYS:
```bash
export PATH=/home/jtorchia/.nvm/versions/node/v22.22.0/bin:$PATH
```

---

## Task 1 — Crear branch + instalar deps

**Files:** ninguno modificado en código fuente. Cambia `package.json` y `package-lock.json` por las deps nuevas.

- [ ] **Step 1: Crear branch desde main**

```bash
cd /home/jtorchia/develop/lakaut/lakaut-iframe-sandbox
git fetch --all -q
git checkout main && git pull --ff-only
git checkout -b feature/prod-onboarding-profile
```

- [ ] **Step 2: Instalar deps nuevas**

```bash
export PATH=/home/jtorchia/.nvm/versions/node/v22.22.0/bin:$PATH
npm install @vercel/kv swr zod
```

Esperado: 3 packages added. `package.json` muestra:
- `@vercel/kv` (~^3 o ^4)
- `swr` (~^2)
- `zod` (~^3 o ^4)

- [ ] **Step 3: Verificar build pasa**

```bash
export PATH=/home/jtorchia/.nvm/versions/node/v22.22.0/bin:$PATH
npm run build 2>&1 | tail -8
```

Esperado: exit 0, sin errores nuevos.

- [ ] **Step 4: Commit**

```bash
git add package.json package-lock.json
git commit -m "Add @vercel/kv, swr, zod deps for profile persistence"
```

---

## Task 2 — Actualizar tipos compartidos

**Files:**
- Modify: `src/types/lakaut.ts`

- [ ] **Step 1: Reemplazar contenido de `src/types/lakaut.ts`**

Nuevo contenido completo:

```typescript
export type Gender = "M" | "F" | "X";

/**
 * UserData según docu oficial del iframe.
 * Required: email, gender, phone. Either dni o cuil (al menos uno).
 * Optional: dni, cuil, name, address.
 */
export interface UserData {
  dni?: string;
  cuil?: string;
  email: string;
  gender: Gender;
  phone: string;
  name?: string;
  address?: string;
}

/**
 * Profile persistido en Vercel KV por usuario (key: `profile:<email>`).
 * El sandbox lo crea durante onboarding y lo usa para llenar el `userData`
 * que se manda al iframe en cada session.
 */
export interface UserProfile {
  email: string;        // mismo del Google login; también es la KV key
  name?: string;
  dni?: string;
  cuil?: string;
  gender: Gender;
  phone: string;
  createdAt: string;    // ISO 8601
  updatedAt: string;
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

/**
 * Response de web2 `/api/integration/session/new`.
 * El campo se llama `tokenSession` (confirmado contra lakautac-web2).
 */
export interface SessionResponse {
  tokenSession: string;
  validUntil?: string;
}
```

(Eliminamos `EMPTY_USER_DATA` y `MOCK_USER_DATA` porque ahora los datos vienen del KV, no son mock.)

- [ ] **Step 2: Verificar tsc**

```bash
export PATH=/home/jtorchia/.nvm/versions/node/v22.22.0/bin:$PATH
npx tsc --noEmit 2>&1 | head -20
```

Esperado: errores por usos de `EMPTY_USER_DATA` y `MOCK_USER_DATA` en `page.tsx` y `SandboxForm.tsx`/`UserDataInputs.tsx` (esos archivos se reescriben en tasks posteriores; los errores se resuelven después). **No commitear todavía** — el repo queda en estado broken hasta Task 12 + cleanup en Task 13.

- [ ] **Step 3: Stage (sin commit aún)**

```bash
git add src/types/lakaut.ts
```

(El commit lo hace Task 13 una vez que cleanup elimine los archivos viejos.)

---

## Task 3 — Schema zod del profile

**Files:**
- Create: `src/lib/profile-schema.ts`

- [ ] **Step 1: Crear el archivo**

```typescript
import { z } from "zod";

export const GenderSchema = z.enum(["M", "F", "X"]);

export const ProfileInputSchema = z
  .object({
    email: z.string().email(),
    name: z.string().max(100).optional(),
    dni: z
      .string()
      .regex(/^\d{7,8}$/, "DNI debe ser 7-8 dígitos")
      .optional()
      .or(z.literal("").transform(() => undefined)),
    cuil: z
      .string()
      .regex(/^\d{2}-?\d{8}-?\d$/, "CUIL formato XX-XXXXXXXX-X o 11 dígitos")
      .optional()
      .or(z.literal("").transform(() => undefined)),
    gender: GenderSchema,
    phone: z.string().regex(/^\d{10}$/, "Teléfono: 10 dígitos sin 0 ni 15"),
  })
  .refine((data) => Boolean(data.dni) || Boolean(data.cuil), {
    message: "Debe especificar DNI o CUIL (al menos uno)",
    path: ["dni"],
  });

export type ProfileInput = z.infer<typeof ProfileInputSchema>;
```

- [ ] **Step 2: Verificar tsc**

```bash
export PATH=/home/jtorchia/.nvm/versions/node/v22.22.0/bin:$PATH
npx tsc --noEmit 2>&1 | grep "profile-schema" | head -5 ; echo "exit=$?"
```

Esperado: sin errores sobre `profile-schema.ts`.

- [ ] **Step 3: Stage**

```bash
git add src/lib/profile-schema.ts
```

---

## Task 4 — Wrapper de Vercel KV

**Files:**
- Create: `src/lib/kv.ts`

- [ ] **Step 1: Crear el archivo**

```typescript
import { kv } from "@vercel/kv";
import type { UserProfile } from "@/types/lakaut";

function key(email: string): string {
  return `profile:${email.toLowerCase()}`;
}

export async function getProfile(email: string): Promise<UserProfile | null> {
  const value = await kv.get<UserProfile>(key(email));
  return value ?? null;
}

export async function setProfile(profile: UserProfile): Promise<void> {
  await kv.set(key(profile.email), profile);
}

export async function deleteProfile(email: string): Promise<void> {
  await kv.del(key(email));
}
```

- [ ] **Step 2: Verificar tsc**

```bash
export PATH=/home/jtorchia/.nvm/versions/node/v22.22.0/bin:$PATH
npx tsc --noEmit 2>&1 | grep "kv.ts" | head -5 ; echo "exit=$?"
```

Esperado: sin errores sobre `kv.ts`.

- [ ] **Step 3: Stage**

```bash
git add src/lib/kv.ts
```

---

## Task 5 — API route `/api/profile` (GET / POST / DELETE)

**Files:**
- Create: `src/app/api/profile/route.ts`

- [ ] **Step 1: Crear el archivo**

```typescript
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions, isAllowedEmail } from "@/lib/auth";
import { ProfileInputSchema } from "@/lib/profile-schema";
import { deleteProfile, getProfile, setProfile } from "@/lib/kv";
import type { UserProfile } from "@/types/lakaut";

async function authorizedEmail(): Promise<string | null> {
  const session = await getServerSession(authOptions);
  const email = session?.user?.email ?? "";
  if (!isAllowedEmail(email)) return null;
  return email;
}

export async function GET() {
  const email = await authorizedEmail();
  if (!email) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const profile = await getProfile(email);
  return NextResponse.json(profile);
}

export async function POST(req: Request) {
  const email = await authorizedEmail();
  if (!email) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  // Forzar email del session (no del body)
  const candidate = { ...(body as Record<string, unknown>), email };
  const parsed = ProfileInputSchema.safeParse(candidate);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const now = new Date().toISOString();
  const existing = await getProfile(email);
  const profile: UserProfile = {
    ...parsed.data,
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
  };

  await setProfile(profile);
  return NextResponse.json(profile);
}

export async function DELETE() {
  const email = await authorizedEmail();
  if (!email) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  await deleteProfile(email);
  return NextResponse.json({ deleted: true });
}
```

- [ ] **Step 2: Verificar tsc**

```bash
export PATH=/home/jtorchia/.nvm/versions/node/v22.22.0/bin:$PATH
npx tsc --noEmit 2>&1 | grep "profile/route" | head -5 ; echo "exit=$?"
```

Esperado: sin errores sobre el route.

- [ ] **Step 3: Stage**

```bash
git add src/app/api/profile/route.ts
```

---

## Task 6 — Component `ProfileForm`

**Files:**
- Create: `src/components/ProfileForm.tsx`

- [ ] **Step 1: Crear el archivo**

```typescript
"use client";

import { useState } from "react";
import { ProfileInputSchema, type ProfileInput } from "@/lib/profile-schema";
import type { Gender } from "@/types/lakaut";

interface Props {
  initial: Partial<ProfileInput>;
  emailLocked: boolean;
  requireConsent: boolean;
  submitLabel: string;
  onSubmit: (input: ProfileInput) => Promise<void>;
}

export function ProfileForm({ initial, emailLocked, requireConsent, submitLabel, onSubmit }: Props) {
  const [email, setEmail] = useState(initial.email ?? "");
  const [name, setName] = useState(initial.name ?? "");
  const [dni, setDni] = useState(initial.dni ?? "");
  const [cuil, setCuil] = useState(initial.cuil ?? "");
  const [gender, setGender] = useState<Gender>(initial.gender ?? "M");
  const [phone, setPhone] = useState(initial.phone ?? "");
  const [consent, setConsent] = useState(!requireConsent);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const candidate = {
      email,
      name: name || undefined,
      dni: dni || undefined,
      cuil: cuil || undefined,
      gender,
      phone,
    };

    const parsed = ProfileInputSchema.safeParse(candidate);
    if (!parsed.success) {
      const first = parsed.error.issues[0];
      setError(first ? `${first.path.join(".") || "form"}: ${first.message}` : "Validación falló");
      return;
    }

    if (requireConsent && !consent) {
      setError("Marcá el checkbox de consentimiento");
      return;
    }

    setSubmitting(true);
    try {
      await onSubmit(parsed.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <label className="block text-sm">
        <span className="font-medium">Email</span>
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          readOnly={emailLocked}
          className={
            "mt-1 block w-full rounded border border-gray-300 px-2 py-1 text-sm " +
            (emailLocked ? "bg-gray-100 text-gray-600" : "")
          }
        />
        {emailLocked && (
          <span className="mt-1 text-xs text-gray-500">Email del login Google — no editable.</span>
        )}
      </label>

      <label className="block text-sm">
        <span className="font-medium">Nombre</span>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="mt-1 block w-full rounded border border-gray-300 px-2 py-1 text-sm"
        />
      </label>

      <div className="grid grid-cols-2 gap-3">
        <label className="block text-sm">
          <span className="font-medium">DNI <span className="text-gray-500 font-normal">(o CUIL)</span></span>
          <input
            type="text"
            value={dni}
            onChange={(e) => setDni(e.target.value.replace(/\D/g, ""))}
            placeholder="30000000"
            className="mt-1 block w-full rounded border border-gray-300 px-2 py-1 text-sm"
          />
        </label>
        <label className="block text-sm">
          <span className="font-medium">CUIL <span className="text-gray-500 font-normal">(o DNI)</span></span>
          <input
            type="text"
            value={cuil}
            onChange={(e) => setCuil(e.target.value)}
            placeholder="20-30000000-9"
            className="mt-1 block w-full rounded border border-gray-300 px-2 py-1 text-sm"
          />
        </label>
      </div>

      <fieldset className="space-y-1 text-sm">
        <legend className="font-medium">Género</legend>
        <div className="flex gap-4 text-sm">
          {(["M", "F", "X"] as Gender[]).map((g) => (
            <label key={g} className="inline-flex items-center gap-1">
              <input
                type="radio"
                name="gender"
                value={g}
                checked={gender === g}
                onChange={() => setGender(g)}
              />
              {g}
            </label>
          ))}
        </div>
      </fieldset>

      <label className="block text-sm">
        <span className="font-medium">Teléfono</span>
        <input
          type="tel"
          value={phone}
          onChange={(e) => setPhone(e.target.value.replace(/\D/g, ""))}
          placeholder="1122334455"
          maxLength={10}
          className="mt-1 block w-full rounded border border-gray-300 px-2 py-1 text-sm"
        />
        <span className="mt-1 text-xs text-gray-500">10 dígitos sin 0 ni 15 (formato AR).</span>
      </label>

      {requireConsent && (
        <label className="flex items-start gap-2 rounded border border-amber-300 bg-amber-50 p-3 text-sm">
          <input
            type="checkbox"
            checked={consent}
            onChange={(e) => setConsent(e.target.checked)}
            className="mt-0.5"
          />
          <span>
            Entiendo que el sandbox crea firmas digitales <strong>reales en producción</strong> y
            que mis datos quedan asociados a cada firma.
          </span>
        </label>
      )}

      {error && <p className="text-sm text-red-600">{error}</p>}

      <button
        type="submit"
        disabled={submitting}
        className="w-full rounded bg-indigo-600 px-3 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:bg-indigo-300"
      >
        {submitting ? "Guardando..." : submitLabel}
      </button>
    </form>
  );
}
```

- [ ] **Step 2: Verificar tsc**

```bash
export PATH=/home/jtorchia/.nvm/versions/node/v22.22.0/bin:$PATH
npx tsc --noEmit 2>&1 | grep ProfileForm | head -5 ; echo "exit=$?"
```

Esperado: sin errores sobre ProfileForm.

- [ ] **Step 3: Stage**

```bash
git add src/components/ProfileForm.tsx
```

---

## Task 7 — Página `/onboarding`

**Files:**
- Create: `src/app/onboarding/page.tsx`

- [ ] **Step 1: Crear el archivo**

```typescript
"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import useSWR from "swr";
import { ProfileForm } from "@/components/ProfileForm";
import { SignOutButton } from "@/components/SignOutButton";
import type { UserProfile } from "@/types/lakaut";
import type { ProfileInput } from "@/lib/profile-schema";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

export default function OnboardingPage() {
  const router = useRouter();
  const { data: session, status: sessionStatus } = useSession();
  const { data: profile, mutate, isLoading } = useSWR<UserProfile | null>("/api/profile", fetcher);
  const [isEditMode, setIsEditMode] = useState(false);

  useEffect(() => {
    if (profile) setIsEditMode(true);
  }, [profile]);

  if (sessionStatus !== "authenticated" || isLoading) {
    return <main className="flex min-h-screen items-center justify-center text-sm text-gray-500">Cargando...</main>;
  }

  const submitProfile = async (input: ProfileInput) => {
    const res = await fetch("/api/profile", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error((body as { error?: string }).error ?? `HTTP ${res.status}`);
    }
    await mutate();
    router.push("/");
  };

  const initial = profile ?? {
    email: session?.user?.email ?? "",
    name: session?.user?.name ?? "",
  };

  return (
    <main className="mx-auto max-w-2xl px-4 py-8">
      <header className="mb-6 flex items-center justify-between">
        <h1 className="text-xl font-semibold">Lakaut Iframe Sandbox</h1>
        <SignOutButton />
      </header>

      <div className="mb-6">
        <h2 className="text-2xl font-semibold">
          {isEditMode ? "Editar mis datos" : `👋 Bienvenido${session?.user?.name ? ", " + session.user.name : ""}`}
        </h2>
        {!isEditMode && (
          <p className="mt-1 text-sm text-gray-600">
            Antes de empezar, necesitamos tus datos para firmar documentos.
          </p>
        )}
      </div>

      {!isEditMode && (
        <div className="mb-6 rounded border border-red-300 bg-red-50 p-4 text-sm">
          <p className="font-semibold text-red-900">⚠ Esto es producción</p>
          <p className="mt-1 text-red-800">
            El sandbox crea firmas digitales <strong>reales</strong> en prod usando el integrador
            interno de Lakaut. Cada firma consume créditos y queda registrada con tu identidad.
            Asegurate de usar tus datos verdaderos.
          </p>
        </div>
      )}

      <ProfileForm
        initial={initial}
        emailLocked
        requireConsent={!isEditMode}
        submitLabel={isEditMode ? "Guardar cambios" : "Guardar y continuar"}
        onSubmit={submitProfile}
      />
    </main>
  );
}
```

- [ ] **Step 2: Verificar tsc**

```bash
export PATH=/home/jtorchia/.nvm/versions/node/v22.22.0/bin:$PATH
npx tsc --noEmit 2>&1 | grep "onboarding" | head -5 ; echo "exit=$?"
```

Esperado: sin errores sobre onboarding.

- [ ] **Step 3: Stage**

```bash
git add src/app/onboarding/page.tsx
```

---

## Task 8 — Component `ProdBanner`

**Files:**
- Create: `src/components/ProdBanner.tsx`

- [ ] **Step 1: Crear el archivo**

```typescript
export function ProdBanner() {
  return (
    <div className="mb-4 flex items-start gap-2 rounded border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-900">
      <span className="text-base">⚠</span>
      <span>
        <strong>Producción.</strong> Las firmas creadas son reales y quedan asociadas a tu
        identidad. Si solo querés probar, usá preprod.
      </span>
    </div>
  );
}
```

- [ ] **Step 2: Stage**

```bash
git add src/components/ProdBanner.tsx
```

---

## Task 9 — Component `Header`

**Files:**
- Create: `src/components/Header.tsx`

- [ ] **Step 1: Crear el archivo**

```typescript
"use client";

import Link from "next/link";
import { useSession } from "next-auth/react";
import { SignOutButton } from "./SignOutButton";

interface Props {
  devMode: boolean;
  onToggleDevMode: () => void;
}

export function Header({ devMode, onToggleDevMode }: Props) {
  const { data: session } = useSession();
  return (
    <header className="mb-4 flex flex-wrap items-center gap-3 border-b border-gray-200 pb-3">
      <h1 className="text-base font-semibold">Lakaut Iframe Sandbox</h1>
      <span className="rounded bg-amber-100 px-2 py-0.5 text-[10px] font-semibold text-amber-900">⚠ PROD</span>

      <div className="ml-auto flex items-center gap-4 text-sm text-gray-700">
        <span>{session?.user?.email}</span>
        <button
          type="button"
          onClick={onToggleDevMode}
          className={
            "rounded border px-2 py-1 text-xs " +
            (devMode
              ? "border-indigo-600 bg-indigo-50 text-indigo-700"
              : "border-gray-300 text-gray-600 hover:bg-gray-50")
          }
          title="Activar herramientas de debug"
        >
          ⚙ Dev {devMode ? "ON" : "OFF"}
        </button>
        <Link
          href="/onboarding"
          className="rounded border border-gray-300 px-2 py-1 text-xs text-gray-700 hover:bg-gray-50"
        >
          👤 Mis datos
        </Link>
        <SignOutButton />
      </div>
    </header>
  );
}
```

- [ ] **Step 2: Stage**

```bash
git add src/components/Header.tsx
```

---

## Task 10 — Component `DevDrawer`

**Files:**
- Create: `src/components/DevDrawer.tsx`

- [ ] **Step 1: Crear el archivo**

```typescript
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
```

- [ ] **Step 2: Verificar tsc**

```bash
export PATH=/home/jtorchia/.nvm/versions/node/v22.22.0/bin:$PATH
npx tsc --noEmit 2>&1 | grep -i "devdrawer\|dev-drawer" | head -5 ; echo "exit=$?"
```

Esperado: sin errores sobre DevDrawer.

- [ ] **Step 3: Stage**

```bash
git add src/components/DevDrawer.tsx
```

---

## Task 11 — Update `Providers` con SWRConfig

**Files:**
- Modify: `src/components/Providers.tsx`

- [ ] **Step 1: Sobrescribir el archivo**

```typescript
"use client";

import { SessionProvider } from "next-auth/react";
import { SWRConfig } from "swr";
import type { ReactNode } from "react";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

export function Providers({ children }: { children: ReactNode }) {
  return (
    <SessionProvider>
      <SWRConfig value={{ fetcher, revalidateOnFocus: false }}>
        {children}
      </SWRConfig>
    </SessionProvider>
  );
}
```

- [ ] **Step 2: Stage**

```bash
git add src/components/Providers.tsx
```

---

## Task 12 — Reescribir `src/app/page.tsx` (main page final)

**Files:**
- Modify: `src/app/page.tsx`

- [ ] **Step 1: Sobrescribir el archivo**

```typescript
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
```

- [ ] **Step 2: Stage**

```bash
git add src/app/page.tsx
```

---

## Task 13 — Cleanup: eliminar archivos obsoletos

**Files:**
- Delete: `src/components/SandboxForm.tsx`
- Delete: `src/components/UserDataInputs.tsx`

- [ ] **Step 1: Eliminar los archivos**

```bash
cd /home/jtorchia/develop/lakaut/lakaut-iframe-sandbox
git rm src/components/SandboxForm.tsx src/components/UserDataInputs.tsx
```

- [ ] **Step 2: Verificar que NO hay referencias residuales**

```bash
grep -rn "SandboxForm\|UserDataInputs\|EMPTY_USER_DATA\|MOCK_USER_DATA" src/ ; echo "exit=$?"
```

Esperado: sin matches. Si grep retorna 1 (no match), correcto.

- [ ] **Step 3: Verificar tsc completo + build**

```bash
export PATH=/home/jtorchia/.nvm/versions/node/v22.22.0/bin:$PATH
npx tsc --noEmit && echo TSC_OK && npm run build 2>&1 | tail -10
```

Esperado: TSC_OK + build exit 0 con las rutas:
- `/`
- `/_not-found`
- `/api/auth/[...nextauth]`
- `/api/profile`
- `/api/sessions`
- `/denied`
- `/onboarding`

- [ ] **Step 4: Commit grande con todos los cambios staged**

```bash
git add -A
git commit -m "Re-encuadre prod: onboarding + perfil persistente Vercel KV + Modo Dev

- New: /onboarding page with disclaimer + ProfileForm + consent checkbox
- New: /api/profile GET/POST/DELETE backed by Vercel KV (key profile:<email>)
- New: ProfileForm, ProdBanner, Header, DevDrawer components
- New: lib/profile-schema.ts (zod validation), lib/kv.ts (KV wrapper)
- Rewrite: src/app/page.tsx — SWR profile, redirect to onboarding if missing,
  auto-load iframe with userData from profile, dev drawer toggle persisted in localStorage
- Remove: SandboxForm, UserDataInputs (replaced by ProfileForm + DevDrawer)
- Remove: EMPTY_USER_DATA, MOCK_USER_DATA constants (no más mock data en prod real)
- Update Providers with SWRConfig
- Deps: add @vercel/kv, swr, zod"
```

---

## Task 14 — Vercel KV setup (acción del usuario)

**Files:** ninguno en repo. Configuración Vercel.

- [ ] **Step 1: Crear KV database en Vercel**

Acción manual del usuario:
1. https://vercel.com → Project `lakaut-iframe-sandbox` → Storage tab.
2. Click "Create Database" → seleccionar "KV (Upstash)".
3. Nombre: `lakaut-iframe-sandbox-profiles` (o el que elijas).
4. Region: la más cercana (por ejemplo Sao Paulo si está disponible para AR; sino US East).
5. Click "Create & Connect" — Vercel asocia automáticamente al proyecto.

Esperado: el KV queda creado y conectado. Vercel inyecta automáticamente env vars al proyecto:
- `KV_REST_API_URL`
- `KV_REST_API_TOKEN`
- `KV_URL`
- `KV_REST_API_READ_ONLY_TOKEN`

- [ ] **Step 2: Verificar env vars en el dashboard**

Project → Settings → Environment Variables → debería aparecer las 4 vars `KV_*` en Production + Preview.

- [ ] **Step 3: Trigger redeploy (necesario para que el código nuevo lea las env vars)**

Project → Deployments → ⋯ (último deployment) → Redeploy.

(Alternativamente: dejarlo para Task 16 que dispara redeploy via push del merge.)

---

## Task 15 — Push + PR

**Files:** ninguno modificado.

- [ ] **Step 1: Push del branch**

```bash
cd /home/jtorchia/develop/lakaut/lakaut-iframe-sandbox
git push -u origin feature/prod-onboarding-profile
```

- [ ] **Step 2: Crear PR**

```bash
gh pr create --base main --head feature/prod-onboarding-profile \
  --title "Sandbox prod re-encuadre: onboarding + perfil persistente Vercel KV + Modo Dev" \
  --body "$(cat <<'EOF'
## Resumen

Re-encuadre del sandbox: ahora es la herramienta de firma productiva del equipo Lakaut (cada firma es REAL y consume créditos del integrador). Cambios principales:

- **Onboarding `/onboarding`**: pantalla con disclaimer rojo + form (email/name/DNI/CUIL/gender/phone) + checkbox de consentimiento.
- **Perfil persistente cross-device**: Vercel KV (Redis). Key `profile:<email>` → \`UserProfile\` JSON.
- **Main page** auto-arranca el iframe con userData del profile. PDF se sube DESDE el iframe (no en el sandbox).
- **Modo Dev** (toggle en header, persistido en localStorage): drawer derecho con Mode toggle Server/Client, override de credenciales, EventConsole. Por defecto OFF.
- **Cleanup**: removidos \`SandboxForm\`, \`UserDataInputs\`, \`EMPTY_USER_DATA\`, \`MOCK_USER_DATA\`.

Ver spec: \`docs/superpowers/specs/2026-05-13-sandbox-prod-onboarding-design.md\`

## Pre-deploy: Vercel KV setup

**Acción manual antes del primer deploy:**

1. Vercel dashboard → Project \`lakaut-iframe-sandbox\` → Storage → Create Database → KV (Upstash).
2. Vercel inyecta automáticamente: \`KV_REST_API_URL\`, \`KV_REST_API_TOKEN\`, \`KV_URL\`.
3. Sin más config necesaria.

## Test plan post-deploy

- [ ] Vercel KV setup completo (env vars KV_* presentes).
- [ ] Auto-deploy verde.
- [ ] Login con \`@lakaut.com.ar\` → primer ingreso redirige a \`/onboarding\` con disclaimer.
- [ ] Completar onboarding (DNI/gender/phone) + checkbox → guarda en KV → redirect a \`/\` → iframe se carga.
- [ ] Recargar \`/\` → no vuelve a onboarding (profile ya existe).
- [ ] Click "👤 Mis datos" → entra a \`/onboarding\` en modo edición (sin checkbox required).
- [ ] Click "⚙ Dev" → drawer aparece con Mode toggle, override fields, EventConsole.
- [ ] Reload → drawer state recuerda (localStorage).
- [ ] Login desde otro browser → profile sigue ahí (cross-device) → no pide onboarding.
- [ ] EventConsole muestra \`sandbox.session.created → lakaut.ready → lakaut.init → lakaut.handshake.ack\`.
EOF
)" 2>&1 | tail -3
```

Esperado: URL del PR impresa.

- [ ] **Step 3: Esperar mergeo del usuario**

(Acción manual.)

---

## Task 16 — Verificación post-deploy

**Files:** ninguno modificado.

- [ ] **Step 1: Confirmar workflow Vercel verde**

Usuario abre https://vercel.com → Project → Deployments → último build = success.

- [ ] **Step 2: Login + onboarding fresh**

(Si el user tenía profile antes, no aplica. Para test fresh: usar otra cuenta Lakaut.)

Steps en browser:
1. Abrir https://lakaut-iframe-sandbox.vercel.app
2. Login con `@lakaut.com.ar`.
3. **Debe redirigir a `/onboarding`**.
4. Verificar disclaimer rojo visible.
5. Tipear DNI (8 dígitos), gender, phone (10 dígitos). Email/name pre-cargados del Google.
6. Marcar checkbox de consentimiento.
7. Click "Guardar y continuar" → debe redirigir a `/`.

- [ ] **Step 3: Iframe carga**

En `/`:
- Header con email + ⚠ PROD + ⚙ Dev + 👤 Mis datos + Sign out.
- Banner amarillo de prod visible.
- Iframe `iframe.lakautac.com.ar/embed/?sessionToken=...` cargado.
- Iframe muestra su propio flow (probablemente pide subir PDF).

- [ ] **Step 4: Reload sin perder estado**

Reload `/` → no vuelve a onboarding. Iframe vuelve a cargarse con session nueva.

- [ ] **Step 5: Dev mode**

Click "⚙ Dev OFF" → drawer aparece a la derecha con Mode toggle, Integrator ID/API Key inputs, EventConsole con eventos previos. Recargar página → drawer sigue abierto.

- [ ] **Step 6: Mis datos**

Click "👤 Mis datos" → entra a `/onboarding` en modo edición:
- Email read-only.
- Resto pre-cargado con valores guardados.
- Sin checkbox de consentimiento.
- "Guardar cambios" → actualiza KV → redirect a `/`.

- [ ] **Step 7: Cross-device**

Abrir https://lakaut-iframe-sandbox.vercel.app en otro browser (incógnito o distinto). Login mismo email. **No debe pedir onboarding** — profile ya está en KV.

---

## Self-review

**Spec coverage:**
- §1 Re-encuadre → Goal del plan + tasks 7, 8, 12
- §2 Decisiones → Tasks 1, 3, 4, 7
- §3 Arquitectura → Task 12 (page.tsx) + Task 5 (API)
- §4 Schema → Task 2 (types) + Task 3 (zod)
- §5 Estructura del repo → Tasks 2-12 + Task 13 (cleanup)
- §6 Páginas y componentes → Task 6 (ProfileForm), Task 7 (onboarding), Task 8 (ProdBanner), Task 9 (Header), Task 10 (DevDrawer), Task 12 (page.tsx)
- §7 API routes → Task 5
- §8 Vercel KV setup → Task 14
- §9 Migraciones → Task 13 (cleanup) + nota explícita en commit message
- §10 Variables de entorno → Task 14
- §11 Riesgos → cubierto en spec, no requiere tasks adicionales
- §12 Out of scope → no requiere tasks

**Placeholder scan:** ningún TBD/TODO. Cada step tiene código completo o comando exacto. Único valor que se completa runtime es el nombre del KV database (usuario elige). Acciones Vercel KV setup (Task 14) son manuales pero con pasos exactos.

**Type consistency:**
- `UserProfile`, `UserData`, `ProfileInput` (zod), `Gender`, `EventLog`, `SessionResponse`, `SignedDoc` definidos en Task 2 + Task 3 y consumidos consistentemente en tasks 4, 5, 6, 7, 10, 12.
- `getProfile`, `setProfile`, `deleteProfile` (Task 4) consumidos en Task 5 API route.
- `ProfileInputSchema` (Task 3) consumido en Task 5 (server) y Task 6 (client).
- `Header` con props `devMode`/`onToggleDevMode` (Task 9) consumido en Task 12 page.tsx.
- `DevDrawer` con props completas (Task 10) consumido en Task 12 page.tsx.

Plan listo para ejecución.

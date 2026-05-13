# Design: Lakaut Iframe Sandbox

Fecha: 2026-05-12
Repositorio: `Lakaut-FD/lakaut-iframe-sandbox` (a crear)
Hosting: Vercel (URL default `*.vercel.app`)

## 1. Objetivo

Sandbox interno para el equipo de ingeniería de Lakaut: emula un integrador real consumiendo el iframe productivo de firma digital (`https://iframe.lakautac.com.ar/embed/`). El equipo lo usa para probar el flujo completo desde la perspectiva de un cliente, validar regresiones, y documentar tanto el patrón server-side como el client-side de integración.

**No aplica:** clientes finales reales, tráfico productivo, persistencia.

## 2. Decisiones

- **Stack**: Next.js (App Router) + TypeScript + Tailwind. Hosting Vercel.
- **Auth**: Auth.js (NextAuth) con Google OAuth. Allowlist por dominio `@lakaut.com.ar` y `@lakaut.com`. Cualquier otro email recibe "denied".
- **URL**: subdominio default de Vercel (`lakaut-iframe-sandbox.vercel.app` o el que asigne Vercel).
- **Documentos**: el usuario sube un PDF desde la UI, se convierte a base64 in-browser y se pasa al iframe via postMessage.
- **Persistencia**: ninguna. Sandbox stateless.
- **Repo**: nuevo, en GitHub `Lakaut-FD/lakaut-iframe-sandbox`.
- **Promotion**: sin `dev/preprod/prod`. Trabajo en `main`, branches feature → PR → merge → Vercel auto-deploya production. Preview deployments por PR.
- **Tests**: ninguno automatizado en fase 1 (sandbox simple, sin lógica de negocio crítica).

## 3. Arquitectura

```
Browser (engineer @lakaut.com.ar)
  │
  │ GET https://lakaut-iframe-sandbox.vercel.app
  ▼
middleware.ts
  │ - NextAuth session válida? + email en allowlist?
  │ - NO → redirect /api/auth/signin
  │ - SÍ → next()
  ▼
src/app/page.tsx (client component)
  - Toggle: Server mode | Client mode
  - Form: integratorId, apiKey (override), userData, PDF
  - Submit:
       Server mode  → POST /api/sessions  (Next.js API route)
       Client mode  → POST directo a web2 con apikey del form
  ▼
Sessión creada → sessionToken
  ▼
<LakautEmbed sessionToken=... userData=... autoLoadFile=... />
  ▼
iframe https://iframe.lakautac.com.ar/embed/
  ▼
postMessage handshake (lakaut.init / lakaut.ready / lakaut.handshake.ack)
  ▼
Engineer firma → lakaut.signature.completed
  ▼
EventConsole loggea todo → Download button activo
```

**Boundaries críticos:**
- `INTEGRATOR_API_KEY` vive **solo en server env**. Nunca `NEXT_PUBLIC_`. En Client mode el usuario pega la apikey manualmente en el form para esa corrida.
- El iframe productivo (`iframe.lakautac.com.ar`) ya permite `frame-ancestors *` y `X-Frame-Options: ALLOWALL` → el sandbox lo embebe sin tocar nada del lado del iframe.
- Sin storage backend, sin BD.

## 4. Estructura del repo

```
lakaut-iframe-sandbox/
├── README.md
├── package.json
├── tsconfig.json
├── next.config.ts
├── tailwind.config.ts
├── postcss.config.mjs
├── .env.example
├── .gitignore
├── eslint.config.mjs
├── middleware.ts                       — gate global auth + email allowlist
└── src/
    ├── app/
    │   ├── layout.tsx                  — shell + SessionProvider
    │   ├── page.tsx                    — pantalla principal (sandbox UI)
    │   ├── denied/page.tsx             — "no autorizado"
    │   ├── globals.css
    │   └── api/
    │       ├── auth/[...nextauth]/route.ts   — config NextAuth
    │       └── sessions/route.ts             — POST: crea sessionToken via web2 (Server mode)
    ├── components/
    │   ├── LakautEmbed.tsx             — iframe + postMessage handshake
    │   ├── EventConsole.tsx            — log de eventos
    │   ├── SandboxForm.tsx             — form completo
    │   ├── UserDataInputs.tsx          — inputs dni/email/gender/phone/name + "Fill mock"
    │   ├── ModeToggle.tsx              — switch Server/Client
    │   └── SignOutButton.tsx
    ├── lib/
    │   ├── auth.ts                     — NextAuth options + ALLOWED_DOMAINS
    │   ├── web2.ts                     — cliente web2 (createSession). Solo server-side.
    │   └── pdf.ts                      — fileToBase64, downloadBase64
    └── types/
        ├── lakaut.ts                   — UserData, AutoLoadFile, EventLog
        └── next-auth.d.ts              — augmenta Session
```

Responsabilidad por archivo:

| Archivo | Single responsibility |
|---|---|
| `middleware.ts` | Bloquear toda ruta excepto `/api/auth/*`, `/denied`, assets si la session NextAuth no es válida o el email no matchea `@lakaut.com[.ar]`. |
| `src/app/api/auth/[...nextauth]/route.ts` | NextAuth: Google provider + `signIn` callback que rechaza emails fuera de los dominios. |
| `src/app/api/sessions/route.ts` | POST. Body `{integratorId?, apiKey?, userData}`. Usa `apiKey` del body si llegó, sino `INTEGRATOR_API_KEY` del server env. Llama a `lib/web2.createSession()`. Retorna `{sessionToken}`. |
| `src/components/SandboxForm.tsx` | Form completo: toggle Mode, override integratorId/apikey opcional, UserData (con "Fill mock"), upload PDF (FileReader → base64). Submit → llama a `/api/sessions` (Server) o `fetch` directo a web2 (Client). Entrega `{sessionToken, userData, file}` al padre. |
| `src/components/LakautEmbed.tsx` | Recibe `{sessionToken, userData, autoLoadFile, onEvent, onSignCompleted}`. Renderiza iframe en altura ≥820px, hace handshake (postMessage `lakaut.init` con reintentos hasta recibir `lakaut.handshake.ack`), forwardea eventos `lakaut.*` al padre. Cleanup correcto en unmount. |
| `src/components/EventConsole.tsx` | Lista cronológica `[{timestamp, type, payload, origin}]`. Cada item expandible para ver JSON full. |
| `src/lib/web2.ts` | `createSession({integratorId, apiKey, userData}) → Promise<{sessionToken}>`. Headers/path del request — **a confirmar contra web2 productivo** (probablemente `POST /api/sessions` con `x-api-key` header; ajustar al implementar). Solo server-side. |
| `src/lib/pdf.ts` | `fileToBase64(File): Promise<string>`, `downloadBase64(base64, filename)`. Browser-only. |

## 5. Auth (NextAuth + Google)

### Config (`src/lib/auth.ts`)

```typescript
import type { NextAuthOptions } from "next-auth";
import GoogleProvider from "next-auth/providers/google";

export const ALLOWED_DOMAINS = ["lakaut.com.ar", "lakaut.com"];

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
      const email = profile?.email ?? "";
      const domain = email.split("@")[1];
      return ALLOWED_DOMAINS.includes(domain);
    },
    async jwt({ token, profile }) {
      if (profile) token.email = profile.email;
      return token;
    },
    async session({ session, token }) {
      if (session.user) session.user.email = token.email as string;
      return session;
    },
  },
  pages: { error: "/denied" },
};
```

### Middleware (`middleware.ts`)

```typescript
import { withAuth } from "next-auth/middleware";
import { ALLOWED_DOMAINS } from "@/lib/auth";

export default withAuth({
  callbacks: {
    authorized: ({ token }) => {
      const email = token?.email as string | undefined;
      if (!email) return false;
      return ALLOWED_DOMAINS.includes(email.split("@")[1]);
    },
  },
  pages: { signIn: "/api/auth/signin", error: "/denied" },
});

export const config = {
  matcher: ["/((?!api/auth|denied|_next/static|_next/image|favicon.ico).*)"],
};
```

### Google Cloud OAuth setup (paso manual una sola vez)

1. https://console.cloud.google.com → APIs & Services → Credentials.
2. Crear "OAuth 2.0 Client ID" tipo "Web application".
3. Authorized redirect URIs: `https://<URL real de Vercel>/api/auth/callback/google`.
4. Copiar Client ID y Client Secret → Vercel env vars.

## 6. Variables de entorno (Vercel)

| Variable | Scope | Valor | Notas |
|---|---|---|---|
| `NEXTAUTH_URL` | Prod + Preview | `https://lakaut-iframe-sandbox.vercel.app` | Ajustar si Vercel asigna otra URL. |
| `NEXTAUTH_SECRET` | Prod + Preview | `<openssl rand -base64 32>` | Vercel puede autogenerar. |
| `GOOGLE_CLIENT_ID` | Prod + Preview | `<del Google Cloud>` | Manual. |
| `GOOGLE_CLIENT_SECRET` | Prod + Preview | `<del Google Cloud>` | Secret. |
| `INTEGRATOR_ID` | Prod + Preview | `<el provisto>` | Default Server mode. |
| `INTEGRATOR_API_KEY` | Prod + Preview | `<el provisto>` | Secret. Nunca `NEXT_PUBLIC_`. |
| `WEB2_BASE_URL` | Prod + Preview | `https://www.lakautac.com.ar` | Server-side. |
| `NEXT_PUBLIC_IFRAME_EMBED_URL` | Prod + Preview | `https://iframe.lakautac.com.ar/embed/` | Public — necesaria en `LakautEmbed`. |
| `NEXT_PUBLIC_WEB2_BASE_URL` | Prod + Preview | `https://www.lakautac.com.ar` | Public — necesaria en Client mode. |

## 7. Flujo de datos

### Server mode

```
Browser
  └─ POST /api/sessions  { integratorId?, apiKey?, userData }
       │
       ▼
  API route (Vercel serverless)
  ├─ Lee body
  ├─ apiKey = body.apiKey ?? process.env.INTEGRATOR_API_KEY
  ├─ integratorId = body.integratorId ?? process.env.INTEGRATOR_ID
  ├─ Llama lib/web2.createSession({integratorId, apiKey, userData})
  └─ Retorna { sessionToken }
       │
       ▼
Browser embebe iframe con sessionToken
```

### Client mode

```
Browser
  ├─ Verifica que apikey está en el form (required)
  ├─ POST https://www.lakautac.com.ar/api/sessions/<...>
  │   headers: x-api-key
  │   body: { integratorId, userData }
  ├─ Loguea response en EventConsole (incluye CORS error si falla)
  └─ Si OK → embebe iframe con sessionToken devuelto
```

**Nota: el endpoint exacto y headers de web2 deben confirmarse contra el código de `lakautac-web2` o el host-example al momento de implementar `lib/web2.ts`.** Si el endpoint resulta diferente al asumido, ajustar y documentar.

### postMessage con iframe (igual al patrón de `host-example`)

```
1. <iframe src={NEXT_PUBLIC_IFRAME_EMBED_URL} />
2. window.addEventListener('message', handler)
3. Al recibir 'lakaut.ready' o 'lakaut.handshake.ack' del iframe origin:
   → iframe.contentWindow.postMessage(
       { type: 'lakaut.init', payload: { sessionToken, userData, autoLoadFile } },
       IFRAME_ORIGIN
     )
4. Reintentar init cada 500ms hasta recibir handshake.ack (cap 10 reintentos)
5. Al recibir 'lakaut.signature.completed' → onSignCompleted(payload)
6. Cleanup: removeEventListener en unmount
```

Eventos registrados en `EventConsole`:

| Evento | Origen |
|---|---|
| `sandbox.session.created` (con `via: server|client`, status, corsError?) | Sandbox |
| `lakaut.ready` | Iframe |
| `lakaut.handshake.ack` | Iframe |
| `lakaut.init` (cuando lo manda el host) | Sandbox |
| `lakaut.signature.completed` | Iframe |
| `sandbox.download.triggered` | Sandbox |

## 8. UI (page.tsx)

Layout single page, post-auth:

- Header: título + email del user + Sign out button.
- Section "Config": Mode toggle, integratorId (placeholder = env default), apiKey (placeholder = env default; required visualmente solo en Client), userData inputs + "Fill mock", PDF picker, "Start session" button.
- Section "Iframe": placeholder hasta que haya `sessionToken`; después renderiza `<LakautEmbed>`.
- Section "Event Console": lista cronológica con expand/collapse de cada payload.
- Footer (después de signature.completed): "Download signed PDF" button.

UI mínima funcional, sin diseño elaborado. Tailwind para spacing y tipografía consistente. Sin tema claro/oscuro toggle (light only en fase 1).

## 9. Deploy (steps de setup)

1. **Repo GitHub** `Lakaut-FD/lakaut-iframe-sandbox` (privado o público — vos decidís).
2. **Google Cloud OAuth client** según §5.
3. **Vercel project**:
   - Import desde GitHub.
   - Framework: Next.js (auto-detect).
   - Env vars: las 9 de §6.
   - Deploy.
4. **Después del primer deploy**: si la URL real difiere, actualizar `NEXTAUTH_URL` y el redirect URI de Google OAuth.
5. **Smoke test**: abrir URL → login con `@lakaut.com.ar` → debe entrar; login con `@gmail.com` → debe ver `/denied`.

## 10. Riesgos y mitigaciones

| Riesgo | Mitigación |
|---|---|
| Endpoint real de web2 para crear sessions difiere del asumido | Confirmar contra `lakautac-web2` o `host-example` al implementar `lib/web2.ts`. Si difiere, ajustar y documentar. |
| Web2 prod no tiene CORS habilitado para `*.vercel.app` → Client mode falla | **Es feature, no bug.** El EventConsole muestra el error CORS, lo cual es el valor del Client mode (documentar si funciona). |
| Apikey de integrador en env de Vercel se filtra | Solo accesible server-side. Sin variantes `NEXT_PUBLIC_`. Vercel marca como Secret en UI. |
| User logueado con cuenta `@lakaut.com.ar` que no debería tener acceso | Aceptable: el sandbox no toca prod activamente, solo prueba flujos. Si en el futuro se necesita restricción más fina, agregar lista explícita en `lib/auth.ts`. |
| Vercel asigna URL distinta a `lakaut-iframe-sandbox.vercel.app` | Ajustar `NEXTAUTH_URL` + redirect URI Google después del primer deploy. |

## 11. Out of scope

- Persistencia de pruebas históricas (logs, sessions previas).
- Tests automatizados (E2E con Playwright, etc.) — puede sumarse en fase 2 si el sandbox justifica.
- Theming (dark mode).
- i18n.
- Multi-integrator presets (lista de configuraciones guardadas).
- Migración del `host-example` del repo iframe a este sandbox.
- IP allowlist o protecciones extra.
- Telemetría/analytics.

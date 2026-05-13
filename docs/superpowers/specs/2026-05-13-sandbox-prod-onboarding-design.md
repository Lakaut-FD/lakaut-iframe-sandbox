# Design: Sandbox como herramienta de firma productiva (onboarding + perfil persistente)

Fecha: 2026-05-13
Repositorio: `Lakaut-FD/lakaut-iframe-sandbox`
Hosting: Vercel

## 1. Re-encuadre del producto

El sandbox dejó de ser solamente "una herramienta para mirar el iframe": ahora es la app que el equipo de Lakaut usa para **crear firmas digitales reales en producción** con su propia identidad. Cada firma consume créditos del integrador interno y queda asociada a la persona que la realizó (DNI/CUIL del firmante).

Implicancias:
- Los datos personales (DNI, CUIL, gender, phone, name) deben ser **datos verdaderos del usuario**, no mock.
- El producto debe dejar **clarísimo que es producción** y obtener un consentimiento explícito antes del primer uso.
- Los datos deben **persistir cross-device** (cambiar de browser/máquina no implica re-onboarding).
- Las herramientas de debug (Mode toggle, override de credenciales, EventConsole) son útiles pero secundarias — viven detrás de un toggle "Modo desarrollador".

## 2. Decisiones

- **Persistencia**: Vercel KV (Redis gestionado). Una key `profile:<email>` por usuario. Free tier suficiente.
- **Onboarding**: página dedicada `/onboarding` con disclaimer + form + checkbox de consentimiento.
- **Auto-load del iframe**: sí. El integrador no cobra por crear `sessionToken`, solo por completar firma → seguro auto-arrancar.
- **PDF**: lo sube el usuario DESDE el iframe (UI propia del iframe productivo). El sandbox no maneja PDFs.
- **Debug tools**: ocultos detrás de toggle `⚙ Dev` en el header, persistido en localStorage.
- **Email**: pre-cargado del Google profile, **no editable**. Garantiza consistencia entre login y firma.
- **Name**: pre-cargado del Google profile pero editable (el Google name puede no matchear el legal name).

## 3. Arquitectura

```
Browser
  │  GET https://lakaut-iframe-sandbox.vercel.app/
  ▼
middleware.ts (NextAuth)
  │  ¿JWT válido + email @lakaut.com[.ar]?
  │  NO → /api/auth/signin (Google OAuth)
  │  SÍ → next()
  ▼
src/app/page.tsx (client component)
  │  useSWR("/api/profile") → fetch del perfil desde KV
  │
  ├ profile == null → router.push("/onboarding")
  └ profile válido ↓
  ▼
Auto-fetch /api/sessions con body {}
  │  → server llama a web2 con apikey de env
  │  → devuelve { tokenSession }
  ▼
<LakautEmbed sessionToken=... userData=profile />
  │  → iframe con ?sessionToken=... + postMessage init
  ▼
Iframe productivo (iframe.lakautac.com.ar/embed/)
  │  → user sube PDF, firma, etc.
  ▼
lakaut.signature.completed → "Download signed PDF" button visible
```

**Storage server-side:**

- Vercel KV con key `profile:<email>` → value JSON `UserProfile`.
- `/api/profile` GET/POST/DELETE, todos gated por NextAuth session + email allowlist.

**Modo Dev (opcional, lateral):**

- Drawer derecho con `ModeToggle`, override de `integratorId`/`apiKey`, `EventConsole`, botón "Recargar con overrides".
- Persistido en `localStorage.devMode` (preferencia por device).

## 4. Schema

### UserProfile (TS interface + zod schema)

```typescript
interface UserProfile {
  email: string;        // same as Google login email; is also the KV key
  name?: string;
  dni?: string;         // 7-8 dígitos numéricos
  cuil?: string;        // formato XX-XXXXXXXX-X o 11 dígitos
  gender: "M" | "F" | "X";
  phone: string;        // 10 dígitos, sin 0 ni 15 (formato Argentina)
  createdAt: string;    // ISO 8601
  updatedAt: string;    // ISO 8601
}
```

Validación (zod, server + client):
- `email`: required, debe matchear `session.user.email`.
- `gender`: required.
- `phone`: required, regex `^\d{10}$`.
- `dni` o `cuil`: **al menos uno requerido** (refine zod).
- `dni`: si presente, regex `^\d{7,8}$`.
- `cuil`: si presente, regex `^\d{2}-?\d{8}-?\d$`.
- `name`: opcional, max 100 chars.

## 5. Estructura del repo (cambios)

```
src/
├── app/
│   ├── page.tsx                    [reescribir]
│   ├── onboarding/
│   │   └── page.tsx                [NUEVO]
│   └── api/
│       ├── profile/
│       │   └── route.ts            [NUEVO: GET/POST/DELETE → Vercel KV]
│       └── sessions/route.ts       [sin cambios]
├── components/
│   ├── LakautEmbed.tsx             [sin cambios]
│   ├── EventConsole.tsx            [sin cambios]
│   ├── ModeToggle.tsx              [sin cambios]
│   ├── SignOutButton.tsx           [sin cambios]
│   ├── DevDrawer.tsx               [NUEVO]
│   ├── ProdBanner.tsx              [NUEVO]
│   ├── ProfileForm.tsx             [NUEVO]
│   ├── Header.tsx                  [NUEVO]
│   ├── Providers.tsx               [modificar: agregar SWRConfig]
│   ├── SandboxForm.tsx             [eliminar — su contenido se redistribuye]
│   └── UserDataInputs.tsx          [eliminar — reemplazado por ProfileForm]
├── lib/
│   ├── auth.ts                     [sin cambios]
│   ├── kv.ts                       [NUEVO]
│   ├── pdf.ts                      [eliminar fileToBase64; mantener downloadBase64]
│   ├── profile-schema.ts           [NUEVO: zod schemas]
│   └── web2.ts                     [sin cambios]
└── types/
    ├── lakaut.ts                   [agregar UserProfile + remover EMPTY/MOCK USER_DATA]
    └── next-auth.d.ts              [sin cambios]
```

**Deps nuevas:**

```bash
npm install @vercel/kv swr zod
```

## 6. Páginas y componentes

### 6.1 `/onboarding` (`src/app/onboarding/page.tsx`)

Pantalla con:
- Header con email del Google + Sign out button.
- Banner amarillo: "👋 Bienvenido <name>".
- **Disclaimer rojo** prominente: "⚠ PROD — Esto crea firmas reales con tu identidad. Tus datos quedan asociados a cada firma."
- `<ProfileForm>` con email pre-cargado (read-only) y name pre-cargado del Google (editable).
- Checkbox required: "Entiendo que esto crea firmas digitales reales en producción y que mis datos quedan asociados a cada firma."
- Botón "Guardar y continuar" (disabled hasta que el form sea válido + checkbox marcado).
- Submit → POST `/api/profile` → si 200 → `router.push("/")` → SWR refetch del profile → main page se renderiza.

Acceso desde header "👤 Mis datos" → entra en modo edición (profile ya existe, checkbox sigue ahí pero pre-marcado).

### 6.2 `/` (`src/app/page.tsx`)

Pantalla principal post-onboarding:
- `<Header>`: título + email + ⚠ PROD badge + ⚙ Dev toggle + 👤 Mis datos link + Sign out.
- `<ProdBanner>`: línea amarilla/roja "Las firmas creadas son reales y quedan asociadas a tu identidad."
- `<LakautEmbed sessionToken={token} userData={profile}>`: iframe auto-cargado.
- Si `signed` (lakaut.signature.completed recibido) → botón "Download signed PDF" debajo.
- Si `devMode` (localStorage) → `<DevDrawer>` lateral.

Lógica:
1. `useSWR("/api/profile")` → si null → redirect `/onboarding`.
2. Si profile válido → POST `/api/sessions` con body vacío (server usa env vars) → `tokenSession`.
3. Renderiza `<LakautEmbed>` con el `tokenSession` y el `userData` del profile.

### 6.3 `<ProfileForm>` (`src/components/ProfileForm.tsx`)

Reutilizable: onboarding y edición de "Mis datos".

Props:
```typescript
interface Props {
  initialProfile: Partial<UserProfile>;  // viene del KV o del Google
  emailLocked: boolean;                  // true en onboarding (del Google)
  onSubmit: (profile: Omit<UserProfile, "createdAt" | "updatedAt">) => Promise<void>;
  requireConsent: boolean;                // true en onboarding; false en edición
}
```

Campos:
- Email (read-only siempre; viene del Google).
- Name (editable, pre-cargado del Google si no hay name en profile).
- DNI / CUIL (al menos uno; ambos opcionales individualmente).
- Gender (radio M/F/X).
- Phone (10 dígitos).
- Checkbox de consentimiento (solo si `requireConsent`).

Validación: zod schema en `lib/profile-schema.ts`. Client valida en submit (Resolver tipo react-hook-form opcional o validación manual).

### 6.4 `<Header>` (`src/components/Header.tsx`)

```
[Lakaut Iframe Sandbox]  [⚠ PROD]    [user@lakaut.com.ar]  [⚙ Dev]  [👤 Mis datos]  [↩ Sign out]
```

- Title izquierda.
- Badge ⚠ PROD: clickeable abre modal con explicación (opcional, o solo visual).
- Email + dropdown con "Mis datos" + "Sign out", o links separados (simple por ahora).
- ⚙ Dev toggle: `localStorage.devMode` true/false. Cambio dispara re-render para mostrar/ocultar `<DevDrawer>`.

### 6.5 `<ProdBanner>` (`src/components/ProdBanner.tsx`)

Tira horizontal arriba del iframe, color amarillo/naranja con icono ⚠. Texto: "Las firmas creadas son reales y quedan asociadas a tu identidad. Si solo querés probar, usá preprod."

Dismissible? **No** — es importante que siempre esté.

### 6.6 `<DevDrawer>` (`src/components/DevDrawer.tsx`)

Drawer derecho (fixed right, 360px width) con:
- `<ModeToggle>` server/client.
- Override fields: Integrator ID, API Key (password input).
- Botón "Recargar con overrides": crea nueva session con los overrides en lugar de env, recrea `<LakautEmbed>` con esa session.
- `<EventConsole>` events (max-height 400px, scroll).
- Botón "Clear log".

Estado interno: `mode`, `integratorIdOverride`, `apiKeyOverride`. El padre (`page.tsx`) recibe via callback el "nuevo session" cuando se recarga.

## 7. API routes

### 7.1 `GET /api/profile`

Gated por NextAuth + email allowlist.

```typescript
const session = await getServerSession(authOptions);
if (!isAllowedEmail(session?.user?.email)) return 401;

const profile = await kv.get<UserProfile>(`profile:${session.user.email}`);
return NextResponse.json(profile ?? null);
```

### 7.2 `POST /api/profile`

```typescript
const session = await getServerSession(authOptions);
if (!isAllowedEmail(session?.user?.email)) return 401;

const body = await req.json();
const parsed = ProfileSchema.safeParse({ ...body, email: session.user.email });
if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

const now = new Date().toISOString();
const existing = await kv.get<UserProfile>(`profile:${session.user.email}`);
const profile: UserProfile = {
  ...parsed.data,
  createdAt: existing?.createdAt ?? now,
  updatedAt: now,
};

await kv.set(`profile:${session.user.email}`, profile);
return NextResponse.json(profile);
```

### 7.3 `DELETE /api/profile`

Solo borra la key (opcional, para "borrar mis datos" desde el form de edición).

```typescript
await kv.del(`profile:${session.user.email}`);
return NextResponse.json({ deleted: true });
```

## 8. Vercel KV setup

1. Vercel dashboard → Project → Storage → "Create Database" → KV (Upstash Redis).
2. Aceptar el integration prompt; Vercel inyecta automáticamente:
   - `KV_REST_API_URL`
   - `KV_REST_API_TOKEN`
   - `KV_URL`
   - `KV_REST_API_READ_ONLY_TOKEN`
3. Redeploy del proyecto para que las env vars estén disponibles en runtime.
4. Sin config adicional en el código — `@vercel/kv` lee las env vars automáticamente.

## 9. Migraciones desde el estado actual

### 9.1 Código

- Eliminar `SandboxForm.tsx`, `UserDataInputs.tsx`. Su contenido se redistribuye:
  - Inputs DNI/CUIL/gender/phone/name → `ProfileForm.tsx`.
  - ModeToggle + apikey/integratorId override → `DevDrawer.tsx`.
- Eliminar `EMPTY_USER_DATA` y `MOCK_USER_DATA` de `types/lakaut.ts`. Crear `UserProfile` ahí mismo.
- Reescribir `page.tsx` para usar SWR + profile + auto-load.

### 9.2 Estado de usuarios existentes

- Cuando el cambio se mergee, los usuarios actuales del sandbox (con sesión activa) van a ver `/onboarding` la próxima vez que entren (porque `/api/profile` les va a devolver null hasta que completen).
- **Sin migración de datos** — no había datos persistidos antes.

## 10. Variables de entorno

Las que ya existen:
- `NEXTAUTH_URL`, `NEXTAUTH_SECRET`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`.
- `INTEGRATOR_ID`, `INTEGRATOR_API_KEY`.
- `WEB2_BASE_URL`, `NEXT_PUBLIC_IFRAME_EMBED_URL`, `NEXT_PUBLIC_WEB2_BASE_URL`.

Nuevas (inyectadas automáticamente por Vercel KV integration):
- `KV_REST_API_URL`
- `KV_REST_API_TOKEN`
- `KV_URL`

## 11. Riesgos y mitigaciones

| Riesgo | Mitigación |
|---|---|
| Usuario completa onboarding con datos falsos (DNI inventado) | El iframe valida identidad contra RENAPER/Veriff al firmar — si los datos no corresponden a una persona real, la firma falla. Sandbox no puede prevenirlo del todo, pero el disclaimer + email del Google reduce el riesgo. |
| Vercel KV free tier se agota | 30k comandos/mes es ~1000 lecturas/día. Sandbox interno usado por equipo Lakaut (~20 personas) no se acerca al límite. Si sucede, upgrade a paid tier ($1/mes los primeros 1GB). |
| Cambio cross-device pero el user borra el KV record desde otra session | Aceptable — el user re-onboarda. Es UX feature, no bug. |
| Datos personales en KV: cumplimiento normativo (LPDP) | Datos guardados son los mismos que el iframe productivo recibe en cada firma (no son "nuevos" en términos de exposición). Mismo perfil de privacidad que el integrador productivo. KV está en Vercel (EU/US datacenter según config) — acordar con compliance si aplica. |
| Email/Name del Google profile no matchean lo legal | Email es no editable (consistencia con auth). Name es editable. DNI/CUIL son tipeados por el user, son la fuente de verdad para identidad. |

## 12. Out of scope

- Multi-tenant (varios integradores por user).
- Histórico de firmas hechas (audit log).
- Edición batch / import CSV.
- Roles/permisos diferenciados (admin vs user).
- Dark mode.
- i18n (inglés/español toggle).
- Email notifications.
- Modo "sandbox preprod" en la misma app (separar prod/preprod requiere otro proyecto Vercel).

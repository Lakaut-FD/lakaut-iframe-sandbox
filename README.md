# Lakaut Iframe Sandbox

Sandbox interno para el equipo de ingeniería: emula un integrador real consumiendo el iframe productivo de firma digital (`https://iframe.lakautac.com.ar/embed/`).

Solo accesible con login Google de un email `@lakaut.com.ar` o `@lakaut.com`.

## Local dev

1. `cp .env.example .env.local` y completar las vars.
2. `npm install`
3. `npm run dev` → http://localhost:3000

Google OAuth no va a funcionar local hasta que se cree el OAuth client real y se setee `GOOGLE_CLIENT_ID`/`GOOGLE_CLIENT_SECRET`.

## Deploy

Vercel (Next.js auto-detect). Env vars en el dashboard de Vercel.

Ver `docs/superpowers/specs/2026-05-12-iframe-sandbox-design.md` para detalles.

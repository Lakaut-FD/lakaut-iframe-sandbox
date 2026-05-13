export default function DeniedPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-zinc-50 px-4">
      <div className="max-w-md rounded-lg border border-zinc-200 bg-white p-8 text-center shadow-sm">
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-red-50">
          <svg className="h-6 w-6 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
          </svg>
        </div>
        <h1 className="mb-2 text-xl font-semibold tracking-tight text-zinc-900">Acceso denegado</h1>
        <p className="mb-6 text-sm text-zinc-600">
          Solo emails <code className="font-mono text-zinc-900">@lakaut.com.ar</code> o{" "}
          <code className="font-mono text-zinc-900">@lakaut.com</code> pueden acceder al sandbox.
        </p>
        <a
          href="/api/auth/signin"
          className="inline-flex items-center justify-center rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-zinc-800"
        >
          Probar con otra cuenta
        </a>
      </div>
    </main>
  );
}

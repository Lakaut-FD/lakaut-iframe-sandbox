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

"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import useSWR from "swr";
import { ProfileForm } from "@/components/ProfileForm";
import { SignOutButton } from "@/components/SignOutButton";
import type { UserProfile } from "@/types/lakaut";
import type { ProfileInput } from "@/lib/profile-schema";

export default function OnboardingPage() {
  const router = useRouter();
  const { data: session, status: sessionStatus } = useSession();
  const { data: profile, mutate, isLoading } = useSWR<UserProfile | null>("/api/profile");
  const [isEditMode, setIsEditMode] = useState(false);

  useEffect(() => {
    if (profile) setIsEditMode(true);
  }, [profile]);

  if (sessionStatus !== "authenticated" || isLoading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-zinc-50 text-sm text-zinc-500">
        Cargando...
      </main>
    );
  }

  const submitProfile = async (input: ProfileInput) => {
    const res = await fetch("/api/profile", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({} as Record<string, unknown>));
      const errVal = (body as { error?: unknown }).error;
      const msg =
        typeof errVal === "string"
          ? errVal
          : errVal
          ? JSON.stringify(errVal)
          : `HTTP ${res.status}`;
      throw new Error(msg);
    }
    await mutate();
    router.push("/");
  };

  const initial = profile ?? {
    email: session?.user?.email ?? "",
    name: session?.user?.name ?? "",
  };

  return (
    <main className="min-h-screen bg-zinc-50">
      <div className="mx-auto max-w-2xl px-4 py-10">
        <header className="mb-8 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h1 className="text-sm font-semibold tracking-tight text-zinc-900">
              Lakaut Iframe Sandbox
            </h1>
            <span className="inline-flex items-center gap-1 rounded-full border border-amber-300 bg-amber-50 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-amber-800">
              <span>●</span>
              PROD
            </span>
          </div>
          <SignOutButton />
        </header>

        <div className="rounded-lg border border-zinc-200 bg-white p-8 shadow-sm">
          <div className="mb-6">
            <h2 className="text-2xl font-semibold tracking-tight text-zinc-900">
              {isEditMode
                ? "Editar mis datos"
                : `Bienvenido${session?.user?.name ? `, ${session.user.name}` : ""}`}
            </h2>
            {!isEditMode && (
              <p className="mt-2 text-sm text-zinc-600">
                Antes de empezar, necesitamos tus datos reales. Se usan para firmar cada documento.
              </p>
            )}
          </div>

          {!isEditMode && (
            <div className="mb-6 rounded-md border border-red-200 bg-red-50 p-4">
              <p className="flex items-center gap-2 text-sm font-semibold text-red-900">
                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-red-200 text-xs">
                  !
                </span>
                Esto es producción
              </p>
              <p className="mt-2 text-sm text-red-800">
                Cada firma consume créditos del integrador y queda registrada con tu identidad.
                Usá tus datos verdaderos: el iframe va a validar tu DNI contra RENAPER.
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
        </div>
      </div>
    </main>
  );
}

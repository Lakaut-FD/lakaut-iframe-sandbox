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
    return <main className="flex min-h-screen items-center justify-center text-sm text-gray-500">Cargando...</main>;
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

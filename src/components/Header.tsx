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

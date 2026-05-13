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
    <header className="sticky top-0 z-10 mb-6 -mx-4 flex flex-wrap items-center gap-3 border-b border-zinc-200 bg-white/95 px-4 py-3 backdrop-blur">
      <div className="flex items-center gap-3">
        <h1 className="text-sm font-semibold tracking-tight text-zinc-900">
          Lakaut Iframe Sandbox
        </h1>
        <span className="inline-flex items-center gap-1 rounded-full border border-amber-300 bg-amber-50 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-amber-800">
          <span>●</span>
          PROD
        </span>
      </div>

      <div className="ml-auto flex items-center gap-2 text-sm">
        <span className="hidden text-zinc-500 sm:inline">{session?.user?.email}</span>
        <button
          type="button"
          onClick={onToggleDevMode}
          className={
            "rounded-md border px-2.5 py-1.5 text-xs font-medium transition-colors " +
            (devMode
              ? "border-zinc-900 bg-zinc-900 text-white hover:bg-zinc-800"
              : "border-zinc-300 bg-white text-zinc-700 hover:bg-zinc-50")
          }
          title="Activar herramientas de debug"
        >
          Dev {devMode ? "·" : ""} {devMode ? "ON" : "OFF"}
        </button>
        <Link
          href="/onboarding"
          className="rounded-md border border-zinc-300 bg-white px-2.5 py-1.5 text-xs font-medium text-zinc-700 transition-colors hover:bg-zinc-50"
        >
          Mis datos
        </Link>
        <SignOutButton />
      </div>
    </header>
  );
}

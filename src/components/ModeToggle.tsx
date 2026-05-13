"use client";

import type { Mode } from "@/types/lakaut";

interface Props {
  value: Mode;
  onChange: (next: Mode) => void;
}

export function ModeToggle({ value, onChange }: Props) {
  const btn = (mode: Mode, label: string) => (
    <button
      type="button"
      onClick={() => onChange(mode)}
      className={
        "px-3 py-1.5 text-xs font-medium transition-colors " +
        (value === mode
          ? "bg-zinc-900 text-white"
          : "bg-white text-zinc-700 hover:bg-zinc-100")
      }
    >
      {label}
    </button>
  );

  return (
    <div className="inline-flex overflow-hidden rounded-md border border-zinc-300">
      {btn("server", "Server")}
      {btn("client", "Client")}
    </div>
  );
}

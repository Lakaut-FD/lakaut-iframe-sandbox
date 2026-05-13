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
        "px-3 py-1 text-sm " +
        (value === mode
          ? "bg-indigo-600 text-white"
          : "bg-white text-gray-700 hover:bg-gray-100")
      }
    >
      {label}
    </button>
  );

  return (
    <div className="inline-flex overflow-hidden rounded border border-gray-300">
      {btn("server", "Server mode")}
      {btn("client", "Client mode")}
    </div>
  );
}

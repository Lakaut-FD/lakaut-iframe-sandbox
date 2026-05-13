"use client";

import { useState } from "react";
import { ProfileInputSchema, type ProfileInput } from "@/lib/profile-schema";
import type { Gender } from "@/types/lakaut";

interface Props {
  initial: Partial<ProfileInput>;
  emailLocked: boolean;
  requireConsent: boolean;
  submitLabel: string;
  onSubmit: (input: ProfileInput) => Promise<void>;
}

const inputBase =
  "mt-1 block w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 placeholder:text-zinc-400 focus:border-zinc-900 focus:outline-none focus:ring-1 focus:ring-zinc-900 disabled:bg-zinc-50";

export function ProfileForm({
  initial,
  emailLocked,
  requireConsent,
  submitLabel,
  onSubmit,
}: Props) {
  const [email, setEmail] = useState(initial.email ?? "");
  const [name, setName] = useState(initial.name ?? "");
  const [dni, setDni] = useState(initial.dni ?? "");
  const [gender, setGender] = useState<Gender>(initial.gender ?? "M");
  const [phone, setPhone] = useState(initial.phone ?? "");
  const [consent, setConsent] = useState(!requireConsent);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const candidate = {
      email,
      name: name || undefined,
      dni,
      gender,
      phone,
    };

    const parsed = ProfileInputSchema.safeParse(candidate);
    if (!parsed.success) {
      const first = parsed.error.issues[0];
      setError(
        first ? `${first.path.join(".") || "form"}: ${first.message}` : "Validación falló"
      );
      return;
    }

    if (requireConsent && !consent) {
      setError("Marcá el checkbox de consentimiento.");
      return;
    }

    setSubmitting(true);
    try {
      await onSubmit(parsed.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div>
        <label className="block text-sm font-medium text-zinc-900">Email</label>
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          readOnly={emailLocked}
          className={inputBase}
        />
        {emailLocked && (
          <p className="mt-1 text-xs text-zinc-500">Del login Google — no editable.</p>
        )}
      </div>

      <div>
        <label className="block text-sm font-medium text-zinc-900">Nombre</label>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className={inputBase}
          placeholder="Juan Pérez"
        />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <label className="block text-sm font-medium text-zinc-900">DNI</label>
          <input
            type="text"
            value={dni}
            onChange={(e) => setDni(e.target.value.replace(/\D/g, ""))}
            placeholder="30000000"
            maxLength={8}
            className={inputBase + " font-mono"}
          />
          <p className="mt-1 text-xs text-zinc-500">7 u 8 dígitos, sin puntos.</p>
        </div>

        <div>
          <label className="block text-sm font-medium text-zinc-900">Género</label>
          <div className="mt-1 inline-flex overflow-hidden rounded-md border border-zinc-300">
            {(["M", "F", "X"] as Gender[]).map((g) => (
              <button
                key={g}
                type="button"
                onClick={() => setGender(g)}
                className={
                  "px-4 py-2 text-sm transition-colors " +
                  (gender === g
                    ? "bg-zinc-900 text-white"
                    : "bg-white text-zinc-700 hover:bg-zinc-100")
                }
              >
                {g}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-zinc-900">Teléfono</label>
        <input
          type="tel"
          value={phone}
          onChange={(e) => setPhone(e.target.value.replace(/\D/g, ""))}
          placeholder="1122334455"
          maxLength={10}
          className={inputBase + " font-mono"}
        />
        <p className="mt-1 text-xs text-zinc-500">10 dígitos sin 0 ni 15 (formato AR).</p>
      </div>

      {requireConsent && (
        <label className="flex cursor-pointer items-start gap-3 rounded-md border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          <input
            type="checkbox"
            checked={consent}
            onChange={(e) => setConsent(e.target.checked)}
            className="mt-0.5 h-4 w-4 rounded border-amber-400 text-zinc-900 focus:ring-zinc-900"
          />
          <span>
            Entiendo que el sandbox crea firmas digitales <strong>reales en producción</strong>{" "}
            y que mis datos quedan asociados a cada firma.
          </span>
        </label>
      )}

      {error && (
        <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </div>
      )}

      <button
        type="submit"
        disabled={submitting}
        className="w-full rounded-md bg-zinc-900 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-zinc-800 disabled:bg-zinc-400 disabled:cursor-not-allowed"
      >
        {submitting ? "Guardando..." : submitLabel}
      </button>
    </form>
  );
}

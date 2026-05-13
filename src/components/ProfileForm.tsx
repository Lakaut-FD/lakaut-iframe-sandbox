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

export function ProfileForm({ initial, emailLocked, requireConsent, submitLabel, onSubmit }: Props) {
  const [email, setEmail] = useState(initial.email ?? "");
  const [name, setName] = useState(initial.name ?? "");
  const [dni, setDni] = useState(initial.dni ?? "");
  const [cuil, setCuil] = useState(initial.cuil ?? "");
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
      dni: dni || undefined,
      cuil: cuil || undefined,
      gender,
      phone,
    };

    const parsed = ProfileInputSchema.safeParse(candidate);
    if (!parsed.success) {
      const first = parsed.error.issues[0];
      setError(first ? `${first.path.join(".") || "form"}: ${first.message}` : "Validación falló");
      return;
    }

    if (requireConsent && !consent) {
      setError("Marcá el checkbox de consentimiento");
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
    <form onSubmit={handleSubmit} className="space-y-4">
      <label className="block text-sm">
        <span className="font-medium">Email</span>
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          readOnly={emailLocked}
          className={
            "mt-1 block w-full rounded border border-gray-300 px-2 py-1 text-sm " +
            (emailLocked ? "bg-gray-100 text-gray-600" : "")
          }
        />
        {emailLocked && (
          <span className="mt-1 text-xs text-gray-500">Email del login Google — no editable.</span>
        )}
      </label>

      <label className="block text-sm">
        <span className="font-medium">Nombre</span>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="mt-1 block w-full rounded border border-gray-300 px-2 py-1 text-sm"
        />
      </label>

      <div className="grid grid-cols-2 gap-3">
        <label className="block text-sm">
          <span className="font-medium">DNI <span className="text-gray-500 font-normal">(o CUIL)</span></span>
          <input
            type="text"
            value={dni}
            onChange={(e) => setDni(e.target.value.replace(/\D/g, ""))}
            placeholder="30000000"
            className="mt-1 block w-full rounded border border-gray-300 px-2 py-1 text-sm"
          />
        </label>
        <label className="block text-sm">
          <span className="font-medium">CUIL <span className="text-gray-500 font-normal">(o DNI)</span></span>
          <input
            type="text"
            value={cuil}
            onChange={(e) => setCuil(e.target.value)}
            placeholder="20-30000000-9"
            className="mt-1 block w-full rounded border border-gray-300 px-2 py-1 text-sm"
          />
        </label>
      </div>

      <fieldset className="space-y-1 text-sm">
        <legend className="font-medium">Género</legend>
        <div className="flex gap-4 text-sm">
          {(["M", "F", "X"] as Gender[]).map((g) => (
            <label key={g} className="inline-flex items-center gap-1">
              <input
                type="radio"
                name="gender"
                value={g}
                checked={gender === g}
                onChange={() => setGender(g)}
              />
              {g}
            </label>
          ))}
        </div>
      </fieldset>

      <label className="block text-sm">
        <span className="font-medium">Teléfono</span>
        <input
          type="tel"
          value={phone}
          onChange={(e) => setPhone(e.target.value.replace(/\D/g, ""))}
          placeholder="1122334455"
          maxLength={10}
          className="mt-1 block w-full rounded border border-gray-300 px-2 py-1 text-sm"
        />
        <span className="mt-1 text-xs text-gray-500">10 dígitos sin 0 ni 15 (formato AR).</span>
      </label>

      {requireConsent && (
        <label className="flex items-start gap-2 rounded border border-amber-300 bg-amber-50 p-3 text-sm">
          <input
            type="checkbox"
            checked={consent}
            onChange={(e) => setConsent(e.target.checked)}
            className="mt-0.5"
          />
          <span>
            Entiendo que el sandbox crea firmas digitales <strong>reales en producción</strong> y
            que mis datos quedan asociados a cada firma.
          </span>
        </label>
      )}

      {error && <p className="text-sm text-red-600">{error}</p>}

      <button
        type="submit"
        disabled={submitting}
        className="w-full rounded bg-indigo-600 px-3 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:bg-indigo-300"
      >
        {submitting ? "Guardando..." : submitLabel}
      </button>
    </form>
  );
}

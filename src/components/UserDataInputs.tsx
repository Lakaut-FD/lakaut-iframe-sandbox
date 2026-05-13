"use client";

import type { Gender, UserData } from "@/types/lakaut";
import { MOCK_USER_DATA } from "@/types/lakaut";

interface Props {
  value: UserData;
  onChange: (next: UserData) => void;
}

export function UserDataInputs({ value, onChange }: Props) {
  const update = <K extends keyof UserData>(key: K, v: UserData[K]) => {
    onChange({ ...value, [key]: v });
  };

  return (
    <fieldset className="space-y-2">
      <legend className="flex items-center justify-between w-full text-sm font-medium">
        <span>User data</span>
        <button
          type="button"
          onClick={() => onChange(MOCK_USER_DATA)}
          className="text-xs text-indigo-600 hover:underline"
        >
          Fill mock
        </button>
      </legend>

      <div className="grid grid-cols-2 gap-2">
        <label className="text-xs">DNI <span className="text-gray-400">(opc)</span>
          <input
            type="text"
            value={value.dni ?? ""}
            onChange={(e) => update("dni", e.target.value)}
            className="mt-1 block w-full rounded border border-gray-300 px-2 py-1 text-sm"
          />
        </label>
        <label className="text-xs">CUIL <span className="text-gray-400">(opc)</span>
          <input
            type="text"
            value={value.cuil ?? ""}
            onChange={(e) => update("cuil", e.target.value)}
            placeholder="20-12345678-9"
            className="mt-1 block w-full rounded border border-gray-300 px-2 py-1 text-sm"
          />
        </label>
        <label className="text-xs col-span-2">Email <span className="text-red-600">*</span>
          <input
            type="email"
            value={value.email}
            onChange={(e) => update("email", e.target.value)}
            className="mt-1 block w-full rounded border border-gray-300 px-2 py-1 text-sm"
          />
        </label>
        <label className="text-xs">Gender <span className="text-red-600">*</span>
          <select
            value={value.gender}
            onChange={(e) => update("gender", e.target.value as Gender)}
            className="mt-1 block w-full rounded border border-gray-300 px-2 py-1 text-sm"
          >
            <option value="M">M</option>
            <option value="F">F</option>
            <option value="X">X</option>
          </select>
        </label>
        <label className="text-xs">Phone <span className="text-red-600">*</span>
          <input
            type="tel"
            value={value.phone}
            onChange={(e) => update("phone", e.target.value)}
            placeholder="10 dígitos"
            className="mt-1 block w-full rounded border border-gray-300 px-2 py-1 text-sm"
          />
        </label>
        <label className="text-xs">Name <span className="text-gray-400">(opc)</span>
          <input
            type="text"
            value={value.name ?? ""}
            onChange={(e) => update("name", e.target.value)}
            className="mt-1 block w-full rounded border border-gray-300 px-2 py-1 text-sm"
          />
        </label>
        <label className="text-xs col-span-2">Address <span className="text-gray-400">(opc)</span>
          <input
            type="text"
            value={value.address ?? ""}
            onChange={(e) => update("address", e.target.value)}
            className="mt-1 block w-full rounded border border-gray-300 px-2 py-1 text-sm"
          />
        </label>
      </div>
      <p className="text-[10px] text-gray-500">Requeridos: email, gender, phone. Opcional: dni o cuil (alguno o ambos), name, address.</p>
    </fieldset>
  );
}

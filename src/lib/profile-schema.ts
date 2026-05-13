import { z } from "zod";

export const GenderSchema = z.enum(["M", "F", "X"]);

export const ProfileInputSchema = z.object({
  email: z.string().email(),
  name: z.string().max(100).optional(),
  dni: z.string().regex(/^\d{7,8}$/, "DNI debe ser 7 u 8 dígitos"),
  gender: GenderSchema,
  phone: z.string().regex(/^\d{10}$/, "Teléfono: 10 dígitos sin 0 ni 15"),
});

export type ProfileInput = z.infer<typeof ProfileInputSchema>;

import { z } from "zod";

export const GenderSchema = z.enum(["M", "F", "X"]);

export const ProfileInputSchema = z
  .object({
    email: z.string().email(),
    name: z.string().max(100).optional(),
    dni: z
      .string()
      .regex(/^\d{7,8}$/, "DNI debe ser 7-8 dígitos")
      .optional()
      .or(z.literal("").transform(() => undefined)),
    cuil: z
      .string()
      .regex(/^\d{2}-?\d{8}-?\d$/, "CUIL formato XX-XXXXXXXX-X o 11 dígitos")
      .optional()
      .or(z.literal("").transform(() => undefined)),
    gender: GenderSchema,
    phone: z.string().regex(/^\d{10}$/, "Teléfono: 10 dígitos sin 0 ni 15"),
  })
  .refine((data) => Boolean(data.dni) || Boolean(data.cuil), {
    message: "Debe especificar DNI o CUIL (al menos uno)",
    path: ["dni"],
  });

export type ProfileInput = z.infer<typeof ProfileInputSchema>;

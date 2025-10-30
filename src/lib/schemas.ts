import { z } from "zod";

export const SignupSchema = z.object({
  email: z.string().email({ message: "Invalid email" }).toLowerCase(),
  password: z
    .string()
    .min(8, { message: "Password must be at least 8 characters" })
    .regex(/^(?=.*[A-Za-z])(?=.*\d).+$/, {
      message: "Password must include letters and numbers",
    }),
  role: z.enum(["creator", "brand"]),
});

export const LoginSchema = z.object({
  email: z.string().email({ message: "Invalid email" }).toLowerCase(),
  password: z.string().min(1),
});

export const CompleteProfileSchema = z.object({
  name: z.string().min(1, { message: "Name is required" }),
  role: z.enum(["creator", "brand"]).optional(),
  // Optional additional fields by role
  bio: z.string().max(500).optional(),
  website: z.string().url().optional(),
});

export type SignupInput = z.infer<typeof SignupSchema>;
export type LoginInput = z.infer<typeof LoginSchema>;
export type CompleteProfileInput = z.infer<typeof CompleteProfileSchema>;



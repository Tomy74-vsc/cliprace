import { z } from "zod";

import {
  EmailSchema,
  PasswordSchema,
  SafeRedirectSchema,
  LoginSchema,
  SignupRoleEnum,
  SignupStep1Schema,
  SignupStep3CreatorSchema,
  SignupStep3BrandSchema,
  type Email,
  type Password,
  type SafeRedirect,
  type LoginInput,
  type SignupStep1Input,
  type SignupStep3CreatorInput,
  type SignupStep3BrandInput,
} from "@/lib/auth/schemas";

export {
  EmailSchema,
  PasswordSchema,
  SafeRedirectSchema,
  LoginSchema,
  SignupRoleEnum,
  SignupStep1Schema,
  SignupStep3CreatorSchema,
  SignupStep3BrandSchema,
};

export type {
  Email,
  Password,
  SafeRedirect,
  LoginInput,
  SignupStep1Input,
  SignupStep3CreatorInput,
  SignupStep3BrandInput,
};

/** @deprecated Utilisez SignupStep1Schema */
export const SignupSchema = SignupStep1Schema;
/** @deprecated Utilisez SignupStep1Input */
export type SignupInput = SignupStep1Input;

export const ForgotPasswordSchema = z.object({
  email: EmailSchema,
});
export type ForgotPasswordInput = z.infer<typeof ForgotPasswordSchema>;

export const ResetPasswordSchema = z
  .object({
    password: PasswordSchema,
    confirmPassword: z.string().min(1, "La confirmation du mot de passe est requise"),
  })
  .superRefine((data, ctx) => {
    if (data.password !== data.confirmPassword) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Les mots de passe ne correspondent pas",
        path: ["confirmPassword"],
      });
    }
  });
export type ResetPasswordInput = z.infer<typeof ResetPasswordSchema>;

export const CheckEmailSchema = z.object({
  email: EmailSchema,
});
export type CheckEmailInput = z.infer<typeof CheckEmailSchema>;

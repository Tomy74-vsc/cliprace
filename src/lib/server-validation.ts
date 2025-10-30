import { z } from "zod";
import { NextRequest } from "next/server";

import {
  LoginSchema,
  SignupStep1Schema,
  SignupStep3BrandSchema,
  SignupStep3CreatorSchema,
} from "@/lib/auth/schemas";

export const signupSchema = SignupStep1Schema;
export const loginSchema = LoginSchema;
export const creatorProfileSchema = SignupStep3CreatorSchema;
export const brandProfileSchema = SignupStep3BrandSchema;
export const profileSchema = SignupStep3CreatorSchema.pick({
  name: true,
  description: true,
  website: true,
  country: true,
});

export async function validateRequestData<T>(
  req: NextRequest,
  schema: z.ZodSchema<T>,
): Promise<{
  success: boolean;
  data?: T;
  errors?: Record<string, string[]>;
  error?: string;
}> {
  try {
    const body = await req.json();
    const result = schema.safeParse(body);

    if (!result.success) {
      const errors: Record<string, string[]> = {};

      result.error.issues.forEach((issue) => {
        const path = issue.path.join(".");
        if (!errors[path]) {
          errors[path] = [];
        }
        errors[path].push(issue.message);
      });

      return {
        success: false,
        errors,
      };
    }

    return {
      success: true,
      data: result.data,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Erreur de validation",
    };
  }
}

export function validateHeaders(req: NextRequest, requiredHeaders: string[]): {
  success: boolean;
  missing?: string[];
} {
  const missing: string[] = [];

  for (const header of requiredHeaders) {
    if (!req.headers.get(header)) {
      missing.push(header);
    }
  }

  if (missing.length > 0) {
    return {
      success: false,
      missing,
    };
  }

  return {
    success: true,
  };
}

export function sanitizeInput(input: string): string {
  return input
    .trim()
    .replace(/[<>]/g, "")
    .replace(/javascript:/gi, "")
    .replace(/on\w+=/gi, "");
}

export function validateFileSize(file: File, maxSizeMB: number): boolean {
  if (!file || typeof file.size !== "number") {
    return false;
  }
  const maxSizeBytes = maxSizeMB * 1024 * 1024;
  return file.size <= maxSizeBytes;
}

export function validateFileType(file: File, allowedTypes: string[]): boolean {
  if (!file || !file.type || !Array.isArray(allowedTypes)) {
    return false;
  }
  return allowedTypes.includes(file.type);
}

export function validateFormData(
  formData: FormData,
  schema: z.ZodSchema<unknown>,
  knownKeys: string[] = [],
): {
  success: boolean;
  data?: unknown;
  errors?: Record<string, string[]>;
} {
  try {
    const data: Record<string, unknown> = {};

    for (const key of knownKeys) {
      const value = formData.get(key);
      if (value !== null) {
        data[key] = value;
      }
    }

    const result = schema.safeParse(data);

    if (!result.success) {
      const errors: Record<string, string[]> = {};

      result.error.issues.forEach((issue) => {
        const path = issue.path.join(".");
        if (!errors[path]) {
          errors[path] = [];
        }
        errors[path].push(issue.message);
      });

      return {
        success: false,
        errors,
      };
    }

    return {
      success: true,
      data: result.data,
    };
  } catch {
    return {
      success: false,
      errors: { general: ["Erreur lors de la validation des donnees"] },
    };
  }
}

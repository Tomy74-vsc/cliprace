/**
 * Tests unitaires pour les schémas de validation d'authentification
 */

import { describe, it, expect } from 'vitest';
import {
  EmailSchema,
  PasswordSchema,
  LoginSchema,
  SignupSchema,
  ForgotPasswordSchema,
  ResetPasswordSchema,
} from '@/lib/validation/auth';

describe('EmailSchema', () => {
  it('should validate a correct email', () => {
    const result = EmailSchema.safeParse('user@example.com');
    expect(result.success).toBe(true);
  });

  it('should normalize email to lowercase', () => {
    const result = EmailSchema.safeParse('User@Example.COM');
    if (result.success) {
      expect(result.data).toBe('user@example.com');
    }
  });

  it('should trim whitespace', () => {
    const result = EmailSchema.safeParse('  user@example.com  ');
    if (result.success) {
      expect(result.data).toBe('user@example.com');
    }
  });

  it('should reject invalid email format', () => {
    const result = EmailSchema.safeParse('invalid-email');
    expect(result.success).toBe(false);
  });

  it('should reject empty email', () => {
    const result = EmailSchema.safeParse('');
    expect(result.success).toBe(false);
  });

  it('should reject email with dangerous characters', () => {
    const result = EmailSchema.safeParse('user<script>@example.com');
    expect(result.success).toBe(false);
  });

  it('should reject temporary email domains', () => {
    const result = EmailSchema.safeParse('user@tempmail.org');
    expect(result.success).toBe(false);
  });

  it('should reject email that is too long', () => {
    const longEmail = 'a'.repeat(250) + '@example.com';
    const result = EmailSchema.safeParse(longEmail);
    expect(result.success).toBe(false);
  });
});

describe('PasswordSchema', () => {
  it('should validate a strong password', () => {
    const result = PasswordSchema.safeParse('MyP@ssw0rd!');
    expect(result.success).toBe(true);
  });

  it('should reject password shorter than 8 characters', () => {
    const result = PasswordSchema.safeParse('Abc1!');
    expect(result.success).toBe(false);
  });

  it('should reject password without lowercase', () => {
    const result = PasswordSchema.safeParse('MYPASSWORD123!');
    expect(result.success).toBe(false);
  });

  it('should reject password without uppercase', () => {
    const result = PasswordSchema.safeParse('mypassword123!');
    expect(result.success).toBe(false);
  });

  it('should reject password without number', () => {
    const result = PasswordSchema.safeParse('MyPassword!');
    expect(result.success).toBe(false);
  });

  it('should reject password without special character', () => {
    const result = PasswordSchema.safeParse('MyPassword123');
    expect(result.success).toBe(false);
  });

  it('should reject common passwords', () => {
    const result = PasswordSchema.safeParse('Password123!');
    expect(result.success).toBe(false);
  });

  it('should reject passwords with repeated characters', () => {
    const result = PasswordSchema.safeParse('Aaa1234567!');
    expect(result.success).toBe(false);
  });

  it('should reject password longer than 128 characters', () => {
    const longPassword = 'A1!' + 'a'.repeat(126);
    const result = PasswordSchema.safeParse(longPassword);
    expect(result.success).toBe(false);
  });
});

describe('LoginSchema', () => {
  it('should validate correct login data', () => {
    const result = LoginSchema.safeParse({
      email: 'user@example.com',
      password: 'MyP@ssw0rd!',
    });
    expect(result.success).toBe(true);
  });

  it('should validate with optional redirectTo', () => {
    const result = LoginSchema.safeParse({
      email: 'user@example.com',
      password: 'MyP@ssw0rd!',
      redirectTo: '/dashboard',
    });
    expect(result.success).toBe(true);
  });

  it('should reject login without password', () => {
    const result = LoginSchema.safeParse({
      email: 'user@example.com',
    });
    expect(result.success).toBe(false);
  });

  it('should reject login with invalid email', () => {
    const result = LoginSchema.safeParse({
      email: 'invalid',
      password: 'MyP@ssw0rd!',
    });
    expect(result.success).toBe(false);
  });
});

describe('SignupSchema', () => {
  it('should validate correct signup data', () => {
    const result = SignupSchema.safeParse({
      email: 'user@example.com',
      password: 'MyP@ssw0rd!',
      confirmPassword: 'MyP@ssw0rd!',
      role: 'creator',
    });
    expect(result.success).toBe(true);
  });

  it('should reject when passwords do not match', () => {
    const result = SignupSchema.safeParse({
      email: 'user@example.com',
      password: 'MyP@ssw0rd!',
      confirmPassword: 'DifferentP@ss1',
      role: 'creator',
    });
    expect(result.success).toBe(false);
  });

  it('should reject invalid role', () => {
    const result = SignupSchema.safeParse({
      email: 'user@example.com',
      password: 'MyP@ssw0rd!',
      confirmPassword: 'MyP@ssw0rd!',
      role: 'admin',
    });
    expect(result.success).toBe(false);
  });

  it('should validate brand role', () => {
    const result = SignupSchema.safeParse({
      email: 'brand@example.com',
      password: 'MyP@ssw0rd!',
      confirmPassword: 'MyP@ssw0rd!',
      role: 'brand',
    });
    expect(result.success).toBe(true);
  });
});

describe('ForgotPasswordSchema', () => {
  it('should validate correct email', () => {
    const result = ForgotPasswordSchema.safeParse({
      email: 'user@example.com',
    });
    expect(result.success).toBe(true);
  });

  it('should reject invalid email', () => {
    const result = ForgotPasswordSchema.safeParse({
      email: 'invalid',
    });
    expect(result.success).toBe(false);
  });
});

describe('ResetPasswordSchema', () => {
  it('should validate matching passwords', () => {
    const result = ResetPasswordSchema.safeParse({
      password: 'NewP@ssw0rd!',
      confirmPassword: 'NewP@ssw0rd!',
    });
    expect(result.success).toBe(true);
  });

  it('should reject non-matching passwords', () => {
    const result = ResetPasswordSchema.safeParse({
      password: 'NewP@ssw0rd!',
      confirmPassword: 'DifferentP@ss1',
    });
    expect(result.success).toBe(false);
  });

  it('should reject weak password', () => {
    const result = ResetPasswordSchema.safeParse({
      password: 'weak',
      confirmPassword: 'weak',
    });
    expect(result.success).toBe(false);
  });
});


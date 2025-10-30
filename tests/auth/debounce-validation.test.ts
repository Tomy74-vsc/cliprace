/**
 * Tests pour le hook useDebouncedValidation
 * Tests créés après correction du bug d'initialisation avec isValid: true
 */

import { describe, it, expect, vi } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { useDebouncedValidation } from '@/hooks/useDebounce';

describe('useDebouncedValidation', () => {
  it('should initialize with correct validation state for empty value', () => {
    const validator = vi.fn((value: string) => ({
      isValid: value.length > 0,
      error: value.length > 0 ? undefined : 'Value is required',
    }));

    const { result } = renderHook(() =>
      useDebouncedValidation('', validator, 300)
    );

    // Pour une valeur vide, isValid devrait être false (pas true comme avant le bug fix)
    expect(result.current.isValid).toBe(false);
    expect(result.current.error).toBeUndefined();
  });

  it('should initialize with correct validation state for non-empty value', () => {
    const validator = vi.fn((value: string) => ({
      isValid: value.length > 0,
      error: value.length > 0 ? undefined : 'Value is required',
    }));

    const { result } = renderHook(() =>
      useDebouncedValidation('test', validator, 300)
    );

    // Pour une valeur non-vide, le validator devrait être appelé
    expect(result.current.isValid).toBe(true);
    expect(result.current.error).toBeUndefined();
  });

  it('should debounce validation', async () => {
    const validator = vi.fn((value: string) => ({
      isValid: value.length >= 3,
      error: value.length >= 3 ? undefined : 'Minimum 3 characters',
    }));

    const { result, rerender } = renderHook(
      ({ value }) => useDebouncedValidation(value, validator, 300),
      { initialProps: { value: '' } }
    );

    // Initialement, pas de validation (valeur vide)
    expect(result.current.isValid).toBe(false);

    // Changer la valeur
    rerender({ value: 'te' });

    // Pendant le debounce, isValidating devrait être true
    expect(result.current.isValidating).toBe(true);

    // Attendre que le debounce soit terminé
    await waitFor(
      () => {
        expect(result.current.isValidating).toBe(false);
      },
      { timeout: 500 }
    );

    // Vérifier le résultat de validation
    expect(result.current.isValid).toBe(false);
    expect(result.current.error).toBe('Minimum 3 characters');
  });

  it('should update validation result when value changes', async () => {
    const validator = vi.fn((value: string) => ({
      isValid: value.length >= 3,
      error: value.length >= 3 ? undefined : 'Minimum 3 characters',
    }));

    const { result, rerender } = renderHook(
      ({ value }) => useDebouncedValidation(value, validator, 100),
      { initialProps: { value: '' } }
    );

    // Valeur vide -> invalide
    expect(result.current.isValid).toBe(false);

    // Changer pour une valeur valide
    rerender({ value: 'test' });

    // Attendre la validation
    await waitFor(
      () => {
        expect(result.current.isValidating).toBe(false);
      },
      { timeout: 300 }
    );

    // Valeur valide
    expect(result.current.isValid).toBe(true);
    expect(result.current.error).toBeUndefined();
  });

  it('should return debounced value', async () => {
    const validator = vi.fn((value: string) => ({
      isValid: true,
      error: undefined,
    }));

    const { result, rerender } = renderHook(
      ({ value }) => useDebouncedValidation(value, validator, 200),
      { initialProps: { value: 'initial' } }
    );

    // Initialement
    expect(result.current.debouncedValue).toBe('initial');

    // Changer la valeur
    rerender({ value: 'updated' });

    // La valeur debouncée ne devrait pas changer immédiatement
    expect(result.current.debouncedValue).toBe('initial');

    // Attendre le debounce
    await waitFor(
      () => {
        expect(result.current.debouncedValue).toBe('updated');
      },
      { timeout: 300 }
    );
  });

  it('should handle validator returning errors array correctly', async () => {
    // Test pour le wrapper qui convertit errors[] en error
    const validatorWithErrorsArray = (value: string) => {
      const errors: string[] = [];
      if (value.length < 3) errors.push('Too short');
      if (!/[A-Z]/.test(value)) errors.push('Need uppercase');
      return {
        isValid: errors.length === 0,
        errors,
      };
    };

    // Wrapper pour convertir errors[] en error (comme dans Step1)
    const wrappedValidator = (value: string) => {
      const result = validatorWithErrorsArray(value);
      return {
        isValid: result.isValid,
        error: result.errors[0],
      };
    };

    const { result, rerender } = renderHook(
      ({ value }) => useDebouncedValidation(value, wrappedValidator, 100),
      { initialProps: { value: 'te' } }
    );

    // Attendre la validation
    await waitFor(
      () => {
        expect(result.current.isValidating).toBe(false);
      },
      { timeout: 300 }
    );

    // Devrait montrer la première erreur
    expect(result.current.isValid).toBe(false);
    expect(result.current.error).toBe('Too short');

    // Changer pour une valeur plus longue mais sans majuscule
    rerender({ value: 'test' });

    await waitFor(
      () => {
        expect(result.current.isValidating).toBe(false);
      },
      { timeout: 300 }
    );

    // Devrait montrer l'erreur de majuscule
    expect(result.current.isValid).toBe(false);
    expect(result.current.error).toBe('Need uppercase');

    // Changer pour une valeur valide
    rerender({ value: 'Test' });

    await waitFor(
      () => {
        expect(result.current.isValidating).toBe(false);
      },
      { timeout: 300 }
    );

    // Devrait être valide
    expect(result.current.isValid).toBe(true);
    expect(result.current.error).toBeUndefined();
  });
});


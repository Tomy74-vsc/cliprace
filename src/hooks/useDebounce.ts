import { useState, useEffect, useRef } from 'react';

/**
 * Hook pour debouncer une valeur
 * @param value - La valeur à debouncer
 * @param delay - Le délai en millisecondes
 * @returns La valeur debouncée
 */
export function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => {
      clearTimeout(handler);
    };
  }, [value, delay]);

  return debouncedValue;
}

/**
 * Hook pour la validation avec debounce
 * @param value - La valeur à valider
 * @param validator - Fonction de validation
 * @param delay - Le délai en millisecondes
 * @returns L'état de validation
 */
export function useDebouncedValidation<T>(
  value: T,
  validator: (value: T) => { isValid: boolean; error?: string },
  delay: number = 300
) {
  const [isValidating, setIsValidating] = useState(false);
  const validatorRef = useRef(validator);
  
  // Initialiser avec la validation de la valeur actuelle au lieu de { isValid: true }
  const [validationResult, setValidationResult] = useState<{ isValid: boolean; error?: string }>(() => {
    // Pour la valeur initiale vide, on considère comme non validé (pas d'erreur affichée)
    if (typeof value === 'string' && !value) {
      return { isValid: false, error: undefined };
    }
    return validator(value);
  });
  
  const debouncedValue = useDebounce(value, delay);

  // Mettre à jour la référence du validator
  useEffect(() => {
    validatorRef.current = validator;
  }, [validator]);

  useEffect(() => {
    // Si la valeur debounced est différente de la valeur actuelle, on est en train de valider
    if (debouncedValue !== value) {
      setIsValidating(true);
      return;
    }

    // Valider la valeur debouncée
    const result = validatorRef.current(debouncedValue);
    setValidationResult(result);
    setIsValidating(false);
  }, [debouncedValue, value]);

  return {
    isValidating,
    isValid: validationResult.isValid,
    error: validationResult.error,
    debouncedValue
  };
}

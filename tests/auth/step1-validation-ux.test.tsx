/**
 * Tests UX et validation pour Step1AccountCreation
 * Tests créés après l'audit et correction du flux d'authentification
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { Step1AccountCreation } from '@/components/auth/Step1AccountCreation';
import { validateEmail, validatePassword } from '@/lib/validation';

// Mock des hooks
vi.mock('@/hooks/useAsyncValidation', () => ({
  useEmailValidation: () => ({
    isChecking: false,
    isAvailable: true,
    checkEmailAvailability: vi.fn(),
  }),
}));

describe('Step1AccountCreation - Validation UX', () => {
  const mockOnNext = vi.fn();

  beforeEach(() => {
    mockOnNext.mockClear();
  });

  it('should display password strength indicator when typing password', async () => {
    render(<Step1AccountCreation onNext={mockOnNext} />);
    
    const passwordInput = screen.getByLabelText(/mot de passe/i, { selector: 'input[type="password"]' });
    
    // Taper un mot de passe
    fireEvent.change(passwordInput, { target: { value: 'Test123!' } });
    
    // Attendre que le composant PasswordStrength s'affiche
    await waitFor(() => {
      expect(screen.getByText(/force du mot de passe/i)).toBeInTheDocument();
    });
  });

  it('should show email validation icon when email is valid', async () => {
    render(<Step1AccountCreation onNext={mockOnNext} />);
    
    const emailInput = screen.getByPlaceholderText(/vous@exemple.com/i);
    
    // Saisir un email valide
    fireEvent.change(emailInput, { target: { value: 'test@example.com' } });
    
    // Attendre que l'icône de validation apparaisse
    await waitFor(() => {
      // L'icône CheckCircle devrait être visible (validation réussie)
      const svg = document.querySelector('svg');
      expect(svg).toBeInTheDocument();
    }, { timeout: 1000 });
  });

  it('should enable submit button when form is being validated (not blocking user)', async () => {
    render(<Step1AccountCreation onNext={mockOnNext} />);
    
    const submitButton = screen.getByRole('button', { name: /s'inscrire/i });
    
    // Au début, le bouton devrait être activé (pas disabled par défaut)
    expect(submitButton).not.toBeDisabled();
  });

  it('should allow form submission with valid data', async () => {
    render(<Step1AccountCreation onNext={mockOnNext} />);
    
    const emailInput = screen.getByPlaceholderText(/vous@exemple.com/i);
    const passwordInput = screen.getByLabelText(/^mot de passe$/i, { selector: 'input[type="password"]' });
    const confirmInput = screen.getByLabelText(/confirmer le mot de passe/i);
    const submitButton = screen.getByRole('button', { name: /s'inscrire/i });
    
    // Remplir le formulaire avec des données valides
    fireEvent.change(emailInput, { target: { value: 'valid@example.com' } });
    fireEvent.change(passwordInput, { target: { value: 'ValidPass123!' } });
    fireEvent.change(confirmInput, { target: { value: 'ValidPass123!' } });
    
    // Attendre que la validation soit terminée
    await waitFor(() => {
      expect(submitButton).not.toBeDisabled();
    });
    
    // Soumettre le formulaire
    fireEvent.click(submitButton);
    
    // Vérifier que onNext est appelé avec les bonnes données
    await waitFor(() => {
      expect(mockOnNext).toHaveBeenCalledWith(
        expect.objectContaining({
          email: 'valid@example.com',
          password: 'ValidPass123!',
          confirmPassword: 'ValidPass123!',
        })
      );
    });
  });

  it('should show error when passwords do not match', async () => {
    render(<Step1AccountCreation onNext={mockOnNext} />);
    
    const passwordInput = screen.getByLabelText(/^mot de passe$/i, { selector: 'input[type="password"]' });
    const confirmInput = screen.getByLabelText(/confirmer le mot de passe/i);
    const submitButton = screen.getByRole('button', { name: /s'inscrire/i });
    
    // Remplir avec des mots de passe différents
    fireEvent.change(passwordInput, { target: { value: 'ValidPass123!' } });
    fireEvent.change(confirmInput, { target: { value: 'DifferentPass456!' } });
    
    // Soumettre
    fireEvent.click(submitButton);
    
    // Vérifier que l'erreur s'affiche
    await waitFor(() => {
      expect(screen.getByText(/les mots de passe ne correspondent pas/i)).toBeInTheDocument();
    });
    
    // onNext ne devrait pas être appelé
    expect(mockOnNext).not.toHaveBeenCalled();
  });

  it('should show error when email is invalid', async () => {
    render(<Step1AccountCreation onNext={mockOnNext} />);
    
    const emailInput = screen.getByPlaceholderText(/vous@exemple.com/i);
    const submitButton = screen.getByRole('button', { name: /s'inscrire/i });
    
    // Saisir un email invalide
    fireEvent.change(emailInput, { target: { value: 'invalid-email' } });
    
    // Soumettre
    fireEvent.click(submitButton);
    
    // Vérifier que l'erreur s'affiche
    await waitFor(() => {
      expect(screen.getByText(/email invalide|format d'email invalide/i)).toBeInTheDocument();
    });
    
    expect(mockOnNext).not.toHaveBeenCalled();
  });

  it('should allow switching between creator and brand roles', () => {
    render(<Step1AccountCreation onNext={mockOnNext} />);
    
    const creatorButton = screen.getByRole('button', { name: /créateur/i });
    const brandButton = screen.getByRole('button', { name: /marque/i });
    
    // Par défaut, créateur est sélectionné
    expect(creatorButton).toHaveClass(/border-indigo-500/);
    
    // Cliquer sur marque
    fireEvent.click(brandButton);
    
    // Vérifier que marque est maintenant sélectionné
    expect(brandButton).toHaveClass(/border-indigo-500/);
  });
});

describe('Validation functions', () => {
  describe('validateEmail', () => {
    it('should validate correct email', () => {
      const result = validateEmail('test@example.com');
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should reject empty email', () => {
      const result = validateEmail('');
      expect(result.isValid).toBe(false);
      expect(result.errors[0]).toContain('requis');
    });

    it('should reject invalid email format', () => {
      const result = validateEmail('invalid-email');
      expect(result.isValid).toBe(false);
      expect(result.errors[0]).toContain('invalide');
    });

    it('should reject temporary email domains', () => {
      const result = validateEmail('test@tempmail.org');
      expect(result.isValid).toBe(false);
      expect(result.errors[0]).toContain('temporaires');
    });
  });

  describe('validatePassword', () => {
    it('should validate strong password', () => {
      const result = validatePassword('StrongP@ss123');
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should reject password without uppercase', () => {
      const result = validatePassword('weakpass123!');
      expect(result.isValid).toBe(false);
      expect(result.errors.some(e => e.includes('majuscule'))).toBe(true);
    });

    it('should reject password without special character', () => {
      const result = validatePassword('WeakPass123');
      expect(result.isValid).toBe(false);
      expect(result.errors.some(e => e.includes('spécial'))).toBe(true);
    });

    it('should reject password shorter than 8 characters', () => {
      const result = validatePassword('Sh0rt!');
      expect(result.isValid).toBe(false);
      expect(result.errors.some(e => e.includes('8 caractères'))).toBe(true);
    });

    it('should reject common passwords', () => {
      const result = validatePassword('Password123!');
      expect(result.isValid).toBe(false);
      expect(result.errors.some(e => e.includes('commun'))).toBe(true);
    });

    it('should reject passwords with repeated characters', () => {
      const result = validatePassword('Aaa123456!');
      expect(result.isValid).toBe(false);
      expect(result.errors.some(e => e.includes('répétés'))).toBe(true);
    });
  });
});


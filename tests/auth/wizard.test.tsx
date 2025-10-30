import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SignupWizard } from '@/components/auth/SignupWizard';

// Mock Next.js Image
vi.mock('next/image', () => ({
  default: (props: any) => {
    const { src, alt, ...rest } = props;
    // eslint-disable-next-line @next/next/no-img-element, jsx-a11y/alt-text
    return <img src={src} alt={alt} {...rest} />;
  },
}));

// Mock Next.js Link
vi.mock('next/link', () => ({
  default: ({ children, href, ...props }: any) => <a href={href} {...props}>{children}</a>,
}));

// Mock next/navigation
const mockPush = vi.fn();
const mockReplace = vi.fn();
const mockGet = vi.fn();

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: mockPush,
    replace: mockReplace,
  }),
  useSearchParams: () => ({
    get: mockGet,
  }),
}));

// Mock Supabase client
const mockSupabaseClient = {
  auth: {
    getUser: vi.fn(),
    getSession: vi.fn(),
    resend: vi.fn(),
  },
  from: vi.fn(),
};

vi.mock('@/lib/supabase/client', () => ({
  getBrowserSupabase: () => mockSupabaseClient,
  forceSessionCleanup: vi.fn().mockResolvedValue(undefined),
}));

// Mock validation hooks
vi.mock('@/hooks/useDebounce', () => ({
  useDebouncedValidation: (value: string) => ({
    debouncedValue: value,
    isValid: value.length > 0,
    isValidating: false,
    error: null,
  }),
}));

vi.mock('@/hooks/useAsyncValidation', () => ({
  useEmailValidation: () => ({
    isChecking: false,
    isAvailable: true,
    checkEmailAvailability: vi.fn(),
  }),
}));

// Mock framer-motion
vi.mock('framer-motion', () => ({
  motion: {
    div: ({ children, ...props }: any) => <div {...props}>{children}</div>,
    button: ({ children, ...props }: any) => <button {...props}>{children}</button>,
  },
  AnimatePresence: ({ children }: any) => children,
}));

// Mock lazy-loaded components
vi.mock('@/components/auth/Step2EmailVerification', () => ({
  Step2EmailVerification: ({ email, onNext, onResendEmail }: any) => (
    <div data-testid="step2">
      <h2>Vérification de l'email</h2>
      <p>Email: {email}</p>
      <button onClick={onNext}>Continuer</button>
      <button onClick={onResendEmail}>Renvoyer l'email</button>
    </div>
  ),
}));

vi.mock('@/components/auth/Step3CompleteProfile', () => ({
  Step3CompleteProfile: ({ role, onComplete, loading }: any) => (
    <div data-testid="step3">
      <h2>Complétez votre profil</h2>
      <p>Role: {role}</p>
      <button onClick={() => onComplete({ name: 'Test User', description: 'Test description' })} disabled={loading}>
        Finaliser
      </button>
    </div>
  ),
}));

describe('SignupWizard - RTL Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    global.fetch = vi.fn();
    mockGet.mockReturnValue(null);
    localStorage.clear();
    
    // Default mock for window.location
    Object.defineProperty(window, 'location', {
      value: {
        origin: 'http://localhost:3000',
      },
      writable: true,
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Progression 0/3 → 3/3', () => {
    it('devrait afficher Step 1 par défaut (0/3)', () => {
      render(<SignupWizard />);

      expect(screen.getByTestId('wizard-step1-title')).toBeInTheDocument();
      expect(screen.getByText(/type de compte/i)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /s'inscrire/i })).toBeInTheDocument();
    });

    it('devrait progresser de Step 1 (0/3) à Step 2 (1/3) après une inscription réussie', async () => {
      const user = userEvent.setup();
      
      // Mock successful signup
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          success: true,
          user: {
            id: 'test-user-id',
            email: 'test@example.com',
          },
        }),
      });

      render(<SignupWizard />);

      // Fill Step 1 form
      const emailInput = screen.getByPlaceholderText(/vous@exemple.com/i);
      const passwordInput = screen.getByLabelText(/^mot de passe$/i);
      const confirmPasswordInput = screen.getByLabelText(/confirmer le mot de passe/i);
      const submitButton = screen.getByRole('button', { name: /s'inscrire/i });

      await user.type(emailInput, 'test@example.com');
      await user.type(passwordInput, 'StrongPassword123!');
      await user.type(confirmPasswordInput, 'StrongPassword123!');
      await user.click(submitButton);

      // Vérifier la transition vers Step 2
      await waitFor(() => {
        expect(screen.getByTestId('step2')).toBeInTheDocument();
        expect(screen.getByText(/vérification de l'email/i)).toBeInTheDocument();
        expect(screen.getByText(/email: test@example.com/i)).toBeInTheDocument();
      });

      // Vérifier que localStorage a été mis à jour
      const storedData = localStorage.getItem('signup_user_data');
      expect(storedData).toBeTruthy();
      const parsed = JSON.parse(storedData!);
      expect(parsed.email).toBe('test@example.com');
      expect(parsed.role).toBe('creator');
    });

    it('devrait progresser de Step 2 (1/3) à Step 3 (2/3) après vérification email', async () => {
      const user = userEvent.setup();

      // Setup for Step 2
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true, user: { id: 'test-id', email: 'test@example.com' } }),
      });

      render(<SignupWizard />);

      // Progress to Step 2
      const emailInput = screen.getByPlaceholderText(/vous@exemple.com/i);
      const passwordInput = screen.getByLabelText(/^mot de passe$/i);
      const confirmPasswordInput = screen.getByLabelText(/confirmer le mot de passe/i);
      const submitButton = screen.getByRole('button', { name: /s'inscrire/i });

      await user.type(emailInput, 'test@example.com');
      await user.type(passwordInput, 'StrongPassword123!');
      await user.type(confirmPasswordInput, 'StrongPassword123!');
      await user.click(submitButton);

      await waitFor(() => {
        expect(screen.getByTestId('step2')).toBeInTheDocument();
      });

      // Mock email verification
      mockSupabaseClient.auth.getSession.mockResolvedValueOnce({
        data: { session: { user: { id: 'test-id' } } },
        error: null,
      });

      mockSupabaseClient.auth.getUser.mockResolvedValueOnce({
        data: {
          user: {
            id: 'test-id',
            email: 'test@example.com',
            email_confirmed_at: new Date().toISOString(),
          },
        },
        error: null,
      });

      // Click continue button in Step 2
      const continueButton = screen.getByRole('button', { name: /continuer/i });
      await user.click(continueButton);

      // Vérifier la transition vers Step 3
      await waitFor(() => {
        expect(screen.getByTestId('step3')).toBeInTheDocument();
        expect(screen.getByText(/complétez votre profil/i)).toBeInTheDocument();
      });
    });

    it('devrait compléter tout le wizard de Step 3 (2/3) à la redirection (3/3)', async () => {
      const user = userEvent.setup();

      // Start at Step 3
      mockGet.mockReturnValue('3');
      localStorage.setItem(
        'signup_user_data',
        JSON.stringify({ role: 'creator', email: 'test@example.com', timestamp: Date.now() })
      );

      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: {
          user: {
            id: 'test-user-id',
            email: 'test@example.com',
            email_confirmed_at: new Date().toISOString(),
          },
        },
        error: null,
      });

      mockSupabaseClient.from.mockReturnValue({
        upsert: vi.fn().mockResolvedValue({ error: null }),
      });

      render(<SignupWizard />);

      await waitFor(() => {
        expect(screen.getByTestId('step3')).toBeInTheDocument();
      });

      // Complete Step 3
      const finalizeButton = screen.getByRole('button', { name: /finaliser/i });
      await user.click(finalizeButton);

      // Vérifier la redirection
      await waitFor(() => {
        expect(mockPush).toHaveBeenCalledWith('/creator?welcome=true');
      });

      // Vérifier que localStorage a été nettoyé
      expect(localStorage.getItem('signup_user_data')).toBeNull();
    });
  });

  describe('Blocage sans rôle', () => {
    it('devrait bloquer la soumission Step3 si accountData est null', async () => {
      const user = userEvent.setup();

      mockGet.mockReturnValue('3');
      localStorage.setItem(
        'signup_user_data',
        JSON.stringify({ role: 'creator', email: 'test@example.com', timestamp: Date.now() })
      );

      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: {
          user: {
            id: 'test-user-id',
            email: 'test@example.com',
            email_confirmed_at: new Date().toISOString(),
          },
        },
        error: null,
      });

      render(<SignupWizard />);

      await waitFor(() => {
        expect(screen.getByTestId('step3')).toBeInTheDocument();
      });

      // Simuler la perte de accountData en forçant un state vide
      // (en pratique cela simule un race condition ou bug)
      // On va simplement tester que si getUser retourne une erreur lors de la soumission
      mockSupabaseClient.auth.getUser.mockResolvedValueOnce({
        data: { user: null },
        error: { message: 'User not found' } as any,
      });

      const finalizeButton = screen.getByRole('button', { name: /finaliser/i });
      await user.click(finalizeButton);

      await waitFor(() => {
        expect(screen.getByText(/utilisateur non authentifie/i)).toBeInTheDocument();
      });
    });

    it('devrait bloquer à Step 3 si le rôle est manquant (localStorage)', async () => {
      mockGet.mockReturnValue('3');
      
      // localStorage sans rôle
      localStorage.setItem(
        'signup_user_data',
        JSON.stringify({ email: 'test@example.com', timestamp: Date.now() })
      );

      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: {
          user: {
            id: 'test-id',
            email: 'test@example.com',
            email_confirmed_at: new Date().toISOString(),
            user_metadata: {},
          },
        },
        error: null,
      });

      mockSupabaseClient.from.mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            maybeSingle: vi.fn().mockResolvedValue({
              data: null,
              error: null,
            }),
          }),
        }),
      });

      render(<SignupWizard />);

      await waitFor(() => {
        expect(screen.getByText(/impossible de déterminer votre rôle ou email/i)).toBeInTheDocument();
      });

      expect(mockPush).toHaveBeenCalledWith('/login?redirect=/signup');
    });

    it('devrait bloquer si le rôle est manquant (Supabase)', async () => {
      mockGet.mockReturnValue('3');
      
      // Pas de localStorage, donc hydratation depuis Supabase
      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: {
          user: {
            id: 'test-id',
            email: 'test@example.com',
            email_confirmed_at: new Date().toISOString(),
            user_metadata: {}, // Pas de rôle
          },
        },
        error: null,
      });

      mockSupabaseClient.from.mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            maybeSingle: vi.fn().mockResolvedValue({
              data: null, // Pas de profil
              error: null,
            }),
          }),
        }),
      });

      render(<SignupWizard />);

      await waitFor(() => {
        expect(screen.getByText(/impossible de déterminer votre rôle ou email/i)).toBeInTheDocument();
      });
    });
  });

  describe('Succès avec rôle', () => {
    it('devrait réussir avec un rôle creator', async () => {
      const user = userEvent.setup();

      mockGet.mockReturnValue('3');
      localStorage.setItem(
        'signup_user_data',
        JSON.stringify({ role: 'creator', email: 'creator@example.com', timestamp: Date.now() })
      );

      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: {
          user: {
            id: 'creator-id',
            email: 'creator@example.com',
            email_confirmed_at: new Date().toISOString(),
          },
        },
        error: null,
      });

      mockSupabaseClient.from.mockReturnValue({
        upsert: vi.fn().mockResolvedValue({ error: null }),
      });

      render(<SignupWizard />);

      await waitFor(() => {
        expect(screen.getByTestId('step3')).toBeInTheDocument();
        expect(screen.getByText(/role: creator/i)).toBeInTheDocument();
      });

      const finalizeButton = screen.getByRole('button', { name: /finaliser/i });
      await user.click(finalizeButton);

      await waitFor(() => {
        expect(mockPush).toHaveBeenCalledWith('/creator?welcome=true');
      });
    });

    it('devrait réussir avec un rôle brand', async () => {
      const user = userEvent.setup();

      mockGet.mockReturnValue('3');
      localStorage.setItem(
        'signup_user_data',
        JSON.stringify({ role: 'brand', email: 'brand@example.com', timestamp: Date.now() })
      );

      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: {
          user: {
            id: 'brand-id',
            email: 'brand@example.com',
            email_confirmed_at: new Date().toISOString(),
          },
        },
        error: null,
      });

      mockSupabaseClient.from.mockReturnValue({
        upsert: vi.fn().mockResolvedValue({ error: null }),
      });

      render(<SignupWizard />);

      await waitFor(() => {
        expect(screen.getByTestId('step3')).toBeInTheDocument();
        expect(screen.getByText(/role: brand/i)).toBeInTheDocument();
      });

      const finalizeButton = screen.getByRole('button', { name: /finaliser/i });
      await user.click(finalizeButton);

      await waitFor(() => {
        expect(mockPush).toHaveBeenCalledWith('/brand?welcome=true');
      });
    });
  });

  describe('Fallback Supabase', () => {
    it('devrait afficher un spinner puis utiliser Supabase quand localStorage est vide (fallback)', async () => {
      mockGet.mockImplementation((param) => {
        if (param === 'step') return '3';
        if (param === 'message') return 'complete_profile';
        return null;
      });
      
      // localStorage vide
      expect(localStorage.getItem('signup_user_data')).toBeNull();

      // Mock Supabase pour fournir les données avec un délai
      let resolveGetUser: any;
      const getUserPromise = new Promise((resolve) => {
        resolveGetUser = resolve;
      });

      mockSupabaseClient.auth.getUser.mockReturnValue(getUserPromise);

      mockSupabaseClient.from.mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            maybeSingle: vi.fn().mockResolvedValue({
              data: { email: 'fallback@example.com', role: 'brand' },
              error: null,
            }),
          }),
        }),
        upsert: vi.fn().mockResolvedValue({ error: null }),
      });

      render(<SignupWizard />);

      // Vérifier que le spinner est affiché d'abord
      await waitFor(() => {
        const spinner = screen.getByRole('generic', { hidden: true });
        expect(spinner).toHaveClass('animate-spin');
      });

      // Step3 ne doit PAS encore être visible
      expect(screen.queryByTestId('step3')).not.toBeInTheDocument();

      // Résoudre le mock getUser
      resolveGetUser({
        data: {
          user: {
            id: 'test-id',
            email: 'fallback@example.com',
            email_confirmed_at: new Date().toISOString(),
            user_metadata: { role: 'brand' },
          },
        },
        error: null,
      });

      // Attendre que Step3 soit rendu avec le rôle hydraté depuis Supabase
      await waitFor(() => {
        expect(screen.getByTestId('step3')).toBeInTheDocument();
        expect(screen.getByText(/role: brand/i)).toBeInTheDocument();
      });

      // Vérifier que le rôle n'est PAS 'creator' (valeur par défaut), mais 'brand' (hydraté)
      expect(screen.getByText(/role: brand/i)).toBeInTheDocument();
      expect(screen.queryByText(/role: creator/i)).not.toBeInTheDocument();

      // Vérifier que les données viennent de Supabase
      expect(mockSupabaseClient.auth.getUser).toHaveBeenCalled();
    });

    it('devrait utiliser le rôle de user_metadata si profile est null (fallback)', async () => {
      mockGet.mockReturnValue('3');

      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: {
          user: {
            id: 'test-id',
            email: 'metadata@example.com',
            email_confirmed_at: new Date().toISOString(),
            user_metadata: { role: 'brand' }, // Rôle dans metadata
          },
        },
        error: null,
      });

      mockSupabaseClient.from.mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            maybeSingle: vi.fn().mockResolvedValue({
              data: null, // Pas de profil dans la table
              error: null,
            }),
          }),
        }),
        upsert: vi.fn().mockResolvedValue({ error: null }),
      });

      render(<SignupWizard />);

      await waitFor(() => {
        expect(screen.getByTestId('step3')).toBeInTheDocument();
        expect(screen.getByText(/role: brand/i)).toBeInTheDocument();
      });

      // Le rôle devrait venir de user_metadata
      expect(mockSupabaseClient.auth.getUser).toHaveBeenCalled();
    });

    it('devrait gérer l\'expiration de localStorage et rediriger', async () => {
      mockGet.mockReturnValue('3');

      // localStorage avec des données expirées (plus de 24h)
      const expiredTimestamp = Date.now() - (25 * 60 * 60 * 1000); // 25 heures
      localStorage.setItem(
        'signup_user_data',
        JSON.stringify({ role: 'creator', email: 'expired@example.com', timestamp: expiredTimestamp })
      );

      render(<SignupWizard />);

      await waitFor(() => {
        expect(mockReplace).toHaveBeenCalledWith('/signup');
      });

      // localStorage devrait être nettoyé
      expect(localStorage.getItem('signup_user_data')).toBeNull();
    });
  });

  describe('Gestion des erreurs', () => {
    it('devrait afficher une erreur si l\'email n\'est pas vérifié à Step 2', async () => {
      const user = userEvent.setup();

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true, user: { id: 'test-id' } }),
      });

      render(<SignupWizard />);

      // Progress to Step 2
      const emailInput = screen.getByPlaceholderText(/vous@exemple.com/i);
      const passwordInput = screen.getByLabelText(/^mot de passe$/i);
      const confirmPasswordInput = screen.getByLabelText(/confirmer le mot de passe/i);
      await user.type(emailInput, 'test@example.com');
      await user.type(passwordInput, 'StrongPassword123!');
      await user.type(confirmPasswordInput, 'StrongPassword123!');
      await user.click(screen.getByRole('button', { name: /s'inscrire/i }));

      await waitFor(() => {
        expect(screen.getByTestId('step2')).toBeInTheDocument();
      });

      // Mock user without email verification
      mockSupabaseClient.auth.getSession.mockResolvedValueOnce({
        data: { session: { user: { id: 'test-id' } } },
        error: null,
      });

      mockSupabaseClient.auth.getUser.mockResolvedValueOnce({
        data: {
          user: {
            id: 'test-id',
            email: 'test@example.com',
            email_confirmed_at: null, // Email non vérifié
          },
        },
        error: null,
      });

      const continueButton = screen.getByRole('button', { name: /continuer/i });
      await user.click(continueButton);

      await waitFor(() => {
        expect(screen.getByText(/veuillez confirmer votre email/i)).toBeInTheDocument();
      });
    });

    it('devrait afficher une erreur en cas d\'échec de l\'inscription à Step 1', async () => {
      const user = userEvent.setup();

      (global.fetch as any).mockResolvedValueOnce({
        ok: false,
        status: 400,
        json: async () => ({
          success: false,
          error: 'Email déjà utilisé',
        }),
      });

      render(<SignupWizard />);

      const emailInput = screen.getByPlaceholderText(/vous@exemple.com/i);
      const passwordInput = screen.getByLabelText(/^mot de passe$/i);
      const confirmPasswordInput = screen.getByLabelText(/confirmer le mot de passe/i);

      await user.type(emailInput, 'existing@example.com');
      await user.type(passwordInput, 'StrongPassword123!');
      await user.type(confirmPasswordInput, 'StrongPassword123!');
      await user.click(screen.getByRole('button', { name: /s'inscrire/i }));

      await waitFor(() => {
        expect(screen.getByText(/email déjà utilisé/i)).toBeInTheDocument();
      });
    });
  });

  describe('Resend email', () => {
    it('devrait permettre de renvoyer l\'email de vérification', async () => {
      const user = userEvent.setup();

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true, user: { id: 'test-id' } }),
      });

      render(<SignupWizard />);

      // Progress to Step 2
      const emailInput = screen.getByPlaceholderText(/vous@exemple.com/i);
      const passwordInput = screen.getByLabelText(/^mot de passe$/i);
      const confirmPasswordInput = screen.getByLabelText(/confirmer le mot de passe/i);
      await user.type(emailInput, 'test@example.com');
      await user.type(passwordInput, 'StrongPassword123!');
      await user.type(confirmPasswordInput, 'StrongPassword123!');
      await user.click(screen.getByRole('button', { name: /s'inscrire/i }));

      await waitFor(() => {
        expect(screen.getByTestId('step2')).toBeInTheDocument();
      });

      // Mock resend email
      mockSupabaseClient.auth.resend.mockResolvedValueOnce({ error: null });

      const resendButton = screen.getByRole('button', { name: /renvoyer l'email/i });
      await user.click(resendButton);

      await waitFor(() => {
        expect(mockSupabaseClient.auth.resend).toHaveBeenCalledWith({
          type: 'signup',
          email: 'test@example.com',
          options: {
            emailRedirectTo: 'http://localhost:3000/auth/email-verified?step=3',
          },
        });
      });
    });
  });

  describe('Anti double-submit et expiration', () => {
    it('bloque la double soumission sur Step 3', async () => {
      const user = userEvent.setup();
      
      mockGet.mockReturnValue('3');
      localStorage.setItem(
        'signup_user_data',
        JSON.stringify({ role: 'brand', email: 'test@example.com', timestamp: Date.now() })
      );

      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: {
          user: {
            id: 'test-user-id',
            email: 'test@example.com',
            email_confirmed_at: new Date().toISOString(),
          },
        },
        error: null,
      });

      // Mock avec délai pour simuler une soumission lente
      let resolveUpsert: any;
      const upsertPromise = new Promise((resolve) => {
        resolveUpsert = resolve;
      });

      mockSupabaseClient.from.mockReturnValue({
        upsert: vi.fn().mockReturnValue(upsertPromise),
      });

      render(<SignupWizard />);

      await waitFor(() => {
        expect(screen.getByTestId('step3')).toBeInTheDocument();
      });

      const finaliser = screen.getByRole('button', { name: /finaliser/i });
      
      // Premier clic
      await user.click(finaliser);
      
      // Le bouton doit être désactivé immédiatement
      expect(finaliser).toBeDisabled();
      expect(finaliser).toHaveAttribute('aria-busy', 'true');
      
      // Deuxième clic (doit être ignoré)
      await user.click(finaliser);

      // Résoudre le mock
      resolveUpsert({ error: null });

      await waitFor(() => {
        expect(mockPush).toHaveBeenCalledTimes(1); // Une seule fois
      });
    });

    it('redirige sur /signup quand le cache Step3 expire', async () => {
      mockGet.mockReturnValue('3');
      
      // localStorage avec timestamp expiré
      const expiredTimestamp = Date.now() - (25 * 60 * 60 * 1000); // 25h
      localStorage.setItem(
        'signup_user_data',
        JSON.stringify({ role: 'creator', email: 'expired@example.com', timestamp: expiredTimestamp })
      );

      render(<SignupWizard />);

      await waitFor(() => {
        expect(mockReplace).toHaveBeenCalledWith('/signup?message=session_expired');
      });

      // Vérifier que le message d'erreur est affiché
      await waitFor(() => {
        expect(screen.getByText(/vos informations d'inscription ont expiré/i)).toBeInTheDocument();
      });

      // localStorage devrait être nettoyé
      expect(localStorage.getItem('signup_user_data')).toBeNull();
    });
  });
});



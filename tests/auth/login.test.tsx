import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import LoginPage from '@/app/login/page';

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
vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: mockPush,
    replace: mockReplace,
  }),
  useSearchParams: () => ({
    get: vi.fn(),
  }),
}));

// Mock framer-motion
vi.mock('framer-motion', () => ({
  motion: {
    div: ({ children, ...props }: any) => <div {...props}>{children}</div>,
  },
}));

describe('Login Page - RTL Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    global.fetch = vi.fn();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Validation des champs vides', () => {
    it('devrait afficher une erreur quand les champs sont vides', async () => {
      const user = userEvent.setup();
      render(<LoginPage />);

      const submitButton = screen.getByRole('button', { name: /se connecter/i });
      
      // Essayer de soumettre sans remplir les champs
      await user.click(submitButton);

      // Les champs avec required devraient empêcher la soumission
      // Le formulaire HTML5 devrait bloquer la soumission
      expect(global.fetch).not.toHaveBeenCalled();
    });

    it('devrait afficher une erreur si seulement l\'email est rempli', async () => {
      const user = userEvent.setup();
      render(<LoginPage />);

      const emailInput = screen.getByPlaceholderText(/vous@exemple.com/i);
      const submitButton = screen.getByRole('button', { name: /se connecter/i });

      await user.type(emailInput, 'test@example.com');
      await user.click(submitButton);

      // La validation HTML5 devrait empêcher la soumission
      expect(global.fetch).not.toHaveBeenCalled();
    });

    it('devrait afficher une erreur si seulement le mot de passe est rempli', async () => {
      const user = userEvent.setup();
      render(<LoginPage />);

      const passwordInput = screen.getByPlaceholderText(/\*\*\*\*\*\*\*\*/);
      const submitButton = screen.getByRole('button', { name: /se connecter/i });

      await user.type(passwordInput, 'password123');
      await user.click(submitButton);

      // La validation HTML5 devrait empêcher la soumission
      expect(global.fetch).not.toHaveBeenCalled();
    });
  });

  describe('Mauvais identifiants', () => {
    it('devrait afficher un message d\'erreur toast avec de mauvais identifiants', async () => {
      const user = userEvent.setup();
      
      // Mock API response for bad credentials
      (global.fetch as any).mockResolvedValueOnce({
        ok: false,
        status: 401,
        json: async () => ({
          success: false,
          error: 'Email ou mot de passe incorrect',
        }),
      });

      render(<LoginPage />);

      const emailInput = screen.getByPlaceholderText(/vous@exemple.com/i);
      const passwordInput = screen.getByPlaceholderText(/\*\*\*\*\*\*\*\*/);
      const submitButton = screen.getByRole('button', { name: /se connecter/i });

      await user.type(emailInput, 'wrong@example.com');
      await user.type(passwordInput, 'wrongpassword');
      await user.click(submitButton);

      // Attendre que le message d'erreur apparaisse
      await waitFor(() => {
        expect(screen.getByText(/email ou mot de passe incorrect/i)).toBeInTheDocument();
      });

      expect(global.fetch).toHaveBeenCalledWith(
        '/api/auth/login',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'Content-Type': 'application/json',
          }),
          body: JSON.stringify({
            email: 'wrong@example.com',
            password: 'wrongpassword',
            redirectTo: '/',
          }),
        })
      );
    });

    it('devrait afficher un message d\'erreur pour email non confirmé', async () => {
      const user = userEvent.setup();
      
      (global.fetch as any).mockResolvedValueOnce({
        ok: false,
        status: 403,
        json: async () => ({
          success: false,
          error: 'Veuillez confirmer votre email avant de vous connecter',
        }),
      });

      render(<LoginPage />);

      const emailInput = screen.getByPlaceholderText(/vous@exemple.com/i);
      const passwordInput = screen.getByPlaceholderText(/\*\*\*\*\*\*\*\*/);
      const submitButton = screen.getByRole('button', { name: /se connecter/i });

      await user.type(emailInput, 'unverified@example.com');
      await user.type(passwordInput, 'password123');
      await user.click(submitButton);

      await waitFor(() => {
        expect(screen.getByText(/veuillez confirmer votre email/i)).toBeInTheDocument();
      });
    });

    it('devrait afficher un message pour trop de tentatives (rate limit)', async () => {
      const user = userEvent.setup();
      
      (global.fetch as any).mockResolvedValueOnce({
        ok: false,
        status: 429,
        json: async () => ({
          success: false,
          error: 'Trop de tentatives',
        }),
      });

      render(<LoginPage />);

      const emailInput = screen.getByPlaceholderText(/vous@exemple.com/i);
      const passwordInput = screen.getByPlaceholderText(/\*\*\*\*\*\*\*\*/);
      const submitButton = screen.getByRole('button', { name: /se connecter/i });

      await user.type(emailInput, 'test@example.com');
      await user.type(passwordInput, 'password123');
      await user.click(submitButton);

      await waitFor(() => {
        expect(screen.getByText(/trop de tentatives/i)).toBeInTheDocument();
      });
    });
  });

  describe('Connexion réussie', () => {
    it('devrait rediriger vers /creator pour un créateur avec de bons identifiants', async () => {
      const user = userEvent.setup();
      
      // Mock successful login for creator
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          success: true,
          redirect: '/creator',
          role: 'creator',
        }),
      });

      // Mock window.location.replace
      const mockLocationReplace = vi.fn();
      Object.defineProperty(window, 'location', {
        value: {
          ...window.location,
          replace: mockLocationReplace,
        },
        writable: true,
      });

      render(<LoginPage />);

      const emailInput = screen.getByPlaceholderText(/vous@exemple.com/i);
      const passwordInput = screen.getByPlaceholderText(/\*\*\*\*\*\*\*\*/);
      const submitButton = screen.getByRole('button', { name: /se connecter/i });

      await user.type(emailInput, 'creator@example.com');
      await user.type(passwordInput, 'correctpassword');
      await user.click(submitButton);

      await waitFor(() => {
        expect(mockLocationReplace).toHaveBeenCalledWith('/creator');
      });

      expect(global.fetch).toHaveBeenCalledWith(
        '/api/auth/login',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({
            email: 'creator@example.com',
            password: 'correctpassword',
            redirectTo: '/',
          }),
        })
      );
    });

    it('devrait rediriger vers /brand pour une marque avec de bons identifiants', async () => {
      const user = userEvent.setup();
      
      // Mock successful login for brand
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          success: true,
          redirect: '/brand',
          role: 'brand',
        }),
      });

      const mockLocationReplace = vi.fn();
      Object.defineProperty(window, 'location', {
        value: {
          ...window.location,
          replace: mockLocationReplace,
        },
        writable: true,
      });

      render(<LoginPage />);

      const emailInput = screen.getByPlaceholderText(/vous@exemple.com/i);
      const passwordInput = screen.getByPlaceholderText(/\*\*\*\*\*\*\*\*/);
      const submitButton = screen.getByRole('button', { name: /se connecter/i });

      await user.type(emailInput, 'brand@example.com');
      await user.type(passwordInput, 'correctpassword');
      await user.click(submitButton);

      await waitFor(() => {
        expect(mockLocationReplace).toHaveBeenCalledWith('/brand');
      });
    });

    it('devrait afficher "Connexion..." pendant le chargement', async () => {
      const user = userEvent.setup();
      
      // Mock slow API response
      (global.fetch as any).mockImplementationOnce(
        () => new Promise((resolve) => setTimeout(() => resolve({
          ok: true,
          status: 200,
          json: async () => ({
            success: true,
            redirect: '/creator',
          }),
        }), 100))
      );

      render(<LoginPage />);

      const emailInput = screen.getByPlaceholderText(/vous@exemple.com/i);
      const passwordInput = screen.getByPlaceholderText(/\*\*\*\*\*\*\*\*/);
      const submitButton = screen.getByRole('button', { name: /se connecter/i });

      await user.type(emailInput, 'test@example.com');
      await user.type(passwordInput, 'password123');
      await user.click(submitButton);

      // Vérifier que le bouton affiche "Connexion..." et est désactivé
      expect(screen.getByRole('button', { name: /connexion\.\.\./i })).toBeDisabled();
    });
  });

  describe('Interface utilisateur', () => {
    it('devrait afficher tous les éléments de l\'interface', () => {
      render(<LoginPage />);

      // Vérifier la présence des éléments clés
      expect(screen.getByRole('heading', { name: /connexion a cliprace/i })).toBeInTheDocument();
      expect(screen.getByPlaceholderText(/vous@exemple.com/i)).toBeInTheDocument();
      expect(screen.getByPlaceholderText(/\*\*\*\*\*\*\*\*/)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /se connecter/i })).toBeInTheDocument();
      expect(screen.getByRole('link', { name: /mot de passe oublie/i })).toBeInTheDocument();
      expect(screen.getByRole('link', { name: /creez-en un/i })).toBeInTheDocument();
    });

    it('devrait permettre de saisir du texte dans les champs', async () => {
      const user = userEvent.setup();
      render(<LoginPage />);

      const emailInput = screen.getByPlaceholderText(/vous@exemple.com/i) as HTMLInputElement;
      const passwordInput = screen.getByPlaceholderText(/\*\*\*\*\*\*\*\*/) as HTMLInputElement;

      await user.type(emailInput, 'test@example.com');
      await user.type(passwordInput, 'mypassword');

      expect(emailInput.value).toBe('test@example.com');
      expect(passwordInput.value).toBe('mypassword');
    });
  });
});


'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
import { signupSchema, type SignupInput } from '@/lib/validators/auth';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { useToastContext } from '@/hooks/use-toast-context';
import { motion } from 'framer-motion';
import { PasswordStrength } from '@/components/auth/password-strength';

export default function SignupPage() {
  const router = useRouter();
  const { toast } = useToastContext();
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [csrfToken, setCsrfToken] = useState<string | null>(null);

  // Get CSRF token from API (cookie is httpOnly, so we need to fetch it)
  useEffect(() => {
    const fetchCsrfToken = async () => {
      try {
        const response = await fetch('/api/auth/csrf', {
          method: 'GET',
          credentials: 'include', // Important: include cookies in the request
        });
        
        if (!response.ok) {
          console.error('Failed to fetch CSRF token:', response.status, response.statusText);
          return;
        }
        
        const result = await response.json();
        if (result.ok && result.token) {
          setCsrfToken(result.token);
        } else {
          console.error('Failed to fetch CSRF token:', result.message || 'Unknown error');
        }
      } catch (error) {
        console.error('Error fetching CSRF token:', error);
      }
    };
    fetchCsrfToken();
  }, []);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    watch,
    setValue,
    trigger,
  } = useForm<SignupInput>({
    resolver: zodResolver(signupSchema),
    defaultValues: {
      password: '',
      passwordConfirm: '',
      role: undefined,
    },
    mode: 'onBlur', // Validate on blur for better UX
  });

  const selectedRole = watch('role');
  const email = watch('email');
  const password = watch('password');
  const passwordConfirm = watch('passwordConfirm');

  // Update progress based on form completion
  useEffect(() => {
    let progressValue = 0;
    if (email) progressValue += 20;
    if (password) progressValue += 20;
    if (passwordConfirm && password === passwordConfirm) progressValue += 20;
    if (selectedRole) progressValue += 40;
    setProgress(progressValue);
  }, [email, password, passwordConfirm, selectedRole]);

  const onSubmit = async (data: SignupInput) => {
    if (!csrfToken) {
      toast({
        type: 'error',
        title: 'Erreur de sécurité',
        message: 'Token CSRF manquant. Veuillez rafraîchir la page.',
      });
      return;
    }

    setLoading(true);

    try {
      // Exclure passwordConfirm du payload (pas nécessaire côté serveur)
      const { passwordConfirm: _passwordConfirm, ...payload } = data;

      const response = await fetch('/api/auth/signup', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-csrf': csrfToken,
        },
        body: JSON.stringify(payload),
      });

      const result = await response.json();

      if (!response.ok || !result.ok) {
        const errorMessage = result.message || 'Une erreur est survenue';
        const errorDetails = result.details || result.errors;
        const errorCode = result.code || 'UNKNOWN';

        // Log détaillé pour le debugging (format lisible)
        console.error('Signup error response:', {
          status: response.status,
          code: errorCode,
          message: errorMessage,
          details: errorDetails,
          fullResponse: result,
        });

        // Gestion spécifique selon le code d'erreur
        if (response.status === 429 || errorCode === 'RATE_LIMIT') {
          // Vérifier si c'est un rate limit d'email ou de requêtes
          const isEmailRateLimit = errorMessage.toLowerCase().includes('email') || 
                                   errorMessage.toLowerCase().includes('rate limit exceeded');
          
          toast({
            type: 'error',
            title: isEmailRateLimit ? 'Limite d\'emails atteinte' : 'Trop de tentatives',
            message: isEmailRateLimit
              ? 'Trop d\'emails ont été envoyés récemment. Veuillez attendre quelques minutes avant de réessayer, ou contactez le support si le problème persiste.'
              : 'Vous avez fait trop de tentatives. Veuillez attendre 1 minute avant de réessayer.',
            duration: 12000,
          });
        } else if (response.status === 409 || errorCode === 'CONFLICT') {
          // Email déjà utilisé
          toast({
            type: 'error',
            title: 'Email déjà utilisé',
            message: 'Cet email est déjà associé à un compte. Essayez de vous connecter.',
            duration: 7000,
          });
        } else if (response.status === 400 || errorCode === 'VALIDATION_ERROR') {
          // Erreur de validation
          let validationMessage = errorMessage;
          if (errorDetails && typeof errorDetails === 'object') {
            // Extraire les messages de validation spécifiques
            const fieldErrors = Object.entries(errorDetails)
              .map(([field, errors]) => {
                if (Array.isArray(errors) && errors.length > 0) {
                  const firstError = errors[0];
                  const errorMsg = typeof firstError === 'string' ? firstError : 
                                 (typeof firstError === 'object' && firstError !== null && 'message' in firstError) 
                                   ? String((firstError as { message?: string }).message) 
                                   : String(firstError);
                  return `${field}: ${errorMsg}`;
                }
                return null;
              })
              .filter((msg): msg is string => msg !== null)
              .join(', ');
            if (fieldErrors) {
              validationMessage = fieldErrors;
            }
          }
          toast({
            type: 'error',
            title: 'Données invalides',
            message: validationMessage,
            duration: 7000,
          });
        } else {
          // Autres erreurs (500, etc.)
          toast({
            type: 'error',
            title: 'Erreur lors de l\'inscription',
            message: errorMessage,
            duration: 7000,
          });
        }

        setLoading(false);
        return;
      }

      toast({
        type: 'success',
        title: 'Compte créé avec succès !',
        message: 'Vérifiez votre boîte mail pour confirmer votre compte.',
        duration: 5000,
      });

      router.push(`/auth/verify?email=${encodeURIComponent(data.email)}`);
      setLoading(false);
    } catch (err) {
      // Erreur réseau ou autre exception
      console.error('Signup network/exception error:', {
        error: err,
        message: err instanceof Error ? err.message : 'Unknown error',
        stack: err instanceof Error ? err.stack : undefined,
      });
      
      const errorMessage = err instanceof Error 
        ? err.message 
        : 'Une erreur est survenue lors de l\'inscription. Veuillez réessayer.';
      
      toast({
        type: 'error',
        title: 'Erreur de connexion',
        message: errorMessage.includes('fetch') || errorMessage.includes('network')
          ? 'Impossible de se connecter au serveur. Vérifiez votre connexion internet.'
          : errorMessage,
        duration: 7000,
      });
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-zinc-50 via-indigo-50/30 to-purple-50/30 dark:from-zinc-950 dark:via-indigo-950/30 dark:to-purple-950/30 px-4 py-12">
      {/* Progress bar */}
      <div className="fixed top-0 left-0 right-0 h-1 bg-zinc-200 dark:bg-zinc-800 z-50">
        <motion.div
          className="h-full bg-gradient-to-r from-[#635BFF] to-[#7C3AED]"
          initial={{ width: 0 }}
          animate={{ width: `${progress}%` }}
          transition={{ duration: 0.3, ease: 'easeOut' }}
        />
      </div>

      <Card className="w-full max-w-md backdrop-blur-xl bg-white/80 dark:bg-zinc-900/80 border-zinc-200/50 dark:border-zinc-800/50 shadow-2xl">
        <CardHeader className="space-y-4">
          <div className="flex items-center gap-3">
            <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-[#7C3AED] to-[#635BFF] shadow-lg flex items-center justify-center">
              <svg className="h-6 w-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
            </div>
            <div>
              <CardTitle className="text-2xl font-bold bg-gradient-to-r from-[#635BFF] to-[#7C3AED] bg-clip-text text-transparent">
                Créer un compte
              </CardTitle>
              <CardDescription className="mt-1">
                Rejoignez ClipRace et commencez votre aventure
              </CardDescription>
            </div>
          </div>
        </CardHeader>

        <form onSubmit={handleSubmit(onSubmit)} noValidate>
          <CardContent className="space-y-5">
            {/* Email */}
            <div>
              <Input
                label="Email"
                type="email"
                placeholder="votre@email.com"
                autoComplete="email"
                aria-required="true"
                aria-invalid={!!errors.email}
                aria-describedby={errors.email ? 'email-error' : undefined}
                {...register('email')}
                error={errors.email?.message}
                className="transition-all duration-200 focus:scale-[1.01]"
              />
            </div>

            {/* Password */}
            <div className="space-y-3">
              <Input
                id="password"
                label="Mot de passe"
                type="password"
                placeholder="Créez un mot de passe fort"
                autoComplete="new-password"
                aria-required="true"
                aria-invalid={!!errors.password}
                aria-describedby={errors.password ? 'password-error' : undefined}
                {...register('password')}
                error={errors.password?.message}
                className="transition-all duration-200 focus:scale-[1.01]"
              />
              
              {/* Indicateur de force du mot de passe */}
              {password && <PasswordStrength password={password} />}
            </div>

            {/* Password Confirmation */}
            <div>
              <Input
                id="passwordConfirm"
                label="Confirmer le mot de passe"
                type="password"
                placeholder="Répétez votre mot de passe"
                autoComplete="new-password"
                aria-required="true"
                aria-invalid={!!errors.passwordConfirm || (passwordConfirm ? password !== passwordConfirm : false) ? true : undefined}
                aria-describedby={errors.passwordConfirm || (passwordConfirm && password !== passwordConfirm) ? 'password-confirm-error' : undefined}
                {...register('passwordConfirm', {
                  validate: (value) => {
                    if (!value) return 'La confirmation du mot de passe est requise';
                    if (value !== password) return 'Les mots de passe ne correspondent pas';
                    return true;
                  },
                })}
                error={errors.passwordConfirm?.message || (passwordConfirm && password && password !== passwordConfirm ? 'Les mots de passe ne correspondent pas' : undefined)}
                className="transition-all duration-200 focus:scale-[1.01]"
              />
              {passwordConfirm && password && password === passwordConfirm && !errors.passwordConfirm && (
                <p className="mt-1.5 text-sm text-green-600 dark:text-green-400 flex items-center gap-1">
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  Les mots de passe correspondent
                </p>
              )}
            </div>

            {/* Role Selection */}
            <div>
              <div className="block text-sm font-medium mb-3" id="role-label">
                Je suis un... <span className="text-red-500" aria-label="requis">*</span>
              </div>
              <div className="grid grid-cols-2 gap-3" role="group" aria-labelledby="role-label">
                {/* Rôle: Créateur */}
                <motion.button
                  type="button"
                  onClick={(e) => {
                    e.preventDefault();
                    setValue('role', 'creator', { shouldValidate: true });
                    trigger('role');
                  }}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  className={`relative p-5 rounded-xl border-2 transition-all duration-200 cursor-pointer ${
                    selectedRole === 'creator'
                      ? 'border-[#635BFF] bg-gradient-to-br from-[#635BFF]/10 to-[#7C3AED]/10 shadow-lg shadow-[#635BFF]/20'
                      : 'border-zinc-200 dark:border-zinc-800 hover:border-zinc-300 dark:hover:border-zinc-700 bg-white/50 dark:bg-zinc-800/50'
                  }`}
                  aria-pressed={selectedRole === 'creator'}
                  aria-label="Sélectionner créateur"
                >
                  <input
                    id="role-creator"
                    type="radio"
                    value="creator"
                    {...register('role')}
                    onChange={() => {
                      setValue('role', 'creator', { shouldValidate: true });
                    }}
                    className="sr-only"
                    aria-labelledby="role-creator-label"
                    checked={selectedRole === 'creator'}
                  />
                  <div className="text-center">
                    <div className="text-lg font-semibold" id="role-creator-label">
                      Créateur
                    </div>
                    <div className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
                      Je crée du contenu
                    </div>
                  </div>
                  {selectedRole === 'creator' && (
                    <motion.div
                      className="absolute top-2 right-2 h-5 w-5 rounded-full bg-[#635BFF] flex items-center justify-center pointer-events-none"
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                    >
                      <svg className="h-3 w-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                      </svg>
                    </motion.div>
                  )}
                </motion.button>

                {/* Rôle: Marque */}
                <motion.button
                  type="button"
                  onClick={(e) => {
                    e.preventDefault();
                    setValue('role', 'brand', { shouldValidate: true });
                    trigger('role');
                  }}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  className={`relative p-5 rounded-xl border-2 transition-all duration-200 cursor-pointer ${
                    selectedRole === 'brand'
                      ? 'border-[#635BFF] bg-gradient-to-br from-[#635BFF]/10 to-[#7C3AED]/10 shadow-lg shadow-[#635BFF]/20'
                      : 'border-zinc-200 dark:border-zinc-800 hover:border-zinc-300 dark:hover:border-zinc-700 bg-white/50 dark:bg-zinc-800/50'
                  }`}
                  aria-pressed={selectedRole === 'brand'}
                  aria-label="Sélectionner marque"
                >
                  <input
                    id="role-brand"
                    type="radio"
                    value="brand"
                    {...register('role')}
                    onChange={() => {
                      setValue('role', 'brand', { shouldValidate: true });
                    }}
                    className="sr-only"
                    aria-labelledby="role-brand-label"
                    checked={selectedRole === 'brand'}
                  />
                  <div className="text-center">
                    <div className="text-lg font-semibold" id="role-brand-label">
                      Marque
                    </div>
                    <div className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
                      Je lance des concours
                    </div>
                  </div>
                  {selectedRole === 'brand' && (
                    <motion.div
                      className="absolute top-2 right-2 h-5 w-5 rounded-full bg-[#635BFF] flex items-center justify-center pointer-events-none"
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                    >
                      <svg className="h-3 w-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                      </svg>
                    </motion.div>
                  )}
                </motion.button>
              </div>
              {errors.role && (
                <p className="mt-2 text-sm text-red-600 dark:text-red-400" role="alert" id="role-error">
                  {errors.role.message}
                </p>
              )}
            </div>
          </CardContent>

          <CardFooter className="flex flex-col gap-4 pt-6">
            <Button
              type="submit"
              className="w-full relative overflow-hidden group"
              loading={loading || isSubmitting}
              disabled={!selectedRole || loading || isSubmitting}
            >
              <span className="relative z-10">Créer mon compte</span>
              <motion.div
                className="absolute inset-0 bg-gradient-to-r from-[#534BFF] to-[#6D28D9] pointer-events-none"
                initial={{ x: '-100%' }}
                whileHover={{ x: 0 }}
                transition={{ duration: 0.3 }}
              />
            </Button>

            <p className="text-sm text-center text-zinc-600 dark:text-zinc-400">
              Déjà un compte ?{' '}
              <Link
                href="/auth/login"
                className="text-[#635BFF] hover:text-[#534BFF] font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-[#635BFF] focus:ring-offset-2 rounded"
              >
                Se connecter
              </Link>
            </p>
          </CardFooter>
        </form>
      </Card>
    </div>
  );
}

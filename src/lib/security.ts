/**
 * Configuration de sécurité pour ClipRace
 * Protection contre les attaques courantes et validation des données
 */

// Configuration CSP (Content Security Policy)
export const cspConfig = {
  directives: {
    'default-src': ["'self'"],
    'script-src': [
      "'self'",
      "'unsafe-eval'", // Nécessaire pour Next.js en développement
      "'unsafe-inline'", // Nécessaire pour les styles inline
      'https://vercel.live',
    ],
    'style-src': [
      "'self'",
      "'unsafe-inline'", // Nécessaire pour Tailwind
      'https://fonts.googleapis.com',
    ],
    'font-src': [
      "'self'",
      'https://fonts.gstatic.com',
    ],
    'img-src': [
      "'self'",
      'data:',
      'https:',
      'blob:',
    ],
    'connect-src': [
      "'self'",
      'https://*.supabase.co',
      'https://*.supabase.io',
      'wss://*.supabase.co',
    ],
    'frame-src': ["'none'"],
    'object-src': ["'none'"],
    'base-uri': ["'self'"],
    'form-action': ["'self'"],
    'frame-ancestors': ["'none'"],
    'upgrade-insecure-requests': [],
  },
};

// Validation des entrées utilisateur
export const inputValidation = {
  // Validation des emails
  email: (email: string): boolean => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email) && email.length <= 254;
  },

  // Validation des mots de passe
  password: (password: string): { valid: boolean; errors: string[] } => {
    const errors: string[] = [];
    
    if (password.length < 8) {
      errors.push('Le mot de passe doit contenir au moins 8 caractères');
    }
    
    if (!/[A-Z]/.test(password)) {
      errors.push('Le mot de passe doit contenir au moins une majuscule');
    }
    
    if (!/[a-z]/.test(password)) {
      errors.push('Le mot de passe doit contenir au moins une minuscule');
    }
    
    if (!/[0-9]/.test(password)) {
      errors.push('Le mot de passe doit contenir au moins un chiffre');
    }
    
    if (!/[^A-Za-z0-9]/.test(password)) {
      errors.push('Le mot de passe doit contenir au moins un caractère spécial');
    }
    
    return {
      valid: errors.length === 0,
      errors,
    };
  },

  // Validation des URLs
  url: (url: string): boolean => {
    try {
      const urlObj = new URL(url);
      return ['http:', 'https:'].includes(urlObj.protocol);
    } catch {
      return false;
    }
  },

  // Validation des noms d'utilisateur
  username: (username: string): boolean => {
    const usernameRegex = /^[a-zA-Z0-9_-]{3,20}$/;
    return usernameRegex.test(username);
  },

  // Sanitisation du HTML
  sanitizeHtml: (html: string): string => {
    // Liste des balises autorisées
    const allowedTags = ['p', 'br', 'strong', 'em', 'u', 'ol', 'ul', 'li'];
    const allowedAttributes = ['href', 'target', 'rel'];
    
    // Supprimer les balises non autorisées
    let sanitized = html;
    const tagRegex = /<\/?([a-zA-Z][a-zA-Z0-9]*)\b[^<>]*>/g;
    
    sanitized = sanitized.replace(tagRegex, (match, tagName) => {
      if (allowedTags.includes(tagName.toLowerCase())) {
        return match;
      }
      return '';
    });
    
    return sanitized;
  },
};

// Protection contre les attaques XSS
export const xssProtection = {
  // Encodage des entités HTML
  encodeHtml: (text: string): string => {
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#x27;');
  },

  // Validation des données JSON
  validateJson: (json: string): { valid: boolean; data?: any; error?: string } => {
    try {
      const data = JSON.parse(json);
      return { valid: true, data };
    } catch (error) {
      return { valid: false, error: 'JSON invalide' };
    }
  },
};

// Configuration des headers de sécurité
export const securityHeaders = {
  'X-Frame-Options': 'DENY',
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'origin-when-cross-origin',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=(), payment=()',
  'Strict-Transport-Security': 'max-age=31536000; includeSubDomains; preload',
  'X-XSS-Protection': '1; mode=block',
};

// Validation des fichiers uploadés
export const fileValidation = {
  // Types de fichiers autorisés
  allowedTypes: {
    images: ['image/jpeg', 'image/png', 'image/webp', 'image/gif'],
    documents: ['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'],
    videos: ['video/mp4', 'video/webm', 'video/quicktime'],
  },

  // Tailles maximales (en bytes)
  maxSizes: {
    image: 5 * 1024 * 1024, // 5MB
    document: 10 * 1024 * 1024, // 10MB
    video: 100 * 1024 * 1024, // 100MB
  },

  // Validation d'un fichier
  validateFile: (file: File, type: 'image' | 'document' | 'video'): { valid: boolean; error?: string } => {
    const allowedTypes = fileValidation.allowedTypes[`${type}s` as keyof typeof fileValidation.allowedTypes];
    const maxSize = fileValidation.maxSizes[type];

    if (!allowedTypes.includes(file.type)) {
      return { valid: false, error: `Type de fichier non autorisé. Types acceptés: ${allowedTypes.join(', ')}` };
    }

    if (file.size > maxSize) {
      return { valid: false, error: `Fichier trop volumineux. Taille maximale: ${Math.round(maxSize / 1024 / 1024)}MB` };
    }

    return { valid: true };
  },
};

// Types pour le rate limiting
interface RateLimitConfig {
  limits: {
    login: { requests: number; window: number };
    signup: { requests: number; window: number };
    api: { requests: number; window: number };
    upload: { requests: number; window: number };
  };
  checkRateLimit: (key: string, type: keyof RateLimitConfig['limits']) => boolean;
}

// Configuration du rate limiting
export const rateLimitConfig: RateLimitConfig = {
  // Limites par type d'action
  limits: {
    login: { requests: 5, window: 15 * 60 * 1000 }, // 5 tentatives par 15 minutes
    signup: { requests: 3, window: 60 * 60 * 1000 }, // 3 inscriptions par heure
    api: { requests: 100, window: 15 * 60 * 1000 }, // 100 requêtes par 15 minutes
    upload: { requests: 10, window: 60 * 60 * 1000 }, // 10 uploads par heure
  },

  // Vérification du rate limit
  checkRateLimit: (key: string, type: keyof RateLimitConfig['limits']): boolean => {
    // Cette fonction devrait être implémentée avec un store (Redis, etc.)
    // Pour l'instant, on retourne toujours true
    return true;
  },
};

// Configuration de la sécurité des sessions
export const sessionSecurity = {
  // Durée de vie des sessions
  maxAge: 7 * 24 * 60 * 60 * 1000, // 7 jours
  refreshThreshold: 24 * 60 * 60 * 1000, // 1 jour

  // Configuration des cookies
  cookieConfig: {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax' as const,
    path: '/',
  },
};

// Fonction utilitaire pour la validation des données
export const validateData = <T>(
  data: unknown,
  schema: (data: unknown) => data is T
): { valid: boolean; data?: T; error?: string } => {
  try {
    if (schema(data)) {
      return { valid: true, data };
    } else {
      return { valid: false, error: 'Données invalides' };
    }
  } catch (error) {
    return { valid: false, error: 'Erreur de validation' };
  }
};

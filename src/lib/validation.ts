/**
 * Utilitaires de validation et sécurité
 */

export interface ValidationResult {
  isValid: boolean;
  errors: string[];
}

/**
 * Valide la force d'un mot de passe avec critères renforcés
 */
export function validatePassword(password: string): ValidationResult {
  const errors: string[] = [];

  if (password.length < 8) {
    errors.push("Le mot de passe doit contenir au moins 8 caractères");
  }

  if (password.length > 128) {
    errors.push("Le mot de passe ne peut pas dépasser 128 caractères");
  }

  if (!/(?=.*[a-z])/.test(password)) {
    errors.push("Le mot de passe doit contenir au moins une lettre minuscule");
  }

  if (!/(?=.*[A-Z])/.test(password)) {
    errors.push("Le mot de passe doit contenir au moins une lettre majuscule");
  }

  if (!/(?=.*\d)/.test(password)) {
    errors.push("Le mot de passe doit contenir au moins un chiffre");
  }

  if (!/(?=.*[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?])/.test(password)) {
    errors.push("Le mot de passe doit contenir au moins un caractère spécial");
  }

  // Vérifier les mots de passe communs
  const commonPasswords = [
    'password', '123456', '123456789', 'qwerty', 'abc123', 
    'password123', 'admin', 'letmein', 'welcome', 'monkey'
  ];
  
  if (commonPasswords.some(common => password.toLowerCase().includes(common))) {
    errors.push("Ce mot de passe est trop commun, veuillez en choisir un plus unique");
  }

  // Vérifier les séquences répétitives
  if (/(.)\1{2,}/.test(password)) {
    errors.push("Le mot de passe ne doit pas contenir de caractères répétés");
  }

  return {
    isValid: errors.length === 0,
    errors
  };
}

/**
 * Valide une adresse email avec vérifications renforcées
 */
export function validateEmail(email: string): ValidationResult {
  const errors: string[] = [];

  if (!email.trim()) {
    errors.push("L'adresse email est requise");
    return { isValid: false, errors };
  }

  const trimmedEmail = email.trim().toLowerCase();
  
  // Vérification de base
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
    errors.push("Format d'email invalide");
  }

  // Vérification de la longueur
  if (trimmedEmail.length > 254) {
    errors.push("L'adresse email est trop longue");
  }

  // Vérification des domaines temporaires
  const tempDomains = [
    '10minutemail.com', 'tempmail.org', 'guerrillamail.com', 
    'mailinator.com', 'yopmail.com', 'temp-mail.org'
  ];
  
  const domain = trimmedEmail.split('@')[1];
  if (tempDomains.some(tempDomain => domain === tempDomain)) {
    errors.push("Les adresses email temporaires ne sont pas autorisées");
  }

  // Vérification des caractères spéciaux
  if (/[<>]/.test(trimmedEmail)) {
    errors.push("L'adresse email contient des caractères non autorisés");
  }

  return {
    isValid: errors.length === 0,
    errors
  };
}

/**
 * Valide un nom (prénom, nom de famille, nom d'entreprise)
 */
export function validateName(name: string, fieldName: string = "Nom"): ValidationResult {
  const errors: string[] = [];

  if (!name.trim()) {
    errors.push(`${fieldName} est requis`);
  } else if (name.trim().length < 2) {
    errors.push(`${fieldName} doit contenir au moins 2 caractères`);
  } else if (name.trim().length > 50) {
    errors.push(`${fieldName} ne peut pas dépasser 50 caractères`);
  } else if (!/^[a-zA-ZÀ-ÿ\s\-'\.]+$/.test(name.trim())) {
    errors.push(`${fieldName} contient des caractères non autorisés`);
  }

  return {
    isValid: errors.length === 0,
    errors
  };
}

/**
 * Valide une URL
 */
export function validateUrl(url: string): ValidationResult {
  const errors: string[] = [];

  if (url && url.trim()) {
    try {
      new URL(url);
    } catch {
      errors.push("Format d'URL invalide");
    }
  }

  return {
    isValid: errors.length === 0,
    errors
  };
}

/**
 * Valide une description
 */
export function validateDescription(description: string): ValidationResult {
  const errors: string[] = [];

  if (!description.trim()) {
    errors.push("La description est requise");
  } else if (description.trim().length < 10) {
    errors.push("La description doit contenir au moins 10 caractères");
  } else if (description.trim().length > 500) {
    errors.push("La description ne peut pas dépasser 500 caractères");
  }

  return {
    isValid: errors.length === 0,
    errors
  };
}

/**
 * Valide un handle de réseau social
 */
export function validateSocialHandle(handle: string, platform: string): ValidationResult {
  const errors: string[] = [];

  if (handle && handle.trim()) {
    const cleanHandle = handle.trim().replace('@', '');
    
    if (cleanHandle.length < 2) {
      errors.push(`Le handle ${platform} doit contenir au moins 2 caractères`);
    } else if (cleanHandle.length > 30) {
      errors.push(`Le handle ${platform} ne peut pas dépasser 30 caractères`);
    } else if (!/^[a-zA-Z0-9._]+$/.test(cleanHandle)) {
      errors.push(`Le handle ${platform} contient des caractères non autorisés`);
    }
  }

  return {
    isValid: errors.length === 0,
    errors
  };
}

/**
 * Nettoie et sécurise une chaîne de caractères
 */
export function sanitizeString(input: string): string {
  return input
    .trim()
    .replace(/[<>]/g, '') // Supprime les balises HTML
    .replace(/javascript:/gi, '') // Supprime les liens javascript
    .replace(/on\w+=/gi, ''); // Supprime les événements JavaScript
}

/**
 * Génère un score de force de mot de passe (0-100)
 */
export function getPasswordStrength(password: string): number {
  let score = 0;

  // Longueur
  if (password.length >= 8) score += 20;
  if (password.length >= 12) score += 10;
  if (password.length >= 16) score += 10;

  // Caractères
  if (/[a-z]/.test(password)) score += 10;
  if (/[A-Z]/.test(password)) score += 10;
  if (/\d/.test(password)) score += 10;
  if (/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) score += 20;

  return Math.min(score, 100);
}

/**
 * Retourne un label de force de mot de passe
 */
export function getPasswordStrengthLabel(score: number): string {
  if (score < 30) return "Très faible";
  if (score < 50) return "Faible";
  if (score < 70) return "Moyen";
  if (score < 90) return "Fort";
  return "Très fort";
}

/**
 * Retourne une couleur pour la force du mot de passe
 */
export function getPasswordStrengthColor(score: number): string {
  if (score < 30) return "text-red-600";
  if (score < 50) return "text-orange-600";
  if (score < 70) return "text-yellow-600";
  if (score < 90) return "text-blue-600";
  return "text-green-600";
}

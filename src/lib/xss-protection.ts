/**
 * XSS Protection System
 * Fonctions pour échapper et sanitiser les données utilisateur
 */

/**
 * Échappe les caractères HTML dangereux
 */
export function escapeHtml(unsafe: string): string {
  if (typeof unsafe !== 'string') {
    return String(unsafe);
  }
  
  return unsafe
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
    .replace(/\//g, '&#x2F;');
}

/**
 * Échappe les caractères pour les attributs HTML
 */
export function escapeHtmlAttribute(unsafe: string): string {
  if (typeof unsafe !== 'string') {
    return String(unsafe);
  }
  
  return unsafe
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
    .replace(/\//g, '&#x2F;')
    .replace(/\s+/g, ' '); // Normaliser les espaces
}

/**
 * Échappe les caractères pour les URLs
 */
export function escapeUrl(unsafe: string): string {
  if (typeof unsafe !== 'string') {
    return '';
  }
  
  try {
    // Vérifier que c'est une URL valide
    new URL(unsafe);
    return encodeURI(unsafe);
  } catch {
    // Si ce n'est pas une URL valide, échapper complètement
    return escapeHtml(unsafe);
  }
}

/**
 * Sanitise le contenu HTML en supprimant les balises dangereuses
 */
export function sanitizeHtml(html: string): string {
  if (typeof html !== 'string') {
    return '';
  }
  
  // Liste des balises autorisées (whitelist)
  const allowedTags = [
    'p', 'br', 'strong', 'em', 'u', 'b', 'i',
    'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
    'ul', 'ol', 'li',
    'blockquote', 'code', 'pre'
  ];
  
  // Supprimer toutes les balises sauf celles autorisées
  let sanitized = html;
  
  // Supprimer les scripts et styles
  sanitized = sanitized.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');
  sanitized = sanitized.replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '');
  
  // Supprimer les attributs dangereux
  sanitized = sanitized.replace(/\s*on\w+\s*=\s*["'][^"']*["']/gi, '');
  sanitized = sanitized.replace(/\s*javascript\s*:/gi, '');
  sanitized = sanitized.replace(/\s*vbscript\s*:/gi, '');
  sanitized = sanitized.replace(/\s*data\s*:/gi, '');
  
  // Supprimer les balises non autorisées
  const tagRegex = /<\/?([a-zA-Z][a-zA-Z0-9]*)\b[^>]*>/g;
  sanitized = sanitized.replace(tagRegex, (match, tagName) => {
    if (allowedTags.includes(tagName.toLowerCase())) {
      return match;
    }
    return '';
  });
  
  return sanitized;
}

/**
 * Valide et échappe les données JSON
 */
export function sanitizeJsonData(data: any): any {
  if (typeof data === 'string') {
    return escapeHtml(data);
  }
  
  if (Array.isArray(data)) {
    return data.map(item => sanitizeJsonData(item));
  }
  
  if (data && typeof data === 'object') {
    const sanitized: Record<string, any> = {};
    for (const [key, value] of Object.entries(data)) {
      sanitized[escapeHtml(key)] = sanitizeJsonData(value);
    }
    return sanitized;
  }
  
  return data;
}

/**
 * Valide les noms de fichiers uploadés
 */
export function sanitizeFileName(fileName: string): string {
  if (typeof fileName !== 'string') {
    return 'unknown';
  }
  
  // Supprimer les caractères dangereux
  let sanitized = fileName
    .replace(/[<>:"/\\|?*]/g, '') // Caractères interdits Windows
    .replace(/\.\./g, '') // Path traversal
    .replace(/^\.+/, '') // Supprimer les points en début
    .trim();
  
  // Limiter la longueur
  if (sanitized.length > 255) {
    const ext = sanitized.split('.').pop();
    const name = sanitized.substring(0, 255 - (ext ? ext.length + 1 : 0));
    sanitized = ext ? `${name}.${ext}` : name;
  }
  
  return sanitized || 'file';
}

/**
 * Valide les types MIME des fichiers
 */
export function validateMimeType(mimeType: string): boolean {
  const allowedTypes = [
    'image/jpeg',
    'image/jpg', 
    'image/png',
    'image/gif',
    'image/webp',
    'image/svg+xml',
    'video/mp4',
    'video/webm',
    'video/quicktime',
    'application/pdf',
    'text/plain',
    'application/json'
  ];
  
  return allowedTypes.includes(mimeType.toLowerCase());
}

/**
 * Middleware pour sanitiser automatiquement les données de requête
 */
export function sanitizeRequestData(data: any): any {
  if (typeof data === 'string') {
    return escapeHtml(data);
  }
  
  if (Array.isArray(data)) {
    return data.map(item => sanitizeRequestData(item));
  }
  
  if (data && typeof data === 'object') {
    const sanitized: Record<string, any> = {};
    for (const [key, value] of Object.entries(data)) {
      // Ne pas échapper les clés système
      if (key.startsWith('_') || key === 'id' || key === 'created_at' || key === 'updated_at') {
        sanitized[key] = value;
      } else {
        sanitized[key] = sanitizeRequestData(value);
      }
    }
    return sanitized;
  }
  
  return data;
}

/**
 * Fonction utilitaire pour échapper les données dans les templates React
 */
export function escapeForReact(unsafe: string): string {
  if (typeof unsafe !== 'string') {
    return String(unsafe);
  }
  
  // Échapper les caractères spéciaux pour React
  return unsafe
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
    .replace(/\//g, '&#x2F;')
    .replace(/`/g, '&#x60;')
    .replace(/=/g, '&#x3D;');
}

/**
 * Valide les URLs pour éviter les redirections malveillantes
 */
export function validateUrl(url: string): boolean {
  if (typeof url !== 'string') {
    return false;
  }
  
  try {
    const parsedUrl = new URL(url);
    
    // Vérifier le protocole
    if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
      return false;
    }
    
    // Vérifier que ce n'est pas un localhost ou IP privée
    const hostname = parsedUrl.hostname.toLowerCase();
    if (hostname === 'localhost' || 
        hostname.startsWith('127.') || 
        hostname.startsWith('192.168.') ||
        hostname.startsWith('10.') ||
        hostname.startsWith('172.')) {
      return false;
    }
    
    return true;
  } catch {
    return false;
  }
}

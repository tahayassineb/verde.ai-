import { MOROCCO_PHONE_REGEX } from "../constants";

export interface PhoneValidationResult {
  valid: boolean;
  normalized?: string;
  error?: string;
}

export const validateMoroccoPhone = (phone: string): PhoneValidationResult => {
  // Remove all non-digits (including +)
  const cleaned = phone.replace(/\D/g, '');
  
  let normalized = cleaned;
  
  // Remove leading zeros
  normalized = normalized.replace(/^0+/, '');
  
  // Remove 212 prefix if exists to check the rest
  if (normalized.startsWith('212')) {
    normalized = normalized.substring(3);
  }
  
  // Should be 9 digits now
  if (normalized.length !== 9) {
    return { valid: false, error: 'Le numéro doit contenir 9 chiffres après l\'indicatif' };
  }
  
  // Check if starts with 6 or 7 (mobile)
  if (!normalized.startsWith('6') && !normalized.startsWith('7')) {
    return { valid: false, error: 'Le numéro doit commencer par 6 ou 7' };
  }
  
  // Valid! Return with 212 prefix (no plus)
  return { valid: true, normalized: `212${normalized}` };
};

export const formatRelativeTime = (dateString: string): string => {
  const date = new Date(dateString);
  const now = new Date();
  const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);

  if (diffInSeconds < 60) return 'à l\'instant';
  if (diffInSeconds < 3600) return `il y a ${Math.floor(diffInSeconds / 60)} min`;
  if (diffInSeconds < 86400) return `il y a ${Math.floor(diffInSeconds / 3600)} h`;
  return date.toLocaleDateString('fr-FR');
};

export const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));
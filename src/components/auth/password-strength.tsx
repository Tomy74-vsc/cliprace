'use client';

import { useMemo } from 'react';
import { Check, X } from 'lucide-react';

interface PasswordStrengthProps {
  password: string;
  className?: string;
}

interface PasswordCriteria {
  label: string;
  test: (password: string) => boolean;
}

const criteria: PasswordCriteria[] = [
  { label: 'Au moins 8 caractères', test: (pwd) => pwd.length >= 8 },
  { label: 'Au moins une majuscule', test: (pwd) => /[A-Z]/.test(pwd) },
  { label: 'Au moins une minuscule', test: (pwd) => /[a-z]/.test(pwd) },
  { label: 'Au moins un chiffre', test: (pwd) => /[0-9]/.test(pwd) },
  { label: 'Au moins un caractère spécial', test: (pwd) => /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(pwd) },
];

export function PasswordStrength({ password, className = '' }: PasswordStrengthProps) {
  const strength = useMemo(() => {
    if (!password) return { score: 0, label: '', color: 'bg-zinc-200', textColor: 'text-zinc-500' };

    const passedCriteria = criteria.filter((c) => c.test(password)).length;
    const score = Math.min(passedCriteria, 5);

    if (score <= 2) {
      return {
        score,
        label: 'Faible',
        color: 'bg-red-500',
        textColor: 'text-red-600 dark:text-red-400',
        bgColor: 'bg-red-50 dark:bg-red-950/20',
        borderColor: 'border-red-200 dark:border-red-800',
      };
    } else if (score <= 3) {
      return {
        score,
        label: 'Moyen',
        color: 'bg-yellow-500',
        textColor: 'text-yellow-600 dark:text-yellow-400',
        bgColor: 'bg-yellow-50 dark:bg-yellow-950/20',
        borderColor: 'border-yellow-200 dark:border-yellow-800',
      };
    } else if (score <= 4) {
      return {
        score,
        label: 'Fort',
        color: 'bg-blue-500',
        textColor: 'text-blue-600 dark:text-blue-400',
        bgColor: 'bg-blue-50 dark:bg-blue-950/20',
        borderColor: 'border-blue-200 dark:border-blue-800',
      };
    } else {
      return {
        score,
        label: 'Très fort',
        color: 'bg-green-500',
        textColor: 'text-green-600 dark:text-green-400',
        bgColor: 'bg-green-50 dark:bg-green-950/20',
        borderColor: 'border-green-200 dark:border-green-800',
      };
    }
  }, [password]);

  if (!password) return null;

  return (
    <div className={`space-y-3 ${className}`}>
      {/* Barre de force */}
      <div className="space-y-2">
        <div className="flex items-center justify-between text-sm">
          <span className="font-medium text-zinc-700 dark:text-zinc-300">Force du mot de passe</span>
          <span className={`font-semibold ${strength.textColor}`}>{strength.label}</span>
        </div>
        <div className="h-2 bg-zinc-200 dark:bg-zinc-800 rounded-full overflow-hidden">
          <div
            className={`h-full ${strength.color} transition-all duration-300 ease-out`}
            style={{ width: `${(strength.score / 5) * 100}%` }}
          />
        </div>
      </div>

      {/* Critères */}
      <div className={`rounded-xl border ${strength.borderColor} ${strength.bgColor} p-3 space-y-2`}>
        <div className="text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-2">Critères requis :</div>
        {criteria.map((criterion, index) => {
          const passed = criterion.test(password);
          return (
            <div key={index} className="flex items-center gap-2 text-sm">
              {passed ? (
                <Check className="h-4 w-4 text-green-600 dark:text-green-400 flex-shrink-0" />
              ) : (
                <X className="h-4 w-4 text-zinc-400 dark:text-zinc-500 flex-shrink-0" />
              )}
              <span
                className={passed ? 'text-green-700 dark:text-green-300' : 'text-zinc-600 dark:text-zinc-400'}
              >
                {criterion.label}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

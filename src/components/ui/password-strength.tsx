"use client";
import { motion } from "framer-motion";
import { getPasswordStrength } from "@/lib/validation";
import { Check, X } from "lucide-react";

interface PasswordStrengthProps {
  password: string;
  className?: string;
}

export function PasswordStrength({ password, className }: PasswordStrengthProps) {
  if (!password) return null;

  const strength = getPasswordStrength(password);

  const getStrengthInfo = () => {
    if (strength < 30) return {
      color: 'text-red-600 dark:text-red-400',
      bgColor: 'bg-red-500',
      label: 'Très faible',
      icon: X
    };
    if (strength < 50) return {
      color: 'text-orange-600 dark:text-orange-400',
      bgColor: 'bg-orange-500',
      label: 'Faible',
      icon: X
    };
    if (strength < 70) return {
      color: 'text-yellow-600 dark:text-yellow-400',
      bgColor: 'bg-yellow-500',
      label: 'Moyen',
      icon: X
    };
    if (strength < 90) return {
      color: 'text-blue-600 dark:text-blue-400',
      bgColor: 'bg-blue-500',
      label: 'Fort',
      icon: Check
    };
    return {
      color: 'text-green-600 dark:text-green-400',
      bgColor: 'bg-green-500',
      label: 'Très fort',
      icon: Check
    };
  };

  const strengthInfo = getStrengthInfo();
  const Icon = strengthInfo.icon;

  // Critères de validation
  const criteria = [
    { label: "8 caractères minimum", met: password.length >= 8 },
    { label: "Une lettre minuscule", met: /[a-z]/.test(password) },
    { label: "Une lettre majuscule", met: /[A-Z]/.test(password) },
    { label: "Un chiffre", met: /\d/.test(password) },
    { label: "Un caractère spécial", met: /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password) }
  ];

  return (
    <motion.div 
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className={`space-y-3 ${className}`}
    >
      {/* Barre de progression */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium text-zinc-700 dark:text-zinc-300">
            Force du mot de passe
          </span>
          <div className="flex items-center gap-1">
            <Icon className={`h-3 w-3 ${strengthInfo.color}`} />
            <span className={`text-xs font-semibold ${strengthInfo.color}`}>
              {strengthInfo.label}
            </span>
          </div>
        </div>
        
        <div className="w-full bg-zinc-200 dark:bg-zinc-700 rounded-full h-2 overflow-hidden">
          <motion.div
            className={`h-full ${strengthInfo.bgColor} rounded-full`}
            initial={{ width: 0 }}
            animate={{ width: `${strength}%` }}
            transition={{ 
              duration: 0.6, 
              ease: "easeOut",
              delay: 0.1 
            }}
          />
        </div>
      </div>

      {/* Critères de validation */}
      <div className="space-y-1">
        {criteria.map((criterion, index) => (
          <motion.div
            key={criterion.label}
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: index * 0.05 }}
            className="flex items-center gap-2"
          >
            <div className={`w-4 h-4 rounded-full flex items-center justify-center transition-all duration-200 ${
              criterion.met 
                ? 'bg-green-100 dark:bg-green-900/30' 
                : 'bg-zinc-100 dark:bg-zinc-800'
            }`}>
              {criterion.met ? (
                <Check className="h-2.5 w-2.5 text-green-600 dark:text-green-400" />
              ) : (
                <X className="h-2.5 w-2.5 text-zinc-400" />
              )}
            </div>
            <span className={`text-xs transition-colors duration-200 ${
              criterion.met 
                ? 'text-green-700 dark:text-green-300' 
                : 'text-zinc-500 dark:text-zinc-400'
            }`}>
              {criterion.label}
            </span>
          </motion.div>
        ))}
      </div>
    </motion.div>
  );
}

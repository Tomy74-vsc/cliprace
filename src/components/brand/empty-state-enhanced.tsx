'use client';

import { ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import {
  Trophy,
  Users,
  MessageSquare,
  FileText,
  CreditCard,
  Search,
  TrendingUp,
  Inbox,
  AlertCircle,
} from 'lucide-react';

type EmptyStateAction =
  | {
      label: string;
      href: string;
      onClick?: never;
      variant?: 'primary' | 'secondary' | 'ghost';
    }
  | {
      label: string;
      href?: never;
      onClick: () => void;
      variant?: 'primary' | 'secondary' | 'ghost';
    };

type EmptyStateType =
  | 'no-contests'
  | 'no-submissions'
  | 'no-messages'
  | 'no-payments'
  | 'no-results'
  | 'no-leaderboard'
  | 'no-notifications'
  | 'error'
  | 'default';

interface EmptyStateEnhancedProps {
  type?: EmptyStateType;
  title: string;
  description?: string;
  action?: EmptyStateAction;
  secondaryAction?: EmptyStateAction;
  className?: string;
  children?: ReactNode;
  icon?: ReactNode;
}

const iconConfig: Record<EmptyStateType, { icon: ReactNode; gradient: string }> = {
  'no-contests': {
    icon: <Trophy className="h-16 w-16" />,
    gradient: 'from-yellow-400/20 via-orange-400/10 to-transparent',
  },
  'no-submissions': {
    icon: <Users className="h-16 w-16" />,
    gradient: 'from-blue-400/20 via-purple-400/10 to-transparent',
  },
  'no-messages': {
    icon: <MessageSquare className="h-16 w-16" />,
    gradient: 'from-green-400/20 via-emerald-400/10 to-transparent',
  },
  'no-payments': {
    icon: <CreditCard className="h-16 w-16" />,
    gradient: 'from-indigo-400/20 via-blue-400/10 to-transparent',
  },
  'no-results': {
    icon: <Search className="h-16 w-16" />,
    gradient: 'from-gray-400/20 via-slate-400/10 to-transparent',
  },
  'no-leaderboard': {
    icon: <TrendingUp className="h-16 w-16" />,
    gradient: 'from-pink-400/20 via-rose-400/10 to-transparent',
  },
  'no-notifications': {
    icon: <Inbox className="h-16 w-16" />,
    gradient: 'from-cyan-400/20 via-teal-400/10 to-transparent',
  },
  error: {
    icon: <AlertCircle className="h-16 w-16" />,
    gradient: 'from-red-400/20 via-rose-400/10 to-transparent',
  },
  default: {
    icon: <FileText className="h-16 w-16" />,
    gradient: 'from-primary/20 via-accent/10 to-transparent',
  },
};

export function EmptyStateEnhanced({
  type = 'default',
  title,
  description,
  action,
  secondaryAction,
  className,
  children,
  icon,
}: EmptyStateEnhancedProps) {
  const config = iconConfig[type];
  const displayIcon = icon || config.icon;

  const renderAction = (config?: EmptyStateAction) => {
    if (!config) return null;
    if (config.href) {
      return (
        <Button asChild variant={config.variant ?? 'primary'}>
          <a href={config.href}>{config.label}</a>
        </Button>
      );
    }
    return (
      <Button onClick={config.onClick} variant={config.variant ?? 'primary'}>
        {config.label}
      </Button>
    );
  };

  return (
    <div
      className={cn(
        'relative flex flex-col items-center justify-center gap-4 rounded-3xl border border-dashed border-border bg-gradient-to-br',
        config.gradient,
        'px-6 py-12 text-center shadow-card overflow-hidden',
        className,
      )}
    >
      {/* Illustration avec animation */}
      <div className="relative z-10 flex items-center justify-center">
        <div className="relative">
          <div className="absolute inset-0 rounded-full bg-primary/10 blur-2xl animate-pulse" />
          <div className="relative text-primary/60 dark:text-primary/40 transition-colors">
            {displayIcon}
          </div>
        </div>
      </div>

      {/* Contenu */}
      <div className="relative z-10 space-y-2">
        <h3 className="text-xl font-semibold text-foreground">{title}</h3>
        {description && (
          <p className="text-sm text-muted-foreground max-w-md mx-auto leading-relaxed">
            {description}
          </p>
        )}
        {children}
      </div>

      {/* Actions */}
      {(action || secondaryAction) && (
        <div className="relative z-10 mt-2 flex flex-wrap items-center justify-center gap-3">
          {renderAction(action)}
          {renderAction(secondaryAction)}
        </div>
      )}

      {/* Décoration de fond */}
      <div className="absolute inset-0 opacity-5 dark:opacity-10">
        <svg
          className="w-full h-full"
          viewBox="0 0 400 400"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <circle cx="50" cy="50" r="2" fill="currentColor" />
          <circle cx="350" cy="100" r="2" fill="currentColor" />
          <circle cx="100" cy="350" r="2" fill="currentColor" />
          <circle cx="300" cy="300" r="1.5" fill="currentColor" />
          <circle cx="200" cy="150" r="1" fill="currentColor" />
        </svg>
      </div>
    </div>
  );
}

// Composant spécifique pour les différents types
export function BrandEmptyState({
  type,
  title,
  description,
  ...props
}: Omit<EmptyStateEnhancedProps, 'type' | 'title' | 'description'> & {
  type: EmptyStateType;
  title?: string;
  description?: string;
}) {
  const defaultConfigs: Record<EmptyStateType, Partial<EmptyStateEnhancedProps>> = {
    'no-contests': {
      title: 'Prêt à lancer ton premier concours ?',
      description:
        'Crée un concours UGC en quelques minutes et génère du contenu de qualité pour ta marque.',
    },
    'no-submissions': {
      title: 'Aucune soumission pour le moment',
      description:
        'Les créateurs peuvent soumettre leurs vidéos une fois le concours actif. Sois patient, les soumissions arrivent généralement dans les premiers jours.',
    },
    'no-messages': {
      title: 'Aucun message',
      description:
        'Les conversations avec les créateurs qui participent à tes concours apparaîtront ici.',
    },
    'no-payments': {
      title: 'Aucun paiement',
      description:
        'Tes paiements et factures Stripe s\'afficheront ici une fois que tu auras créé et financé un concours.',
    },
    'no-results': {
      title: 'Aucun résultat trouvé',
      description: 'Modifie tes filtres ou ta recherche pour voir plus de résultats.',
    },
    'no-leaderboard': {
      title: 'Classement vide',
      description:
        'Le classement sera disponible une fois que les créateurs auront soumis leurs vidéos et que celles-ci auront été approuvées.',
    },
    'no-notifications': {
      title: 'Aucune notification',
      description: 'Tu es à jour ! Toutes tes notifications importantes apparaîtront ici.',
    },
    error: {
      title: title || 'Erreur',
      description: description || 'Une erreur est survenue.',
    },
    default: {
      title: title || 'Aucun élément',
      description: description,
    },
  };

  const defaultConfig = defaultConfigs[type];

  const resolvedTitle = defaultConfig.title || title || 'Aucun élément';
  const resolvedDescription = description || defaultConfig.description;

  return (
    <EmptyStateEnhanced {...props} type={type} title={resolvedTitle} description={resolvedDescription} />
  );
}


export type AdminGuideChecklistItem = {
  key: string;
  label: string;
  description?: string;
  route?: string;
};

export type AdminGuideModule = {
  key: string;
  title: string;
  description: string;
  routePrefixes: string[];
  minute: string[];
  examples?: Array<{ title: string; steps: string[] }>;
  related?: Array<{ title: string; route: string }>;
};

export type AdminGlossaryTerm = {
  term: string;
  definition: string;
  related?: string[];
};

export const ADMIN_GUIDE_MODULES: AdminGuideModule[] = [
  {
    key: 'dashboard',
    title: 'Tableau de bord',
    description: 'Rapport global + actions prioritaires (où j’en suis, quoi traiter, quelle action).',
    routePrefixes: ['/app/admin/dashboard'],
    minute: [
      'Commence par “À faire maintenant” et traite les 3 premières tâches.',
      'Lis les Insights pour repérer anomalies et recommandations.',
      'Vérifie “Santé système” si tu as des erreurs ingestion/webhooks.',
    ],
    examples: [
      {
        title: 'Traiter une tâche “Support”',
        steps: ['Ouvre la tâche', 'Clique “Assign to me”', 'Mets le ticket à jour (status/priority)'],
      },
    ],
  },
  {
    key: 'inbox',
    title: 'À traiter (Inbox Admin)',
    description: 'File unifiée des choses à traiter (Ops Tasks + Signals).',
    routePrefixes: ['/app/admin/inbox'],
    minute: [
      'Filtre “Mon travail” pour voir tes tâches assignées.',
      'Traite d’abord les tâches “en retard / critiques”.',
      'Utilise les CTA (assigner/relancer) pour clôturer rapidement.',
    ],
  },
  {
    key: 'brands',
    title: 'Marques / Orgs',
    description: 'Créer et piloter les marques (et lancer des concours marketing).',
    routePrefixes: ['/app/admin/brands'],
    minute: [
      'Crée une marque (invite + profil brand + org + owner).',
      'Depuis une marque, clique “Créer concours”.',
      'Vérifie l’onboarding et l’activité (statuts).',
    ],
    examples: [
      {
        title: 'Créer une marque + lancer un concours',
        steps: [
          'Clique “Créer une marque”, remplis email + entreprise.',
          'Confirme l’invite envoyée (ou non).',
          'Clique “Créer concours” sur la marque créée.',
        ],
      },
    ],
    related: [{ title: 'Concours', route: '/app/admin/contests' }],
  },
  {
    key: 'contests',
    title: 'Concours',
    description: 'Lister, suivre et administrer les concours (publication, pause, fin, archive).',
    routePrefixes: ['/app/admin/contests'],
    minute: [
      'Filtre par statut (draft/active/paused/ended).',
      'Ouvre un concours pour consulter stats + leaderboard.',
      'Utilise les actions (Publier/Pause/Terminer/Archiver) selon le statut.',
    ],
    examples: [
      {
        title: 'Publier un concours',
        steps: ['Ouvre le concours', 'Clique “Publier”', 'Vérifie que le statut passe à “active”'],
      },
    ],
  },
  {
    key: 'moderation',
    title: 'Modération & Règles',
    description: 'Gérer la queue de modération et les règles automatiques.',
    routePrefixes: ['/app/admin/moderation'],
    minute: [
      'Traite la queue : claim → décision (approve/reject).',
      'Crée/édite des règles et active uniquement celles validées.',
      'Surveille l’historique pour repérer des faux positifs.',
    ],
    examples: [
      {
        title: 'Créer une règle simple (spam)',
        steps: ['Ajoute une règle', 'Choisis le type “spam”', 'Active la règle après validation'],
      },
    ],
  },
  {
    key: 'finance',
    title: 'Finance',
    description: 'Suivi et actions sensibles (cashouts, états, audit).',
    routePrefixes: ['/app/admin/finance'],
    minute: [
      'Commence par la “Queue cashouts” et trie par ancienneté.',
      'Pour chaque cashout : vérifier statut + contexte, puis approuver / mettre en hold / rejeter.',
      'Documente toujours la raison sur les actions sensibles (audit).',
    ],
    examples: [
      {
        title: 'Traiter un cashout en attente',
        steps: ['Ouvre la queue', 'Vérifie le profil et les signaux risque', 'Approuve ou mets en hold avec raison'],
      },
    ],
    related: [{ title: 'Audit', route: '/app/admin/audit' }],
  },
  {
    key: 'integrations',
    title: 'Intégrations / Webhooks',
    description: 'Surveiller endpoints & deliveries, diagnostiquer et relancer.',
    routePrefixes: ['/app/admin/integrations'],
    minute: [
      'Filtre les deliveries “failed” et regroupe par endpoint.',
      'Lis “last_error” pour identifier la cause.',
      'Relance côté système (ou corrige la config endpoint).',
    ],
  },
  {
    key: 'ingestion',
    title: 'Ingestion',
    description: 'Suivre les platform_accounts, jobs et erreurs ingestion.',
    routePrefixes: ['/app/admin/ingestion'],
    minute: [
      'Regarde d’abord les jobs “failed”.',
      'Ouvre les erreurs pour comprendre le code et le détail.',
      'Relance uniquement après correction de la cause racine (token, quota, format).',
    ],
  },
  {
    key: 'risk',
    title: 'KYC / Risque',
    description: 'Suivre les checks KYC et les risk flags (priorité & résolution).',
    routePrefixes: ['/app/admin/risk'],
    minute: [
      'Filtre les flags non résolus (critical/high).',
      'Vérifie les informations profil + historique actions.',
      'Résous/trace l’action effectuée (audit).',
    ],
  },
  {
    key: 'taxonomy',
    title: 'Tags / Médias',
    description: 'Gestion CMS-like : tags, terms, assets (recherche, cohérence, modération).',
    routePrefixes: ['/app/admin/taxonomy'],
    minute: [
      'Nettoie les doublons (slug) et garde des tags actifs cohérents.',
      'Vérifie les assets “pending/rejected” pour modération storage.',
      'Utilise la recherche pour retrouver rapidement un terme.',
    ],
  },
  {
    key: 'emails',
    title: 'Emails',
    description: 'Templates, outbox et logs (campagnes, debug délivrabilité).',
    routePrefixes: ['/app/admin/emails'],
    minute: [
      'Maintiens des templates simples et testables.',
      'Utilise “Campaign” pour envoi segmenté et limite raisonnable.',
      'En cas d’échec, ouvre email_logs pour l’erreur provider.',
    ],
  },
  {
    key: 'crm',
    title: 'CRM',
    description: 'Pipeline de leads (assignation, statut, valeur).',
    routePrefixes: ['/app/admin/crm'],
    minute: [
      'Assigne-toi un lead puis avance le statut (new → contacted → qualified…).',
      'Renseigne une valeur quand la qualification est faite.',
      'Nettoie les leads perdus (lost) pour garder un pipeline lisible.',
    ],
  },
  {
    key: 'support',
    title: 'Support',
    description: 'Tickets support (statuts, priorité, assignation, notes internes).',
    routePrefixes: ['/app/admin/support'],
    minute: [
      'Filtre open/pending et trie par priorité.',
      'Assigne-toi un ticket et ajoute une note interne concise.',
      'Passe à resolved/closed quand l’action est terminée.',
    ],
  },
  {
    key: 'audit',
    title: 'Audit',
    description: 'Traçabilité des actions (audit_logs, status_history, event_log).',
    routePrefixes: ['/app/admin/audit'],
    minute: [
      'Recherche par table/action pour comprendre une modification.',
      'Croise audit_logs et status_history pour reconstruire une timeline.',
      'Utilise l’export CSV si tu dois analyser en dehors.',
    ],
  },
  {
    key: 'team',
    title: 'Équipe admin (RBAC)',
    description: 'Gérer les admins et leurs droits (rôles + lecture/écriture).',
    routePrefixes: ['/app/admin/team'],
    minute: [
      'Ajoute un admin avec un rôle minimal (principle of least privilege).',
      'Active/désactive l’accès si besoin.',
      'Pour les actions sensibles, vérifie audit et double confirmation (break-glass).',
    ],
  },
  {
    key: 'settings',
    title: 'Paramètres / Feature flags',
    description: 'Configuration plateforme (à manipuler avec prudence).',
    routePrefixes: ['/app/admin/settings'],
    minute: [
      'Change un paramètre à la fois, avec intention claire.',
      'Utilise feature flags pour déployer progressivement.',
      'Surveille l’audit après modification.',
    ],
  },
  {
    key: 'exports',
    title: 'Exports',
    description: 'Exports CSV étendus (contrôlés par permissions).',
    routePrefixes: ['/app/admin/exports'],
    minute: [
      'Choisis la table et un filtre (q) si nécessaire.',
      'Utilise une limite raisonnable pour éviter des exports lourds.',
      'Vérifie que tu as la permission exports.write.',
    ],
  },
];

export const ADMIN_GUIDE_GLOSSARY: AdminGlossaryTerm[] = [
  {
    term: 'Ops Task',
    definition: 'Élément “à traiter” lié à l’opérationnel (cashout en attente, webhook en échec, modération…).',
    related: ['Inbox Admin', 'SLA'],
  },
  {
    term: 'Signal',
    definition: 'Alerte ou insight non bloquant mais actionnable (spike d’erreurs, baisse de conversion…).',
    related: ['Dashboard', 'Insights'],
  },
  {
    term: 'SLA',
    definition: 'Indicateur de délai attendu de traitement (temps en attente, priorité, propriétaire).',
    related: ['Inbox Admin'],
  },
  {
    term: 'RBAC',
    definition: 'Role-Based Access Control : gestion des droits par rôles et permissions (read/write).',
    related: ['Équipe admin', 'Permissions'],
  },
  {
    term: 'Break-glass',
    definition:
      'Mode “action sensible” : confirmation explicite + raison obligatoire pour certaines mutations (finance/settings/team).',
    related: ['Audit', 'Finance', 'Paramètres'],
  },
  {
    term: 'Webhook delivery',
    definition: 'Tentative d’envoi d’un événement vers un endpoint (pending/success/failed).',
    related: ['Intégrations'],
  },
  {
    term: 'KYC',
    definition: 'Know Your Customer : vérification d’identité / conformité (statuts pending/verified/failed).',
    related: ['Risque'],
  },
];

export const ADMIN_GUIDE_ONBOARDING_CHECKLIST: AdminGuideChecklistItem[] = [
  {
    key: 'open-dashboard',
    label: 'Comprendre le dashboard',
    description: 'Savoir lire “À faire”, “Santé”, “Marketing”, “Journal”.',
    route: '/app/admin/dashboard',
  },
  {
    key: 'setup-rbac',
    label: 'Configurer l’équipe admin (RBAC)',
    description: 'Créer 1 admin test en lecture seule + 1 admin marketing.',
    route: '/app/admin/team',
  },
  {
    key: 'create-brand',
    label: 'Créer une marque',
    description: 'Créer un compte marque + org + owner via l’admin.',
    route: '/app/admin/brands',
  },
  {
    key: 'create-contest',
    label: 'Créer un concours marketing',
    description: 'Réutiliser le wizard pour la marque sélectionnée.',
    route: '/app/admin/contests',
  },
  {
    key: 'moderation-rules',
    label: 'Mettre en place des règles de modération',
    description: 'Créer 1 règle simple et vérifier l’historique.',
    route: '/app/admin/moderation',
  },
  {
    key: 'webhooks-health',
    label: 'Vérifier la santé webhooks',
    description: 'Consulter endpoints + deliveries failed et comprendre les erreurs.',
    route: '/app/admin/integrations',
  },
  {
    key: 'process-cashout',
    label: 'Traiter un cashout',
    description: 'Approuver/hold/rejeter avec raison (audit).',
    route: '/app/admin/finance',
  },
  {
    key: 'email-campaign',
    label: 'Envoyer une campagne email test',
    description: 'Utiliser un template email + segment limité.',
    route: '/app/admin/emails',
  },
];


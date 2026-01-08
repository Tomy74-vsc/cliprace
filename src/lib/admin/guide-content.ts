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
    description: 'Vue globale: KPIs, alertes, actions rapides, sante systeme.',
    routePrefixes: ['/app/admin/dashboard'],
    minute: [
      'Commence par la section A faire pour traiter les urgences.',
      'Controle la sante (webhooks, ingestion) avant toute action lourde.',
      'Ouvre un module depuis une carte pour aller a la source.',
      'Note les anomalies importantes pour audit ou support.',
    ],
    examples: [
      {
        title: 'Diagnostiquer une chute de soumissions',
        steps: [
          'Regarde les KPIs sur 7 jours.',
          'Ouvre le concours en cause pour verifier le statut.',
          'Passe sur Integrations/Ingestion si tu vois des erreurs.',
        ],
      },
    ],
    related: [
      { title: 'Inbox', route: '/app/admin/inbox' },
      { title: 'Integrations', route: '/app/admin/integrations' },
      { title: 'Finance', route: '/app/admin/finance' },
    ],
  },
  {
    key: 'inbox',
    title: 'A traiter (Inbox Admin)',
    description: 'File unique des actions a traiter (tasks, SLA, assignations).',
    routePrefixes: ['/app/admin/inbox'],
    minute: [
      'Filtre Mon travail pour voir tes taches assignees.',
      'Assigne-toi avant de modifier un item.',
      'Passe en done avec une note courte et claire.',
      'Si blocage, cree une note interne ou reoriente vers support.',
    ],
    examples: [
      {
        title: 'Traiter une tache critique',
        steps: ['Ouvre la tache', 'Assigne-toi', 'Agis puis cloture avec une raison'],
      },
    ],
    related: [
      { title: 'Support', route: '/app/admin/support' },
      { title: 'Moderation', route: '/app/admin/moderation' },
      { title: 'Finance', route: '/app/admin/finance' },
    ],
  },
  {
    key: 'brands',
    title: 'Marques / Orgs',
    description: 'Creer marques et orgs, suivre onboarding, lancer concours.',
    routePrefixes: ['/app/admin/brands'],
    minute: [
      'Cree une marque avec email, company, org et owner.',
      'Verifie le statut onboarding et activite.',
      'Lance un concours depuis la marque.',
      'Ouvre le profil utilisateur si besoin de support.',
    ],
    examples: [
      {
        title: 'Creer une marque et ouvrir le wizard',
        steps: [
          'Renseigne email + entreprise.',
          'Valide la creation.',
          'Clique Creer concours pour ouvrir le wizard.',
        ],
      },
    ],
    related: [
      { title: 'Concours', route: '/app/admin/contests' },
      { title: 'Utilisateurs', route: '/app/admin/users' },
    ],
  },
  {
    key: 'contests',
    title: 'Concours',
    description: 'Lister, filtrer, publier, suivre stats et paiements.',
    routePrefixes: ['/app/admin/contests'],
    minute: [
      'Filtre par statut (draft/active/paused/ended).',
      'Ouvre un concours pour stats, leaderboard et actions.',
      'Publie, pause ou termine selon le workflow.',
      'Croise avec les soumissions pour controler la qualite.',
    ],
    examples: [
      {
        title: 'Publier un concours',
        steps: ['Ouvre le concours', 'Clique Publier', 'Verifie le statut actif'],
      },
    ],
    related: [
      { title: 'Soumissions', route: '/app/admin/submissions' },
      { title: 'Marques', route: '/app/admin/brands' },
    ],
  },
  {
    key: 'submissions',
    title: 'Soumissions',
    description: 'Suivi des soumissions, statuts, liens contest/creator.',
    routePrefixes: ['/app/admin/submissions'],
    minute: [
      'Filtre par concours ou statut pour trouver rapidement.',
      'Verifie le contenu et les metrics avant decision.',
      'Utilise les actions pour approuver ou rejeter avec raison.',
    ],
    examples: [
      {
        title: 'Refuser une soumission suspecte',
        steps: ['Ouvre la soumission', 'Ajoute une raison claire', 'Verifie le profil creator'],
      },
    ],
    related: [
      { title: 'Moderation', route: '/app/admin/moderation' },
      { title: 'Concours', route: '/app/admin/contests' },
    ],
  },
  {
    key: 'moderation',
    title: 'Moderation & Regles',
    description: 'Queue moderation, regles automatiques, historique.',
    routePrefixes: ['/app/admin/moderation'],
    minute: [
      'Claim un item avant de decider.',
      'Cree des regles simples puis active uniquement celles valides.',
      'Surveille l historique pour eviter les faux positifs.',
      'Utilise les raisons pour garder un audit clair.',
    ],
    examples: [
      {
        title: 'Creer une regle anti-spam',
        steps: ['Ajoute une regle', 'Choisis le type spam', 'Active apres validation'],
      },
    ],
    related: [
      { title: 'Soumissions', route: '/app/admin/submissions' },
      { title: 'Concours', route: '/app/admin/contests' },
    ],
  },
  {
    key: 'integrations',
    title: 'Integrations / Webhooks',
    description: 'Endpoints, deliveries, erreurs et retries.',
    routePrefixes: ['/app/admin/integrations'],
    minute: [
      'Filtre les deliveries failed.',
      'Lis last_error pour comprendre la cause.',
      'Relance avec une raison si besoin.',
      'Verifie la config endpoint.',
    ],
    examples: [
      {
        title: 'Relancer une delivery en echec',
        steps: ['Ouvre la delivery', 'Lis last_error', 'Clique retry'],
      },
    ],
    related: [
      { title: 'Dashboard', route: '/app/admin/dashboard' },
      { title: 'Ingestion', route: '/app/admin/ingestion' },
    ],
  },
  {
    key: 'ingestion',
    title: 'Ingestion',
    description: 'Comptes plateformes, jobs, erreurs ingestion.',
    routePrefixes: ['/app/admin/ingestion'],
    minute: [
      'Repere les jobs failed ou stuck.',
      'Ouvre les erreurs pour details.',
      'Relance seulement apres correction.',
    ],
    examples: [
      {
        title: 'Resoudre un job failed',
        steps: ['Ouvre l erreur', 'Corrige la cause', 'Relance le job'],
      },
    ],
    related: [
      { title: 'Integrations', route: '/app/admin/integrations' },
    ],
  },
  {
    key: 'risk',
    title: 'KYC / Risque',
    description: 'KYC et risk flags avec impact finance.',
    routePrefixes: ['/app/admin/risk'],
    minute: [
      'Filtre les flags critical/high.',
      'Verifie le profil et l historique.',
      'Resolus avec une raison claire.',
      'Si besoin, bloque un cashout.',
    ],
    examples: [
      {
        title: 'Traiter un risk flag',
        steps: ['Ouvre le profil', 'Verifie KYC', 'Resolus avec raison'],
      },
    ],
    related: [
      { title: 'Finance', route: '/app/admin/finance' },
      { title: 'Utilisateurs', route: '/app/admin/users' },
    ],
  },
  {
    key: 'taxonomy',
    title: 'Tags / Medias',
    description: 'Tags, termes, assets, coherence.',
    routePrefixes: ['/app/admin/taxonomy'],
    minute: [
      'Nettoie les doublons et slugs.',
      'Maintiens des tags actifs coherents.',
      'Modere les assets en attente.',
    ],
    examples: [
      {
        title: 'Nettoyer un tag en doublon',
        steps: ['Trouve le doublon', 'Garde le tag principal', 'Archive le doublon'],
      },
    ],
    related: [
      { title: 'Concours', route: '/app/admin/contests' },
    ],
  },
  {
    key: 'users',
    title: 'Utilisateurs',
    description: 'Recherche profils, roles, brand/creator details, impersonation.',
    routePrefixes: ['/app/admin/users'],
    minute: [
      'Recherche par email, nom ou id.',
      'Verifie role, statut et onboarding.',
      'Ouvre le profil brand/creator pour le contexte.',
      'Utilise impersonation avec une raison.',
    ],
    examples: [
      {
        title: 'Verifier un compte marque',
        steps: ['Ouvre la fiche user', 'Controle role et org', 'Passe sur marques si besoin'],
      },
    ],
    related: [
      { title: 'Marques', route: '/app/admin/brands' },
      { title: 'Risque', route: '/app/admin/risk' },
    ],
  },
  {
    key: 'finance',
    title: 'Finance',
    description: 'Cashouts, ledger, anomalies, audit.',
    routePrefixes: ['/app/admin/finance'],
    minute: [
      'Commence par la queue cashouts.',
      'Controle KYC et risk flags avant validation.',
      'Approuve, hold ou rejette avec raison.',
      'Consulte le ledger pour contexte global.',
    ],
    examples: [
      {
        title: 'Mettre en hold un cashout',
        steps: ['Ouvre le cashout', 'Controle les signaux', 'Ajoute une raison'],
      },
    ],
    related: [
      { title: 'Risque', route: '/app/admin/risk' },
      { title: 'Factures', route: '/app/admin/invoices' },
    ],
  },
  {
    key: 'invoices',
    title: 'Factures',
    description: 'Generation, statut, documents.',
    routePrefixes: ['/app/admin/invoices'],
    minute: [
      'Filtre par statut pour prioriser.',
      'Genere ou annule avec une raison.',
      'Telecharge le PDF pour verification.',
    ],
    examples: [
      {
        title: 'Generer une facture',
        steps: ['Ouvre la facture', 'Clique Generate', 'Verifie le PDF'],
      },
    ],
    related: [
      { title: 'Finance', route: '/app/admin/finance' },
    ],
  },
  {
    key: 'emails',
    title: 'Emails',
    description: 'Templates, envois, logs, segmentation.',
    routePrefixes: ['/app/admin/emails'],
    minute: [
      'Choisis un template et verifie les variables.',
      'Definis recipients ou segment.',
      'Planifie l envoi si besoin.',
      'Controle les logs apres dispatch.',
    ],
    examples: [
      {
        title: 'Envoyer un test email',
        steps: ['Choisis un template', 'Ajoute un recipient', 'Clique dispatch'],
      },
    ],
    related: [
      { title: 'Audit', route: '/app/admin/audit' },
    ],
  },
  {
    key: 'crm',
    title: 'CRM',
    description: 'Pipeline leads, assignation, suivi.',
    routePrefixes: ['/app/admin/crm'],
    minute: [
      'Assigne-toi un lead.',
      'Avance le statut (new, contacted, qualified).',
      'Renseigne la valeur quand cest valide.',
    ],
    examples: [
      {
        title: 'Qualifier un lead',
        steps: ['Assigne-toi', 'Passe en qualified', 'Ajoute une valeur'],
      },
    ],
    related: [
      { title: 'Support', route: '/app/admin/support' },
    ],
  },
  {
    key: 'support',
    title: 'Support',
    description: 'Tickets support, SLA, notes internes.',
    routePrefixes: ['/app/admin/support'],
    minute: [
      'Filtre open/pending.',
      'Assigne-toi un ticket.',
      'Ajoute une note interne claire.',
      'Passe en resolved/closed a la fin.',
    ],
    examples: [
      {
        title: 'Resoudre un ticket',
        steps: ['Verifie le contexte', 'Ajoute une note', 'Cloture'],
      },
    ],
    related: [
      { title: 'Inbox', route: '/app/admin/inbox' },
    ],
  },
  {
    key: 'audit',
    title: 'Audit',
    description: 'Trace des actions: audit_logs, status_history, event_log.',
    routePrefixes: ['/app/admin/audit'],
    minute: [
      'Filtre par table ou action.',
      'Ouvre un row id pour contexte.',
      'Exporte si tu dois analyser hors admin.',
    ],
    examples: [
      {
        title: 'Tracer une action admin',
        steps: ['Filtre par action', 'Lis actor et reason', 'Ouvre la ressource'],
      },
    ],
    related: [
      { title: 'Utilisateurs', route: '/app/admin/users' },
      { title: 'Finance', route: '/app/admin/finance' },
    ],
  },
  {
    key: 'team',
    title: 'Equipe admin (RBAC)',
    description: 'Gestion des admins et permissions.',
    routePrefixes: ['/app/admin/team'],
    minute: [
      'Ajoute un admin avec un role minimal.',
      'Active lecture seule si besoin.',
      'Verifie les overrides avant actions sensibles.',
    ],
    examples: [
      {
        title: 'Creer un admin marketing',
        steps: ['Ajoute un admin', 'Assigne le role marketing', 'Verifie les droits'],
      },
    ],
    related: [
      { title: 'Parametres', route: '/app/admin/settings' },
    ],
  },
  {
    key: 'settings',
    title: 'Parametres / Feature flags',
    description: 'Configuration plateforme et flags.',
    routePrefixes: ['/app/admin/settings'],
    minute: [
      'Change un parametre a la fois.',
      'Documente la raison de modification.',
      'Utilise un flag pour rollout progressif.',
    ],
    examples: [
      {
        title: 'Activer un feature flag',
        steps: ['Selectionne le flag', 'Active', 'Verifie impact'],
      },
    ],
    related: [
      { title: 'Audit', route: '/app/admin/audit' },
    ],
  },
  {
    key: 'exports',
    title: 'Exports',
    description: 'Exports CSV pour analyse externe.',
    routePrefixes: ['/app/admin/exports'],
    minute: [
      'Choisis la table ou le dataset.',
      'Ajoute un filtre si besoin.',
      'Limite la taille pour eviter un export lourd.',
    ],
    examples: [
      {
        title: 'Exporter les cashouts du mois',
        steps: ['Selectionne cashouts', 'Filtre par date', 'Telecharge le CSV'],
      },
    ],
    related: [
      { title: 'Finance', route: '/app/admin/finance' },
    ],
  },
];

export const ADMIN_GUIDE_GLOSSARY: AdminGlossaryTerm[] = [
  {
    term: 'Ops Task',
    definition: 'Ã‰lÃ©ment â€œÃ  traiterâ€ liÃ© Ã  lâ€™opÃ©rationnel (cashout en attente, webhook en Ã©chec, modÃ©rationâ€¦).',
    related: ['Inbox Admin', 'SLA'],
  },
  {
    term: 'Signal',
    definition: 'Alerte ou insight non bloquant mais actionnable (spike dâ€™erreurs, baisse de conversionâ€¦).',
    related: ['Dashboard', 'Insights'],
  },
  {
    term: 'SLA',
    definition: 'Indicateur de dÃ©lai attendu de traitement (temps en attente, prioritÃ©, propriÃ©taire).',
    related: ['Inbox Admin'],
  },
  {
    term: 'RBAC',
    definition: 'Role-Based Access Control : gestion des droits par rÃ´les et permissions (read/write).',
    related: ['Ã‰quipe admin', 'Permissions'],
  },
  {
    term: 'Break-glass',
    definition:
      'Mode â€œaction sensibleâ€ : confirmation explicite + raison obligatoire pour certaines mutations (finance/settings/team).',
    related: ['Audit', 'Finance', 'ParamÃ¨tres'],
  },
  {
    term: 'Webhook delivery',
    definition: 'Tentative dâ€™envoi dâ€™un Ã©vÃ©nement vers un endpoint (pending/success/failed).',
    related: ['IntÃ©grations'],
  },
  {
    term: 'KYC',
    definition: 'Know Your Customer : vÃ©rification dâ€™identitÃ© / conformitÃ© (statuts pending/verified/failed).',
    related: ['Risque'],
  },
];

export const ADMIN_GUIDE_ONBOARDING_CHECKLIST: AdminGuideChecklistItem[] = [
  {
    key: 'open-dashboard',
    label: 'Comprendre le dashboard',
    description: 'Savoir lire â€œÃ€ faireâ€, â€œSantÃ©â€, â€œMarketingâ€, â€œJournalâ€.',
    route: '/app/admin/dashboard',
  },
  {
    key: 'setup-rbac',
    label: 'Configurer lâ€™Ã©quipe admin (RBAC)',
    description: 'CrÃ©er 1 admin test en lecture seule + 1 admin marketing.',
    route: '/app/admin/team',
  },
  {
    key: 'create-brand',
    label: 'CrÃ©er une marque',
    description: 'CrÃ©er un compte marque + org + owner via lâ€™admin.',
    route: '/app/admin/brands',
  },
  {
    key: 'create-contest',
    label: 'CrÃ©er un concours marketing',
    description: 'RÃ©utiliser le wizard pour la marque sÃ©lectionnÃ©e.',
    route: '/app/admin/contests',
  },
  {
    key: 'moderation-rules',
    label: 'Mettre en place des rÃ¨gles de modÃ©ration',
    description: 'CrÃ©er 1 rÃ¨gle simple et vÃ©rifier lâ€™historique.',
    route: '/app/admin/moderation',
  },
  {
    key: 'webhooks-health',
    label: 'VÃ©rifier la santÃ© webhooks',
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
    description: 'Utiliser un template email + segment limitÃ©.',
    route: '/app/admin/emails',
  },
];


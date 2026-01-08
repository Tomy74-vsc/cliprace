'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, Sparkles, History, CheckCircle2, XCircle } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { AdminTable } from '@/components/admin/admin-table';
import { AdminActionPanel } from '@/components/admin/admin-action-panel';
import { useToastContext } from '@/hooks/use-toast-context';
import { formatDateTime } from '@/lib/formatters';
import { cn } from '@/lib/utils';
import { getCsrfToken } from '@/lib/csrf-client';

type RuleType = 'content' | 'spam' | 'duplicate' | 'domain' | 'flood';
type RuleStatus = 'draft' | 'published';

export type ModerationRule = {
  id: string;
  name: string;
  description: string | null;
  rule_type: RuleType;
  config: Record<string, unknown>;
  status?: RuleStatus;
  version?: number;
  is_active: boolean;
  published_at?: string | null;
  created_at: string;
  updated_at: string;
};

export interface AdminModerationRulesProps {
  rules: ModerationRule[];
  canWrite?: boolean;
}

type SimulateResponse =
  | { supported: false; message?: string }
  | {
      supported: true;
      scanned_total: number;
      matched_total: number;
      truncated: boolean;
      daily: Array<{ date: string; matched: number }>;
    };

type VersionRow = {
  id: number;
  rule_id: string;
  version: number;
  snapshot: UnsafeAny;
  created_at: string;
  created_by: string | null;
};

const RULE_TYPE_LABEL: Record<RuleType, string> = {
  content: 'Contenu',
  spam: 'Spam',
  duplicate: 'Doublon',
  domain: 'Domaine',
  flood: 'Flood',
};

function toList(value: unknown): string[] {
  if (Array.isArray(value)) return value.filter((v) => typeof v === 'string').map((s) => s.trim()).filter(Boolean);
  if (typeof value === 'string') return value.split(',').map((s) => s.trim()).filter(Boolean);
  return [];
}

function summarizeConfig(ruleType: RuleType, config: Record<string, unknown>) {
  if (ruleType === 'domain') {
    const domains = toList((config as UnsafeAny).domains);
    if (domains.length === 0) return 'Domaines non renseignés';
    return `Domaines: ${domains.slice(0, 3).join(', ')}${domains.length > 3 ? ` (+${domains.length - 3})` : ''}`;
  }

  if (ruleType === 'spam') {
    const keywords = toList((config as UnsafeAny).keywords);
    if (keywords.length === 0) return 'Mots-clés non renseignés';
    return `Mots-clés: ${keywords.slice(0, 3).join(', ')}${keywords.length > 3 ? ` (+${keywords.length - 3})` : ''}`;
  }

  if (ruleType === 'content') {
    const contains = typeof (config as UnsafeAny).contains === 'string' ? (config as UnsafeAny).contains.trim() : '';
    const field = (config as UnsafeAny).field === 'external_url' ? 'URL' : 'Titre';
    if (!contains) return 'Motif non renseigné';
    return `Contient \"${contains}\" dans ${field}`;
  }

  if (ruleType === 'duplicate') {
    const windowHours = Number((config as UnsafeAny).window_hours ?? 24);
    return `Fenêtre: ${Number.isFinite(windowHours) ? windowHours : 24}h`;
  }

  if (ruleType === 'flood') {
    const maxPerHour = Number((config as UnsafeAny).max_per_hour ?? 10);
    return `Limite: ${Number.isFinite(maxPerHour) ? maxPerHour : 10}/h`;
  }

  return '—';
}

function normalizeStatus(value: unknown): RuleStatus {
  return value === 'draft' ? 'draft' : 'published';
}

function statusBadge(status: RuleStatus) {
  return status === 'draft' ? <Badge variant="secondary">Brouillon</Badge> : <Badge variant="success">Publié</Badge>;
}

function activeBadge(isActive: boolean) {
  return isActive ? <Badge variant="success">Actif</Badge> : <Badge variant="warning">Inactif</Badge>;
}

function SmallBarChart({ data }: { data: Array<{ date: string; matched: number }> }) {
  const max = Math.max(1, ...data.map((d) => d.matched));
  return (
    <div className="space-y-2">
      {data.map((d) => (
        <div key={d.date} className="flex items-center gap-3">
          <div className="w-24 text-xs text-muted-foreground">
            {new Date(d.date).toLocaleDateString('fr-FR', { weekday: 'short', day: '2-digit', month: 'short' })}
          </div>
          <div className="flex-1">
            <div className="h-2 rounded-full bg-muted overflow-hidden">
              <div className="h-full bg-primary" style={{ width: `${Math.round((d.matched / max) * 100)}%` }} />
            </div>
          </div>
          <div className="w-10 text-right text-xs text-muted-foreground">{d.matched}</div>
        </div>
      ))}
    </div>
  );
}

type WizardMode = { mode: 'create' } | { mode: 'edit'; rule: ModerationRule };

function WizardDialog({
  open,
  onOpenChange,
  initial,
  canWrite,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  initial: WizardMode;
  canWrite: boolean;
}) {
  const router = useRouter();
  const { toast } = useToastContext();

  const [saving, setSaving] = useState(false);
  const [tab, setTab] = useState<'template' | 'config' | 'preview'>('template');

  const [ruleType, setRuleType] = useState<RuleType>('content');
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [status, setStatus] = useState<RuleStatus>('draft');
  const [isActive, setIsActive] = useState(false);

  const [domainsText, setDomainsText] = useState('');
  const [keywordsText, setKeywordsText] = useState('');
  const [containsField, setContainsField] = useState<'title' | 'external_url'>('title');
  const [containsText, setContainsText] = useState('');
  const [windowHours, setWindowHours] = useState(24);
  const [maxPerHour, setMaxPerHour] = useState(10);

  const [sim, setSim] = useState<SimulateResponse | null>(null);
  const [simLoading, setSimLoading] = useState(false);

  useEffect(() => {
    if (!open) return;

    setTab('template');
    setSim(null);

    if (initial.mode === 'edit') {
      const rule = initial.rule;
      setRuleType(rule.rule_type);
      setName(rule.name);
      setDescription(rule.description ?? '');
      setStatus(normalizeStatus(rule.status));
      setIsActive(rule.status === 'draft' ? false : Boolean(rule.is_active));

      if (rule.rule_type === 'domain') setDomainsText(toList((rule.config as UnsafeAny).domains).join(', '));
      if (rule.rule_type === 'spam') setKeywordsText(toList((rule.config as UnsafeAny).keywords).join(', '));
      if (rule.rule_type === 'content') {
        setContainsField((rule.config as UnsafeAny).field === 'external_url' ? 'external_url' : 'title');
        setContainsText(typeof (rule.config as UnsafeAny).contains === 'string' ? (rule.config as UnsafeAny).contains : '');
      }
      if (rule.rule_type === 'duplicate') setWindowHours(Number((rule.config as UnsafeAny).window_hours ?? 24));
      if (rule.rule_type === 'flood') setMaxPerHour(Number((rule.config as UnsafeAny).max_per_hour ?? 10));
      return;
    }

    setRuleType('content');
    setName('');
    setDescription('');
    setStatus('draft');
    setIsActive(false);
    setDomainsText('');
    setKeywordsText('');
    setContainsField('title');
    setContainsText('');
    setWindowHours(24);
    setMaxPerHour(10);
  }, [initial, open]);

  const config = useMemo<Record<string, unknown>>(() => {
    if (ruleType === 'domain') return { domains: toList(domainsText) };
    if (ruleType === 'spam') return { keywords: toList(keywordsText) };
    if (ruleType === 'content') return { field: containsField, contains: containsText.trim() };
    if (ruleType === 'duplicate') return { window_hours: Number.isFinite(windowHours) ? windowHours : 24 };
    if (ruleType === 'flood') return { max_per_hour: Number.isFinite(maxPerHour) ? maxPerHour : 10 };
    return {};
  }, [containsField, containsText, domainsText, keywordsText, maxPerHour, ruleType, windowHours]);

  const summary = useMemo(() => summarizeConfig(ruleType, config), [ruleType, config]);
  const canSimulate = ruleType === 'domain' || ruleType === 'spam' || ruleType === 'content';

  const runSimulation = async () => {
    if (!canSimulate) return;
    setSimLoading(true);
    setSim(null);
    try {
      const res = await fetch('/api/admin/moderation/rules/simulate', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ rule_type: ruleType, config }),
      });
      const data = (await res.json()) as SimulateResponse;
      setSim(data);
    } catch (error) {
      setSim({ supported: false, message: error instanceof Error ? error.message : 'Simulation impossible.' });
    } finally {
      setSimLoading(false);
    }
  };

  const save = async () => {
    if (!canWrite) {
      toast({ type: 'warning', title: 'Lecture seule', message: "Vous n'avez pas les droits pour modifier les règles." });
      return;
    }

    const trimmedName = name.trim();
    if (trimmedName.length < 2) {
      toast({ type: 'warning', title: 'Nom requis', message: 'Donne un nom clair à la règle.' });
      return;
    }

    if (ruleType === 'domain' && toList(domainsText).length === 0) {
      toast({ type: 'warning', title: 'Domaines requis', message: 'Ajoute au moins un domaine.' });
      return;
    }

    if (ruleType === 'spam' && toList(keywordsText).length === 0) {
      toast({ type: 'warning', title: 'Mots-clés requis', message: 'Ajoute au moins un mot-clé.' });
      return;
    }

    if (ruleType === 'content' && !containsText.trim()) {
      toast({ type: 'warning', title: 'Motif requis', message: 'Renseigne ce que tu veux détecter.' });
      return;
    }

    const effectiveIsActive = status === 'draft' ? false : Boolean(isActive);
    const payload = {
      name: trimmedName,
      description: description.trim() ? description.trim() : null,
      rule_type: ruleType,
      config,
      status,
      is_active: effectiveIsActive,
    };

    setSaving(true);
    try {
      const token = await getCsrfToken();

      const res =
        initial.mode === 'edit'
          ? await fetch(`/api/admin/moderation/rules/${initial.rule.id}`, {
              method: 'PATCH',
              headers: { 'content-type': 'application/json', 'x-csrf': token },
              body: JSON.stringify(payload),
            })
          : await fetch('/api/admin/moderation/rules', {
              method: 'POST',
              headers: { 'content-type': 'application/json', 'x-csrf': token },
              body: JSON.stringify(payload),
            });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err?.message || 'Enregistrement impossible.');
      }

      toast({ type: 'success', title: 'OK', message: initial.mode === 'edit' ? 'Règle mise à jour.' : 'Règle créée.' });
      onOpenChange(false);
      router.refresh();
    } catch (error) {
      toast({ type: 'error', title: 'Erreur', message: error instanceof Error ? error.message : 'Enregistrement impossible.' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            {initial.mode === 'edit' ? 'Modifier une règle' : 'Créer une règle'}
          </DialogTitle>
        </DialogHeader>

        <Tabs value={tab} onValueChange={(v) => setTab(v as UnsafeAny)}>
          <TabsList>
            <TabsTrigger value="template">Template</TabsTrigger>
            <TabsTrigger value="config">Configuration</TabsTrigger>
            <TabsTrigger value="preview">Prévisualisation</TabsTrigger>
          </TabsList>

          <TabsContent value="template" className="mt-4">
            <div className="grid gap-3 md:grid-cols-2">
              {(['content', 'spam', 'domain', 'duplicate', 'flood'] as RuleType[]).map((t) => {
                const selected = ruleType === t;
                return (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setRuleType(t)}
                    className={cn(
                      'text-left rounded-2xl border p-4 transition-colors',
                      selected ? 'border-primary/40 bg-primary/5' : 'border-border bg-card hover:bg-muted/40'
                    )}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="space-y-1">
                        <div className="font-semibold">{RULE_TYPE_LABEL[t]}</div>
                        <div className="text-xs text-muted-foreground">
                          {t === 'content'
                            ? "Détecter un motif dans le titre ou l’URL."
                            : t === 'spam'
                              ? 'Détecter des mots-clés de spam (titre/URL).'
                              : t === 'domain'
                                ? 'Bloquer/flagger certains domaines.'
                                : t === 'duplicate'
                                  ? 'Limiter les doublons sur une fenêtre.'
                                  : 'Limiter un volume anormal (flood).'}
                        </div>
                      </div>
                      {selected ? <CheckCircle2 className="h-5 w-5 text-primary" /> : <div className="h-5 w-5" />}
                    </div>
                  </button>
                );
              })}
            </div>
          </TabsContent>

          <TabsContent value="config" className="mt-4">
            <div className="grid gap-4 lg:grid-cols-3">
              <Card className="lg:col-span-2">
                <CardHeader>
                  <CardTitle className="text-base">Paramètres</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid gap-3 md:grid-cols-2">
                    <div className="space-y-1">
                      <div className="text-xs font-medium text-muted-foreground">Nom</div>
                      <input
                        className="h-10 w-full rounded-xl border border-border bg-background px-3 text-sm"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        placeholder="Ex: Spam — mots-clés"
                      />
                    </div>
                    <div className="space-y-1">
                      <div className="text-xs font-medium text-muted-foreground">Statut</div>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          className={cn(
                            'h-10 px-3 rounded-xl border text-sm transition-colors',
                            status === 'draft'
                              ? 'border-primary/40 bg-primary/5'
                              : 'border-border bg-card hover:bg-muted/40'
                          )}
                          onClick={() => {
                            setStatus('draft');
                            setIsActive(false);
                          }}
                        >
                          Brouillon
                        </button>
                        <button
                          type="button"
                          className={cn(
                            'h-10 px-3 rounded-xl border text-sm transition-colors',
                            status === 'published'
                              ? 'border-primary/40 bg-primary/5'
                              : 'border-border bg-card hover:bg-muted/40'
                          )}
                          onClick={() => setStatus('published')}
                        >
                          Publié
                        </button>
                        <div className="ml-auto">{statusBadge(status)}</div>
                      </div>
                      <div className="text-xs text-muted-foreground">
                        Brouillon = non appliqué. Publié = prêt à être activé/désactivé.
                      </div>
                    </div>
                  </div>

                  <div className="space-y-1">
                    <div className="text-xs font-medium text-muted-foreground">Description (optionnel)</div>
                    <input
                      className="h-10 w-full rounded-xl border border-border bg-background px-3 text-sm"
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      placeholder="À quoi sert cette règle ?"
                    />
                  </div>

                  <div className="rounded-2xl border border-border bg-muted/30 p-4 space-y-3">
                    <div className="flex items-center justify-between gap-3">
                      <div className="text-sm font-semibold">Template: {RULE_TYPE_LABEL[ruleType]}</div>
                      {status === 'published' ? (
                        <label className="flex items-center gap-2 text-xs text-muted-foreground">
                          <input type="checkbox" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} />
                          Appliquer (actif)
                        </label>
                      ) : (
                        <span className="text-xs text-muted-foreground">Actif désactivé (brouillon)</span>
                      )}
                    </div>

                    {ruleType === 'domain' ? (
                      <div className="space-y-1">
                        <div className="text-xs font-medium text-muted-foreground">Domaines</div>
                        <input
                          className="h-10 w-full rounded-xl border border-border bg-background px-3 text-sm"
                          value={domainsText}
                          onChange={(e) => setDomainsText(e.target.value)}
                          placeholder="tiktok.com, instagram.com"
                        />
                        <div className="text-xs text-muted-foreground">Sépare par des virgules.</div>
                      </div>
                    ) : null}

                    {ruleType === 'spam' ? (
                      <div className="space-y-1">
                        <div className="text-xs font-medium text-muted-foreground">Mots-clés</div>
                        <input
                          className="h-10 w-full rounded-xl border border-border bg-background px-3 text-sm"
                          value={keywordsText}
                          onChange={(e) => setKeywordsText(e.target.value)}
                          placeholder="free, promo, abonnement"
                        />
                        <div className="text-xs text-muted-foreground">Recherche dans titre + URL.</div>
                      </div>
                    ) : null}

                    {ruleType === 'content' ? (
                      <div className="grid gap-3 md:grid-cols-2">
                        <div className="space-y-1">
                          <div className="text-xs font-medium text-muted-foreground">Champ</div>
                          <select
                            className="h-10 w-full rounded-xl border border-border bg-background px-3 text-sm"
                            value={containsField}
                            onChange={(e) => setContainsField(e.target.value === 'external_url' ? 'external_url' : 'title')}
                          >
                            <option value="title">Titre</option>
                            <option value="external_url">URL</option>
                          </select>
                        </div>
                        <div className="space-y-1">
                          <div className="text-xs font-medium text-muted-foreground">Contient</div>
                          <input
                            className="h-10 w-full rounded-xl border border-border bg-background px-3 text-sm"
                            value={containsText}
                            onChange={(e) => setContainsText(e.target.value)}
                            placeholder="ex: code promo"
                          />
                        </div>
                      </div>
                    ) : null}

                    {ruleType === 'duplicate' ? (
                      <div className="space-y-1">
                        <div className="text-xs font-medium text-muted-foreground">Fenêtre (heures)</div>
                        <input
                          className="h-10 w-full rounded-xl border border-border bg-background px-3 text-sm"
                          type="number"
                          min={1}
                          value={windowHours}
                          onChange={(e) => setWindowHours(Number(e.target.value))}
                        />
                      </div>
                    ) : null}

                    {ruleType === 'flood' ? (
                      <div className="space-y-1">
                        <div className="text-xs font-medium text-muted-foreground">Max par heure</div>
                        <input
                          className="h-10 w-full rounded-xl border border-border bg-background px-3 text-sm"
                          type="number"
                          min={1}
                          value={maxPerHour}
                          onChange={(e) => setMaxPerHour(Number(e.target.value))}
                        />
                      </div>
                    ) : null}
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Résumé</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3 text-sm">
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Type</span>
                    <span className="font-medium">{RULE_TYPE_LABEL[ruleType]}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Statut</span>
                    <span className="font-medium">{status === 'draft' ? 'Brouillon' : 'Publié'}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Application</span>
                    <span className="font-medium">{status === 'draft' ? '—' : isActive ? 'Actif' : 'Inactif'}</span>
                  </div>
                  <div className="rounded-xl border border-border bg-muted/30 p-3 text-xs text-muted-foreground">
                    {summary}
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="preview" className="mt-4">
            <div className="grid gap-4 lg:grid-cols-3">
              <Card className="lg:col-span-2">
                <CardHeader>
                  <CardTitle className="text-base">Impact (7 jours)</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {!canSimulate ? (
                    <div className="text-sm text-muted-foreground">Simulation non disponible pour ce template.</div>
                  ) : (
                    <>
                      <div className="flex items-center justify-between gap-3">
                        <div className="text-sm text-muted-foreground">
                          Estimation basée sur les soumissions créées sur les 7 derniers jours.
                        </div>
                        <Button variant="secondary" onClick={runSimulation} loading={simLoading}>
                          Simuler
                        </Button>
                      </div>

                      {sim ? (
                        sim.supported ? (
                          <div className="space-y-3">
                            <div className="flex flex-wrap items-center gap-2 text-sm">
                              <Badge variant="secondary">{sim.matched_total} match</Badge>
                              <Badge variant="secondary">{sim.scanned_total} analysées</Badge>
                              {sim.truncated ? <Badge variant="warning">Limité à 5000</Badge> : null}
                            </div>
                            <SmallBarChart data={sim.daily} />
                          </div>
                        ) : (
                          <div className="text-sm text-muted-foreground">{sim.message || 'Simulation indisponible.'}</div>
                        )
                      ) : (
                        <div className="text-sm text-muted-foreground">Lance une simulation pour voir un aperçu.</div>
                      )}
                    </>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Préflight</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2 text-sm">
                  <div className="flex items-center gap-2">
                    {name.trim().length >= 2 ? (
                      <CheckCircle2 className="h-4 w-4 text-primary" />
                    ) : (
                      <XCircle className="h-4 w-4 text-muted-foreground" />
                    )}
                    <div className="text-muted-foreground">Nom</div>
                  </div>
                  <div className="flex items-center gap-2">
                    {ruleType === 'content' ? (
                      containsText.trim() ? (
                        <CheckCircle2 className="h-4 w-4 text-primary" />
                      ) : (
                        <XCircle className="h-4 w-4 text-muted-foreground" />
                      )
                    ) : ruleType === 'domain' ? (
                      toList(domainsText).length ? (
                        <CheckCircle2 className="h-4 w-4 text-primary" />
                      ) : (
                        <XCircle className="h-4 w-4 text-muted-foreground" />
                      )
                    ) : ruleType === 'spam' ? (
                      toList(keywordsText).length ? (
                        <CheckCircle2 className="h-4 w-4 text-primary" />
                      ) : (
                        <XCircle className="h-4 w-4 text-muted-foreground" />
                      )
                    ) : (
                      <CheckCircle2 className="h-4 w-4 text-primary" />
                    )}
                    <div className="text-muted-foreground">Paramètres template</div>
                  </div>
                  <div className="rounded-xl border border-border bg-muted/30 p-3 text-xs text-muted-foreground">
                    {summary}
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={saving}>
            Annuler
          </Button>
          <Button variant="primary" onClick={save} loading={saving} disabled={!canWrite}>
            Enregistrer
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function AdminModerationRules({ rules, canWrite = true }: AdminModerationRulesProps) {
  const router = useRouter();
  const { toast } = useToastContext();

  const [wizardOpen, setWizardOpen] = useState(false);
  const [wizardInitial, setWizardInitial] = useState<WizardMode>({ mode: 'create' });

  const [versionsOpenRuleId, setVersionsOpenRuleId] = useState<string | null>(null);
  const [versionsLoading, setVersionsLoading] = useState(false);
  const [versions, setVersions] = useState<VersionRow[]>([]);

  const openCreate = () => {
    setWizardInitial({ mode: 'create' });
    setWizardOpen(true);
  };

  const openEdit = (rule: ModerationRule) => {
    setWizardInitial({ mode: 'edit', rule });
    setWizardOpen(true);
  };

  const loadVersions = async (ruleId: string) => {
    setVersionsOpenRuleId(ruleId);
    setVersions([]);
    setVersionsLoading(true);
    try {
      const res = await fetch(`/api/admin/moderation/rules/${ruleId}/versions`);
      const data = await res.json();
      setVersions((data?.items ?? []) as VersionRow[]);
    } catch {
      setVersions([]);
    } finally {
      setVersionsLoading(false);
    }
  };

  const toggleActive = async (rule: ModerationRule, reason: string) => {
    if (!canWrite) return;
    if (normalizeStatus(rule.status) === 'draft') {
      toast({ type: 'warning', title: 'Brouillon', message: "Publie la règle avant de l’activer." });
      return;
    }
    const token = await getCsrfToken();
    const res = await fetch(`/api/admin/moderation/rules/${rule.id}`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json', 'x-csrf': token },
      body: JSON.stringify({ is_active: !rule.is_active, reason }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err?.message || 'Action impossible.');
    }
    router.refresh();
  };

  const publish = async (rule: ModerationRule, reason: string) => {
    if (!canWrite) return;
    const token = await getCsrfToken();
    const res = await fetch(`/api/admin/moderation/rules/${rule.id}`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json', 'x-csrf': token },
      body: JSON.stringify({ status: 'published', is_active: false, reason }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err?.message || 'Publication impossible.');
    }
    router.refresh();
  };

  const unpublish = async (rule: ModerationRule, reason: string) => {
    if (!canWrite) return;
    const token = await getCsrfToken();
    const res = await fetch(`/api/admin/moderation/rules/${rule.id}`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json', 'x-csrf': token },
      body: JSON.stringify({ status: 'draft', is_active: false, reason }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err?.message || 'Passage en brouillon impossible.');
    }
    router.refresh();
  };

  const deleteRule = async (rule: ModerationRule, reason: string) => {
    if (!canWrite) return;
    const token = await getCsrfToken();
    const res = await fetch(`/api/admin/moderation/rules/${rule.id}`, {
      method: 'DELETE',
      headers: { 'x-csrf': token, 'content-type': 'application/json' },
      body: JSON.stringify({ reason }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err?.message || 'Suppression impossible.');
    }
    router.refresh();
  };

  const sorted = useMemo(() => {
    const copy = [...rules];
    copy.sort((a, b) => {
      const av = a.version ?? 0;
      const bv = b.version ?? 0;
      if (av !== bv) return bv - av;
      return b.updated_at.localeCompare(a.updated_at);
    });
    return copy;
  }, [rules]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <div className="text-sm font-semibold">Règles de modération</div>
          <div className="text-xs text-muted-foreground">
            Templates lisibles (pas de JSON), statut brouillon/publié, et prévisualisation d’impact.
          </div>
        </div>
        <Button onClick={openCreate} disabled={!canWrite}>
          <Plus className="h-4 w-4 mr-2" />
          Créer une règle
        </Button>
      </div>

      <WizardDialog open={wizardOpen} onOpenChange={setWizardOpen} initial={wizardInitial} canWrite={canWrite} />

      <Dialog
        open={Boolean(versionsOpenRuleId)}
        onOpenChange={(v) => {
          if (!v) setVersionsOpenRuleId(null);
        }}
      >
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <History className="h-5 w-5 text-primary" />
              Historique des versions
            </DialogTitle>
          </DialogHeader>
          {versionsLoading ? (
            <div className="text-sm text-muted-foreground">Chargement…</div>
          ) : versions.length === 0 ? (
            <div className="text-sm text-muted-foreground">
              Aucun historique disponible (migration non appliquée ou aucune modification).
            </div>
          ) : (
            <div className="space-y-2">
              {versions.map((v) => {
                const snap = v.snapshot ?? {};
                const type = (snap.rule_type as RuleType) ?? 'content';
                const cfg = (snap.config as Record<string, unknown>) ?? {};
                const st = normalizeStatus(snap.status);
                return (
                  <div key={v.id} className="rounded-2xl border border-border bg-card p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="space-y-1">
                        <div className="font-semibold">
                          v{v.version} — {snap.name || '—'}
                        </div>
                        <div className="text-xs text-muted-foreground">{summarizeConfig(type, cfg)}</div>
                      </div>
                      <div className="flex items-center gap-2">
                        {statusBadge(st)}
                        {activeBadge(Boolean(snap.is_active))}
                      </div>
                    </div>
                    <div className="mt-2 text-xs text-muted-foreground">{formatDateTime(v.created_at)}</div>
                  </div>
                );
              })}
            </div>
          )}
          <DialogFooter>
            <Button variant="secondary" onClick={() => setVersionsOpenRuleId(null)}>
              Fermer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AdminTable>
        <thead className="text-left text-xs uppercase text-muted-foreground">
          <tr>
            <th className="px-4 py-3">Règle</th>
            <th className="px-4 py-3">Statut</th>
            <th className="px-4 py-3">Résumé</th>
            <th className="px-4 py-3">Version</th>
            <th className="px-4 py-3">Dernière mise à jour</th>
            <th className="px-4 py-3">Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border text-sm">
          {sorted.length === 0 ? (
            <tr>
              <td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">
                Aucune règle configurée.
              </td>
            </tr>
          ) : (
            sorted.map((rule) => {
              const st = normalizeStatus(rule.status);
              return (
                <tr key={rule.id} className="hover:bg-muted/30">
                  <td className="px-4 py-4">
                    <div className="font-semibold">{rule.name}</div>
                    <div className="text-xs text-muted-foreground">{rule.description || '—'}</div>
                    <div className="mt-2 text-xs text-muted-foreground">
                      Type: <span className="font-medium">{RULE_TYPE_LABEL[rule.rule_type]}</span>
                    </div>
                  </td>
                  <td className="px-4 py-4">
                    <div className="flex items-center gap-2">
                      {statusBadge(st)}
                      {activeBadge(rule.is_active)}
                    </div>
                  </td>
                  <td className="px-4 py-4">
                    <div className="text-xs text-muted-foreground">
                      {summarizeConfig(rule.rule_type, rule.config ?? {})}
                    </div>
                  </td>
                  <td className="px-4 py-4 text-xs text-muted-foreground">
                    {typeof rule.version === 'number' ? `v${rule.version}` : '—'}
                  </td>
                  <td className="px-4 py-4 text-xs text-muted-foreground">{formatDateTime(rule.updated_at)}</td>
                  <td className="px-4 py-4">
                    <div className="flex flex-wrap gap-2">
                      <Button size="sm" variant="secondary" onClick={() => openEdit(rule)} disabled={!canWrite}>
                        Modifier
                      </Button>
                      <Button size="sm" variant="secondary" onClick={() => loadVersions(rule.id)}>
                        Historique
                      </Button>

                      {st === 'draft' ? (
                        <AdminActionPanel
                          trigger={
                            <Button size="sm" variant="primary" disabled={!canWrite}>
                              Publier
                            </Button>
                          }
                          title="Publier cette règle"
                          description="Une règle publiée peut être activée/désactivée. La publication incrémente la version."
                          requiresReason
                          confirmLabel="Publier"
                          onConfirm={({ reason }) => publish(rule, reason)}
                        />
                      ) : (
                        <AdminActionPanel
                          trigger={
                            <Button size="sm" variant="secondary" disabled={!canWrite}>
                              Mettre en brouillon
                            </Button>
                          }
                          title="Mettre en brouillon"
                          description="La règle ne sera plus activable et sera désactivée automatiquement."
                          requiresReason
                          confirmLabel="Mettre en brouillon"
                          confirmVariant="secondary"
                          onConfirm={({ reason }) => unpublish(rule, reason)}
                        />
                      )}

                      <AdminActionPanel
                        trigger={
                          <Button size="sm" variant={rule.is_active ? 'secondary' : 'primary'} disabled={!canWrite || st === 'draft'}>
                            {rule.is_active ? 'Désactiver' : 'Activer'}
                          </Button>
                        }
                        title={rule.is_active ? 'Désactiver la règle' : 'Activer la règle'}
                        description={
                          st === 'draft'
                            ? "Publie la règle avant de l’activer."
                            : "Cette action modifie l'application automatique."
                        }
                        requiresReason
                        confirmLabel={rule.is_active ? 'Désactiver' : 'Activer'}
                        confirmVariant={rule.is_active ? 'secondary' : 'primary'}
                        onConfirm={({ reason }) => toggleActive(rule, reason)}
                      />

                      <AdminActionPanel
                        trigger={
                          <Button size="sm" variant="destructive" disabled={!canWrite}>
                            Supprimer
                          </Button>
                        }
                        title="Supprimer cette règle"
                        description="Action irréversible."
                        requiresReason
                        confirmLabel="Supprimer"
                        confirmVariant="destructive"
                        onConfirm={({ reason }) => deleteRule(rule, reason)}
                      />
                    </div>
                  </td>
                </tr>
              );
            })
          )}
        </tbody>
      </AdminTable>
    </div>
  );
}


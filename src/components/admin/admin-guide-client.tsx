'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';
import { BookOpen, ChevronRight, Search, RotateCcw, CheckCircle2 } from 'lucide-react';

import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';

import type { AdminGuideModule, AdminGlossaryTerm, AdminGuideChecklistItem } from '@/lib/admin/guide-content';

type AdminGuideClientProps = {
  modules: AdminGuideModule[];
  glossary: AdminGlossaryTerm[];
  checklist: AdminGuideChecklistItem[];
  initialModuleKey?: string | null;
  initialRoute?: string | null;
};

function normalize(text: string) {
  return text.toLowerCase().normalize('NFD').replace(/\p{Diacritic}/gu, '');
}

function findModuleByRoute(modules: AdminGuideModule[], route: string | null) {
  if (!route) return null;
  const r = route.startsWith('/') ? route : `/${route}`;
  return (
    modules.find((m) => m.routePrefixes.some((prefix) => r.startsWith(prefix))) ?? null
  );
}

const STORAGE_KEY = 'admin-guide:onboarding';

export function AdminGuideClient({
  modules,
  glossary,
  checklist,
  initialModuleKey,
  initialRoute,
}: AdminGuideClientProps) {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [query, setQuery] = useState('');
  const [activeTab, setActiveTab] = useState<'modules' | 'glossary' | 'onboarding'>('modules');
  const [selectedModuleKey, setSelectedModuleKey] = useState<string | null>(null);
  const [checked, setChecked] = useState<Record<string, boolean>>({});

  const moduleRefs = useRef<Map<string, HTMLDivElement | null>>(new Map());

  const selectedModule = useMemo(() => {
    if (!selectedModuleKey) return null;
    return modules.find((m) => m.key === selectedModuleKey) ?? null;
  }, [modules, selectedModuleKey]);

  const activeFromRoute = useMemo(() => {
    const byQuery =
      initialModuleKey ? modules.find((m) => m.key === initialModuleKey) ?? null : null;
    if (byQuery) return byQuery;
    return findModuleByRoute(modules, initialRoute ?? pathname);
  }, [initialModuleKey, initialRoute, modules, pathname]);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw) as Record<string, boolean>;
      if (parsed && typeof parsed === 'object') setChecked(parsed);
    } catch {}
  }, []);

  useEffect(() => {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(checked));
    } catch {}
  }, [checked]);

  useEffect(() => {
    const q = searchParams.get('q');
    if (typeof q === 'string' && q.trim()) setQuery(q.trim());

    const tab = searchParams.get('tab');
    if (tab === 'glossary' || tab === 'onboarding' || tab === 'modules') {
      setActiveTab(tab);
    }
  }, [searchParams]);

  useEffect(() => {
    if (selectedModuleKey) return;
    if (activeFromRoute) {
      setSelectedModuleKey(activeFromRoute.key);
      return;
    }
    setSelectedModuleKey(modules[0]?.key ?? null);
  }, [activeFromRoute, modules, selectedModuleKey]);

  useEffect(() => {
    if (!selectedModuleKey) return;
    const el = moduleRefs.current.get(selectedModuleKey);
    if (!el) return;
    el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, [selectedModuleKey]);

  const filteredModules = useMemo(() => {
    const q = normalize(query.trim());
    if (!q) return modules;
    return modules.filter((m) => {
      const hay = normalize([m.title, m.description, ...m.minute, ...(m.examples?.flatMap((e) => [e.title, ...e.steps]) ?? [])].join(' '));
      return hay.includes(q);
    });
  }, [modules, query]);

  const filteredGlossary = useMemo(() => {
    const q = normalize(query.trim());
    if (!q) return glossary;
    return glossary.filter((t) => normalize(`${t.term} ${t.definition} ${(t.related ?? []).join(' ')}`).includes(q));
  }, [glossary, query]);

  const checklistProgress = useMemo(() => {
    const total = checklist.length;
    const done = checklist.filter((i) => checked[i.key]).length;
    return { total, done, pct: total ? Math.round((done / total) * 100) : 0 };
  }, [checklist, checked]);

  const resetChecklist = () => {
    if (!window.confirm('Réinitialiser la checklist ?')) return;
    setChecked({});
  };

  return (
    <section className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <div className="h-10 w-10 rounded-2xl bg-gradient-to-br from-primary to-accent shadow-card flex items-center justify-center text-primary-foreground">
              <BookOpen className="h-5 w-5" />
            </div>
            <div>
              <h1 className="display-2">Guide Admin</h1>
              <p className="text-sm text-muted-foreground">
                Formation rapide, aide contextuelle, et bonnes pratiques.
              </p>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button asChild variant="secondary">
            <Link href="/app/admin/dashboard">Retour dashboard</Link>
          </Button>
        </div>
      </div>

      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="relative w-full md:max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input
            className="h-11 w-full rounded-2xl border border-border bg-background pl-10 pr-3 text-sm"
            placeholder="Rechercher dans le guide (modules, mini-tutos, glossaire)…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
        <div className="text-xs text-muted-foreground">
          Astuce : le bouton <span className="font-medium">?</span> en haut ouvre la section liée à la page courante.
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)}>
        <TabsList>
          <TabsTrigger value="modules">Modules</TabsTrigger>
          <TabsTrigger value="glossary">Glossaire</TabsTrigger>
          <TabsTrigger value="onboarding">Onboarding</TabsTrigger>
        </TabsList>

        <TabsContent value="modules" className="mt-4">
          <div className="grid gap-4 lg:grid-cols-[320px_1fr]">
            <Card className="h-fit">
              <CardHeader>
                <CardTitle className="text-base">Modules</CardTitle>
              </CardHeader>
              <CardContent className="space-y-1">
                {filteredModules.length === 0 ? (
                  <div className="text-sm text-muted-foreground">Aucun résultat.</div>
                ) : (
                  filteredModules.map((m) => {
                    const active = m.key === selectedModuleKey;
                    return (
                      <button
                        key={m.key}
                        onClick={() => setSelectedModuleKey(m.key)}
                        className={cn(
                          'w-full text-left rounded-xl px-3 py-2 border transition-colors',
                          active
                            ? 'bg-primary/10 border-primary/30 text-foreground'
                            : 'bg-card border-border hover:bg-muted/40'
                        )}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <div>
                            <div className="text-sm font-semibold">{m.title}</div>
                            <div className="text-xs text-muted-foreground">{m.description}</div>
                          </div>
                          <ChevronRight className={cn('h-4 w-4 text-muted-foreground', active && 'text-primary')} />
                        </div>
                      </button>
                    );
                  })
                )}
              </CardContent>
            </Card>

            <div className="space-y-4">
              {selectedModule ? (
                <Card ref={(node) => void moduleRefs.current.set(selectedModule.key, node)}>
                  <CardHeader>
                    <CardTitle className="text-base">{selectedModule.title}</CardTitle>
                    <div className="text-sm text-muted-foreground">{selectedModule.description}</div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="rounded-2xl border border-border bg-muted/30 p-4">
                      <div className="text-sm font-semibold">En 1 minute</div>
                      <ol className="mt-2 list-decimal pl-5 space-y-1 text-sm">
                        {selectedModule.minute.map((s, idx) => (
                          <li key={idx}>{s}</li>
                        ))}
                      </ol>
                    </div>

                    {selectedModule.examples && selectedModule.examples.length > 0 ? (
                      <div className="space-y-2">
                        <div className="text-sm font-semibold">Mini-tutos (exemples)</div>
                        <Accordion>
                          {selectedModule.examples.map((ex) => (
                            <AccordionItem key={ex.title} value={ex.title}>
                              <AccordionTrigger>{ex.title}</AccordionTrigger>
                              <AccordionContent>
                                <ol className="list-decimal pl-5 space-y-1 text-sm">
                                  {ex.steps.map((step, idx) => (
                                    <li key={idx}>{step}</li>
                                  ))}
                                </ol>
                              </AccordionContent>
                            </AccordionItem>
                          ))}
                        </Accordion>
                      </div>
                    ) : null}

                    {selectedModule.related && selectedModule.related.length > 0 ? (
                      <div className="space-y-2">
                        <div className="text-sm font-semibold">Liens utiles</div>
                        <div className="flex flex-wrap gap-2">
                          {selectedModule.related.map((r) => (
                            <Button key={r.route} asChild size="sm" variant="secondary">
                              <Link href={r.route}>{r.title}</Link>
                            </Button>
                          ))}
                        </div>
                      </div>
                    ) : null}
                  </CardContent>
                </Card>
              ) : (
                <Card>
                  <CardContent className="p-6 text-sm text-muted-foreground">Sélectionne un module.</CardContent>
                </Card>
              )}
            </div>
          </div>
        </TabsContent>

        <TabsContent value="glossary" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Glossaire</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {filteredGlossary.length === 0 ? (
                <div className="text-sm text-muted-foreground">Aucun résultat.</div>
              ) : (
                <Accordion>
                  {filteredGlossary.map((t) => (
                    <AccordionItem key={t.term} value={t.term}>
                      <AccordionTrigger>{t.term}</AccordionTrigger>
                      <AccordionContent>
                        <div className="text-sm text-muted-foreground">{t.definition}</div>
                        {t.related && t.related.length > 0 ? (
                          <div className="mt-2 text-xs text-muted-foreground">
                            Lié à : {t.related.join(', ')}
                          </div>
                        ) : null}
                      </AccordionContent>
                    </AccordionItem>
                  ))}
                </Accordion>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="onboarding" className="mt-4">
          <div className="grid gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Checklist “mise en route admin”</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between gap-3">
                  <div className="text-sm text-muted-foreground">
                    Progression : <span className="font-semibold text-foreground">{checklistProgress.done}</span> / {checklistProgress.total} ({checklistProgress.pct}%)
                  </div>
                  <Button variant="ghost" size="sm" onClick={resetChecklist}>
                    <RotateCcw className="h-4 w-4 mr-2" />
                    Réinitialiser
                  </Button>
                </div>

                <div className="space-y-2">
                  {checklist.map((item) => {
                    const isDone = Boolean(checked[item.key]);
                    return (
                      <div
                        key={item.key}
                        className={cn(
                          'rounded-2xl border p-4 flex items-start justify-between gap-3',
                          isDone ? 'border-primary/30 bg-primary/5' : 'border-border bg-card'
                        )}
                      >
                        <label className="flex items-start gap-3 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={isDone}
                            onChange={(e) => setChecked((prev) => ({ ...prev, [item.key]: e.target.checked }))}
                          />
                          <div>
                            <div className="text-sm font-semibold">{item.label}</div>
                            {item.description ? (
                              <div className="text-xs text-muted-foreground">{item.description}</div>
                            ) : null}
                          </div>
                        </label>
                        <div className="flex items-center gap-2">
                          {isDone ? <CheckCircle2 className="h-4 w-4 text-primary" /> : null}
                          {item.route ? (
                            <Button asChild size="sm" variant="secondary">
                              <Link href={item.route}>Ouvrir</Link>
                            </Button>
                          ) : null}
                        </div>
                      </div>
                    );
                  })}
                </div>

                <div className="text-xs text-muted-foreground">
                  Note : la checklist est stockée localement dans ton navigateur (version 1). Si tu veux une sync par admin, je peux l’adosser à Supabase.
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Bonnes pratiques</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm text-muted-foreground">
                <ul className="list-disc pl-5 space-y-1">
                  <li>Principe du moindre privilège : donne le minimum de droits nécessaires.</li>
                  <li>Sur actions sensibles (finance/settings/team) : raison claire + traçabilité audit.</li>
                  <li>En cas d’erreur système : commence par Integrations/Ingestion avant de toucher aux données.</li>
                  <li>Marketing : privilégie “Marques → Concours → Insights” pour des actions ROI.</li>
                </ul>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </section>
  );
}

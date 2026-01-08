'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { formatDateTime } from '@/lib/formatters';
import { ExternalLink, User, Trophy, Video, DollarSign, Clock, FileText, Settings } from 'lucide-react';

type EntityType = 'user' | 'contest' | 'submission' | 'cashout';

type EntityData = {
  type: EntityType;
  id: string;
  label: string;
  subtitle?: string;
  overview?: Record<string, unknown>;
  timeline?: Array<{ date: string; status: string; reason?: string; changed_by?: string }>;
  audit?: Array<{ date: string; action: string; actor?: string; details?: Record<string, unknown> }>;
  actions?: React.ReactNode;
};

type AdminEntityDrawerProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  entityType: EntityType;
  entityId: string;
};

const getEntityIcon = (type: EntityType) => {
  switch (type) {
    case 'user':
      return <User className="h-5 w-5" />;
    case 'contest':
      return <Trophy className="h-5 w-5" />;
    case 'submission':
      return <Video className="h-5 w-5" />;
    case 'cashout':
      return <DollarSign className="h-5 w-5" />;
  }
};

const getEntityLabel = (type: EntityType) => {
  switch (type) {
    case 'user':
      return 'Utilisateur';
    case 'contest':
      return 'Concours';
    case 'submission':
      return 'Soumission';
    case 'cashout':
      return 'Cashout';
  }
};

const getEntityHref = (type: EntityType, id: string) => {
  switch (type) {
    case 'user':
      return `/app/admin/users/${id}`;
    case 'contest':
      return `/app/admin/contests/${id}`;
    case 'submission':
      return `/app/admin/submissions?submission_id=${id}`;
    case 'cashout':
      return `/app/admin/finance?cashout_id=${id}`;
  }
};

export function AdminEntityDrawer({ open, onOpenChange, entityType, entityId }: AdminEntityDrawerProps) {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<EntityData | null>(null);
  const [activeTab, setActiveTab] = useState<'overview' | 'timeline' | 'audit' | 'actions'>('overview');

  useEffect(() => {
    if (!open || !entityId) {
      setData(null);
      return;
    }

    const loadEntity = async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/admin/entities/${entityType}/${entityId}`);
        if (res.ok) {
          const entityData = await res.json();
          setData(entityData);
        } else {
          setData(null);
        }
      } catch (error) {
        console.error('Failed to load entity:', error);
        setData(null);
      } finally {
        setLoading(false);
      }
    };

    void loadEntity();
  }, [open, entityType, entityId]);

  if (!open) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              {getEntityIcon(entityType)}
              <DialogTitle>
                {data ? data.label : getEntityLabel(entityType)}
              </DialogTitle>
            </div>
            <div className="flex items-center gap-2">
              <Button
                asChild
                variant="secondary"
                size="sm"
                onClick={() => onOpenChange(false)}
              >
                <Link href={getEntityHref(entityType, entityId)}>
                  <ExternalLink className="h-4 w-4 mr-2" />
                  Page complète
                </Link>
              </Button>
            </div>
          </div>
          {data?.subtitle && (
            <p className="text-sm text-muted-foreground mt-2">{data.subtitle}</p>
          )}
        </DialogHeader>

        {loading ? (
          <div className="py-12 text-center text-muted-foreground">Chargement...</div>
        ) : !data ? (
          <div className="py-12 text-center text-muted-foreground">Entité non trouvée</div>
        ) : (
          <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as typeof activeTab)}>
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="overview">Vue d&apos;ensemble</TabsTrigger>
              <TabsTrigger value="timeline">
                <Clock className="h-4 w-4 mr-2" />
                Timeline
              </TabsTrigger>
              <TabsTrigger value="audit">
                <FileText className="h-4 w-4 mr-2" />
                Audit
              </TabsTrigger>
              <TabsTrigger value="actions">
                <Settings className="h-4 w-4 mr-2" />
                Actions
              </TabsTrigger>
            </TabsList>

            <TabsContent value="overview" className="space-y-4 mt-4">
              {data.overview ? (
                <div className="grid gap-4 md:grid-cols-2">
                  {Object.entries(data.overview).map(([key, value]) => (
                    <div key={key} className="space-y-1">
                      <div className="text-xs font-medium text-muted-foreground uppercase">
                        {key.replace(/_/g, ' ')}
                      </div>
                      <div className="text-sm">
                        {typeof value === 'object' && value !== null
                          ? JSON.stringify(value)
                          : String(value ?? '-')}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="py-8 text-center text-muted-foreground">Aucune donnée disponible</div>
              )}
            </TabsContent>

            <TabsContent value="timeline" className="space-y-3 mt-4">
              {data.timeline && data.timeline.length > 0 ? (
                <div className="space-y-3">
                  {data.timeline.map((item, index) => (
                    <div key={index} className="flex items-start gap-3 border-l-2 border-border pl-4">
                      <div className="flex-1 space-y-1">
                        <div className="flex items-center gap-2">
                          <Badge variant="secondary">{item.status}</Badge>
                          <span className="text-xs text-muted-foreground">{formatDateTime(item.date)}</span>
                        </div>
                        {item.reason && (
                          <div className="text-sm text-muted-foreground">{item.reason}</div>
                        )}
                        {item.changed_by && (
                          <div className="text-xs text-muted-foreground">Par : {item.changed_by}</div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="py-8 text-center text-muted-foreground">Aucun historique de statut</div>
              )}
            </TabsContent>

            <TabsContent value="audit" className="space-y-3 mt-4">
              {data.audit && data.audit.length > 0 ? (
                <div className="space-y-3">
                  {data.audit.map((item, index) => (
                    <Card key={index}>
                      <CardHeader className="pb-2">
                        <div className="flex items-center justify-between">
                          <CardTitle className="text-sm">{item.action}</CardTitle>
                          <span className="text-xs text-muted-foreground">{formatDateTime(item.date)}</span>
                        </div>
                        {item.actor && (
                          <div className="text-xs text-muted-foreground">Par : {item.actor}</div>
                        )}
                      </CardHeader>
                      {item.details && Object.keys(item.details).length > 0 && (
                        <CardContent>
                          <pre className="text-xs bg-muted p-2 rounded overflow-auto">
                            {JSON.stringify(item.details, null, 2)}
                          </pre>
                        </CardContent>
                      )}
                    </Card>
                  ))}
                </div>
              ) : (
                <div className="py-8 text-center text-muted-foreground">Aucun log d&apos;audit</div>
              )}
            </TabsContent>

            <TabsContent value="actions" className="mt-4">
              {data.actions ? (
                <div>{data.actions}</div>
              ) : (
                <div className="py-8 text-center text-muted-foreground">Aucune action disponible</div>
              )}
            </TabsContent>
          </Tabs>
        )}
      </DialogContent>
    </Dialog>
  );
}

/**
 * Hook pour ouvrir l'Entity Drawer
 */
export function useEntityDrawer() {
  const [open, setOpen] = useState(false);
  const [entityType, setEntityType] = useState<EntityType>('user');
  const [entityId, setEntityId] = useState<string>('');

  const openDrawer = (type: EntityType, id: string) => {
    setEntityType(type);
    setEntityId(id);
    setOpen(true);
  };

  const closeDrawer = () => {
    setOpen(false);
    setEntityId('');
  };

  return {
    open,
    entityType,
    entityId,
    openDrawer,
    closeDrawer,
    Drawer: () => (
      <AdminEntityDrawer
        open={open}
        onOpenChange={setOpen}
        entityType={entityType}
        entityId={entityId}
      />
    ),
  };
}



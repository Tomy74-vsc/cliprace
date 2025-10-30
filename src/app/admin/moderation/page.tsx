'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { 
  CheckCircle, 
  XCircle, 
  Clock, 
  AlertTriangle, 
  Eye, 
  Filter,
  RefreshCw,
  Play,
  Pause,
  User,
  Calendar
} from 'lucide-react';

interface Submission {
  id: string;
  status: string;
  video_url: string;
  network: string;
  created_at: string;
  updated_at: string;
  reason?: string;
  contests: {
    id: string;
    title: string;
    brand_id: string;
  };
  profiles: {
    id: string;
    email: string;
    display_name: string;
    avatar_url?: string;
  };
  moderation_queue?: {
    id: string;
    status: string;
    priority: number;
    assigned_to?: string;
    automod_result?: any;
  };
}

interface ModerationStats {
  pending_automod: number;
  pending_review: number;
  approved: number;
  rejected: number;
  total: number;
}

export default function ModerationPage() {
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [stats, setStats] = useState<ModerationStats>({
    pending_automod: 0,
    pending_review: 0,
    approved: 0,
    rejected: 0,
    total: 0
  });
  const [loading, setLoading] = useState(true);
  const [selectedSubmission, setSelectedSubmission] = useState<Submission | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [filters, setFilters] = useState({
    status: '',
    contest_id: '',
    creator_id: '',
    page: 1,
    limit: 20
  });
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 20,
    total: 0,
    pages: 0
  });

  const supabase = createClient();

  // Charger les submissions
  const loadSubmissions = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filters.status) params.append('status', filters.status);
      if (filters.contest_id) params.append('contest_id', filters.contest_id);
      if (filters.creator_id) params.append('creator_id', filters.creator_id);
      params.append('page', filters.page.toString());
      params.append('limit', filters.limit.toString());

      const response = await fetch(`/api/moderation/submissions?${params}`);
      const data = await response.json();

      if (response.ok) {
        setSubmissions(data.data || []);
        setPagination(data.pagination || {});
      } else {
        console.error('Error loading submissions:', data.error);
      }
    } catch (error) {
      console.error('Error loading submissions:', error);
    } finally {
      setLoading(false);
    }
  };

  // Charger les statistiques
  const loadStats = async () => {
    try {
      const response = await fetch('/api/moderation/stats');
      const data = await response.json();

      if (response.ok) {
        setStats(data.data || {});
      }
    } catch (error) {
      console.error('Error loading stats:', error);
    }
  };

  // Actions sur les submissions
  const approveSubmission = async (submissionId: string, comment?: string) => {
    setActionLoading(submissionId);
    try {
      const response = await fetch(`/api/moderation/submissions/${submissionId}/approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ comment })
      });

      if (response.ok) {
        await loadSubmissions();
        await loadStats();
      } else {
        const error = await response.json();
        alert(`Error: ${error.error}`);
      }
    } catch (error) {
      console.error('Error approving submission:', error);
      alert('Error approving submission');
    } finally {
      setActionLoading(null);
    }
  };

  const rejectSubmission = async (submissionId: string, reason: string) => {
    setActionLoading(submissionId);
    try {
      const response = await fetch(`/api/moderation/submissions/${submissionId}/reject`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason })
      });

      if (response.ok) {
        await loadSubmissions();
        await loadStats();
      } else {
        const error = await response.json();
        alert(`Error: ${error.error}`);
      }
    } catch (error) {
      console.error('Error rejecting submission:', error);
      alert('Error rejecting submission');
    } finally {
      setActionLoading(null);
    }
  };

  // Actions en lot
  const bulkAction = async (action: string, submissionIds: string[], reason?: string) => {
    try {
      const response = await fetch('/api/moderation/submissions/bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action,
          submission_ids: submissionIds,
          reason
        })
      });

      if (response.ok) {
        await loadSubmissions();
        await loadStats();
      } else {
        const error = await response.json();
        alert(`Error: ${error.error}`);
      }
    } catch (error) {
      console.error('Error performing bulk action:', error);
      alert('Error performing bulk action');
    }
  };

  useEffect(() => {
    loadSubmissions();
    loadStats();
  }, [filters]);

  const getStatusBadge = (status: string) => {
    const statusConfig = {
      pending_automod: { color: 'bg-yellow-100 text-yellow-800', icon: Clock, label: 'Auto-mod' },
      pending_review: { color: 'bg-blue-100 text-blue-800', icon: Eye, label: 'Review' },
      approved: { color: 'bg-green-100 text-green-800', icon: CheckCircle, label: 'Approved' },
      rejected: { color: 'bg-red-100 text-red-800', icon: XCircle, label: 'Rejected' },
      payout_pending: { color: 'bg-purple-100 text-purple-800', icon: Clock, label: 'Payout' },
      paid: { color: 'bg-green-100 text-green-800', icon: CheckCircle, label: 'Paid' }
    };

    const config = statusConfig[status as keyof typeof statusConfig] || statusConfig.pending_automod;
    const Icon = config.icon;

    return (
      <Badge className={config.color}>
        <Icon className="w-3 h-3 mr-1" />
        {config.label}
      </Badge>
    );
  };

  const getNetworkIcon = (network: string) => {
    const icons = {
      youtube: '🎥',
      tiktok: '🎵',
      instagram: '📸',
      facebook: '👥',
      twitter: '🐦'
    };
    return icons[network as keyof typeof icons] || '📹';
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Modération</h1>
          <p className="text-gray-600">Gérer les soumissions et la modération automatique</p>
        </div>
        <div className="flex gap-2">
          <Button onClick={loadSubmissions} variant="outline" size="sm">
            <RefreshCw className="w-4 h-4 mr-2" />
            Actualiser
          </Button>
          <Button onClick={() => bulkAction('approve', submissions.map(s => s.id))} variant="default" size="sm">
            <CheckCircle className="w-4 h-4 mr-2" />
            Approuver tout
          </Button>
        </div>
      </div>

      {/* Statistiques */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">En attente Auto-mod</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-yellow-600">{stats.pending_automod}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">En attente Review</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">{stats.pending_review}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">Approuvées</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{stats.approved}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">Rejetées</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">{stats.rejected}</div>
          </CardContent>
        </Card>
      </div>

      {/* Filtres */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Filter className="w-5 h-5" />
            Filtres
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <Label htmlFor="status">Statut</Label>
              <Select value={filters.status} onValueChange={(value) => setFilters({...filters, status: value})}>
                <SelectTrigger>
                  <SelectValue placeholder="Tous les statuts" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">Tous les statuts</SelectItem>
                  <SelectItem value="pending_automod">En attente Auto-mod</SelectItem>
                  <SelectItem value="pending_review">En attente Review</SelectItem>
                  <SelectItem value="approved">Approuvées</SelectItem>
                  <SelectItem value="rejected">Rejetées</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="contest_id">Contest ID</Label>
              <Input
                id="contest_id"
                value={filters.contest_id}
                onChange={(e) => setFilters({...filters, contest_id: e.target.value})}
                placeholder="UUID du contest"
              />
            </div>
            <div>
              <Label htmlFor="creator_id">Creator ID</Label>
              <Input
                id="creator_id"
                value={filters.creator_id}
                onChange={(e) => setFilters({...filters, creator_id: e.target.value})}
                placeholder="UUID du créateur"
              />
            </div>
            <div>
              <Label htmlFor="limit">Limite</Label>
              <Select value={filters.limit.toString()} onValueChange={(value) => setFilters({...filters, limit: parseInt(value)})}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="10">10</SelectItem>
                  <SelectItem value="20">20</SelectItem>
                  <SelectItem value="50">50</SelectItem>
                  <SelectItem value="100">100</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Liste des submissions */}
      <Card>
        <CardHeader>
          <CardTitle>Submissions ({pagination.total})</CardTitle>
          <CardDescription>
            Page {pagination.page} sur {pagination.pages}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex justify-center py-8">
              <RefreshCw className="w-6 h-6 animate-spin" />
            </div>
          ) : (
            <div className="space-y-4">
              {submissions.map((submission) => (
                <div key={submission.id} className="border rounded-lg p-4 hover:bg-gray-50">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <span className="text-2xl">{getNetworkIcon(submission.network)}</span>
                        <div>
                          <h3 className="font-medium">{submission.contests.title}</h3>
                          <p className="text-sm text-gray-600">
                            Par {submission.profiles.display_name || submission.profiles.email}
                          </p>
                        </div>
                        {getStatusBadge(submission.status)}
                      </div>
                      
                      <div className="flex items-center gap-4 text-sm text-gray-500 mb-2">
                        <span className="flex items-center gap-1">
                          <Calendar className="w-4 h-4" />
                          {new Date(submission.created_at).toLocaleDateString()}
                        </span>
                        <span className="flex items-center gap-1">
                          <User className="w-4 h-4" />
                          {submission.network}
                        </span>
                      </div>

                      {submission.reason && (
                        <p className="text-sm text-red-600 bg-red-50 p-2 rounded">
                          <strong>Raison:</strong> {submission.reason}
                        </p>
                      )}

                      {submission.moderation_queue?.automod_result && (
                        <div className="mt-2 p-2 bg-yellow-50 rounded text-sm">
                          <strong>Auto-mod:</strong> {JSON.stringify(submission.moderation_queue.automod_result)}
                        </div>
                      )}
                    </div>

                    <div className="flex gap-2 ml-4">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setSelectedSubmission(submission)}
                      >
                        <Eye className="w-4 h-4" />
                      </Button>
                      
                      {submission.status === 'pending_review' && (
                        <>
                          <Button
                            size="sm"
                            variant="default"
                            onClick={() => approveSubmission(submission.id)}
                            disabled={actionLoading === submission.id}
                          >
                            <CheckCircle className="w-4 h-4 mr-1" />
                            Approuver
                          </Button>
                          <Button
                            size="sm"
                            variant="destructive"
                            onClick={() => {
                              const reason = prompt('Raison du rejet:');
                              if (reason) rejectSubmission(submission.id, reason);
                            }}
                            disabled={actionLoading === submission.id}
                          >
                            <XCircle className="w-4 h-4 mr-1" />
                            Rejeter
                          </Button>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              ))}

              {submissions.length === 0 && !loading && (
                <div className="text-center py-8 text-gray-500">
                  Aucune submission trouvée
                </div>
              )}
            </div>
          )}

          {/* Pagination */}
          {pagination.pages > 1 && (
            <div className="flex justify-center gap-2 mt-6">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setFilters({...filters, page: Math.max(1, filters.page - 1)})}
                disabled={filters.page <= 1}
              >
                Précédent
              </Button>
              <span className="flex items-center px-3">
                {filters.page} / {pagination.pages}
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setFilters({...filters, page: Math.min(pagination.pages, filters.page + 1)})}
                disabled={filters.page >= pagination.pages}
              >
                Suivant
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Modal de détail */}
      {selectedSubmission && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <Card className="w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <CardHeader>
              <CardTitle>Détails de la submission</CardTitle>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setSelectedSubmission(null)}
                className="absolute top-4 right-4"
              >
                ✕
              </Button>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label>URL de la vidéo</Label>
                <p className="text-sm text-gray-600 break-all">{selectedSubmission.video_url}</p>
              </div>
              
              <div>
                <Label>Contest</Label>
                <p className="text-sm text-gray-600">{selectedSubmission.contests.title}</p>
              </div>
              
              <div>
                <Label>Créateur</Label>
                <p className="text-sm text-gray-600">
                  {selectedSubmission.profiles.display_name || selectedSubmission.profiles.email}
                </p>
              </div>
              
              <div>
                <Label>Statut</Label>
                <div className="mt-1">{getStatusBadge(selectedSubmission.status)}</div>
              </div>

              {selectedSubmission.reason && (
                <div>
                  <Label>Raison</Label>
                  <p className="text-sm text-gray-600">{selectedSubmission.reason}</p>
                </div>
              )}

              {selectedSubmission.moderation_queue?.automod_result && (
                <div>
                  <Label>Résultat Auto-mod</Label>
                  <pre className="text-xs bg-gray-100 p-2 rounded overflow-auto">
                    {JSON.stringify(selectedSubmission.moderation_queue.automod_result, null, 2)}
                  </pre>
                </div>
              )}

              <div className="flex gap-2 pt-4">
                {selectedSubmission.status === 'pending_review' && (
                  <>
                    <Button
                      onClick={() => {
                        approveSubmission(selectedSubmission.id);
                        setSelectedSubmission(null);
                      }}
                      disabled={actionLoading === selectedSubmission.id}
                    >
                      <CheckCircle className="w-4 h-4 mr-2" />
                      Approuver
                    </Button>
                    <Button
                      variant="destructive"
                      onClick={() => {
                        const reason = prompt('Raison du rejet:');
                        if (reason) {
                          rejectSubmission(selectedSubmission.id, reason);
                          setSelectedSubmission(null);
                        }
                      }}
                      disabled={actionLoading === selectedSubmission.id}
                    >
                      <XCircle className="w-4 h-4 mr-2" />
                      Rejeter
                    </Button>
                  </>
                )}
                <Button variant="outline" onClick={() => setSelectedSubmission(null)}>
                  Fermer
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}

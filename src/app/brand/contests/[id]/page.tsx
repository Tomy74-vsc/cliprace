"use client";
import { useState, useEffect } from "react";
import { getBrowserSupabase } from "@/lib/supabase/client";
import { motion } from "framer-motion";
import { 
  Trophy, 
  Eye, 
  Users, 
  Calendar, 
  DollarSign,
  TrendingUp,
  CheckCircle,
  XCircle,
  Clock,
  Edit,
  Play,
  Pause,
  MessageSquare
} from "lucide-react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";

type Contest = {
  id: string;
  title: string;
  description: string;
  status: "draft" | "active" | "completed" | "paused";
  starts_at: string;
  ends_at: string;
  total_views: number;
  total_submissions: number;
  created_at: string;
  updated_at: string;
  budget_cents: number;
  prize_pool_cents: number;
  hashtags: string[];
  visual_url: string;
};

type Submission = {
  id: string;
  creator_id: string;
  contest_id: string;
  content_url: string;
  status: "pending" | "approved" | "rejected";
  views: number;
  likes: number;
  comments: number;
  shares: number;
  engagement_rate: number;
  created_at: string;
  creator: {
    username: string;
    avatar_url: string;
    followers_count: number;
  };
};

export default function ContestDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const supabase = getBrowserSupabase();
  const [contest, setContest] = useState<Contest | null>(null);
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [loading, setLoading] = useState(true);
  const [submissionFilter, setSubmissionFilter] = useState<"all" | "pending" | "approved" | "rejected">("all");
  const [contestId, setContestId] = useState<string>("");

  useEffect(() => {
    async function loadParams() {
      const { id } = await params;
      setContestId(id);
    }
    loadParams();
  }, [params]);

  useEffect(() => {
    if (!contestId) return;
    
    async function loadContestData() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      try {
        // Load contest
        const { data: contestData } = await supabase
          .from("contests")
          .select("*")
          .eq("id", contestId)
          .eq("brand_id", user.id)
          .single();

        if (!contestData) {
          setLoading(false);
          return;
        }

        setContest(contestData as Contest);

        // Load submissions
        const { data: submissionsData } = await supabase
          .from("submissions")
          .select(`
            *,
            creator:profiles!submissions_creator_id_fkey(
              username,
              avatar_url,
              followers_count
            )
          `)
          .eq("contest_id", contestId)
          .order("created_at", { ascending: false });

        setSubmissions((submissionsData as Submission[]) || []);
        setLoading(false);
      } catch (error) {
        console.error("Error loading contest data:", error);
        setLoading(false);
      }
    }
    loadContestData();
  }, [supabase, contestId]);

  const getStatusBadge = (status: string) => {
    const statusConfig = {
      active: { color: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200", icon: Play },
      completed: { color: "bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200", icon: CheckCircle },
      draft: { color: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200", icon: Clock },
      paused: { color: "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200", icon: Pause },
    };
    
    const config = statusConfig[status as keyof typeof statusConfig] || statusConfig.draft;
    const Icon = config.icon;
    
    return (
      <Badge className={`${config.color} border-0`}>
        <Icon className="h-3 w-3 mr-1" />
        {status === "active" ? "Actif" : 
         status === "completed" ? "Terminé" :
         status === "draft" ? "Brouillon" : "En pause"}
      </Badge>
    );
  };

  const getSubmissionStatusBadge = (status: string) => {
    const statusConfig = {
      approved: { color: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200", icon: CheckCircle },
      rejected: { color: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200", icon: XCircle },
      pending: { color: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200", icon: Clock },
    };
    
    const config = statusConfig[status as keyof typeof statusConfig] || statusConfig.pending;
    const Icon = config.icon;
    
    return (
      <Badge className={`${config.color} border-0`}>
        <Icon className="h-3 w-3 mr-1" />
        {status === "approved" ? "Approuvé" : 
         status === "rejected" ? "Rejeté" : "En attente"}
      </Badge>
    );
  };

  const handleSubmissionAction = async (submissionId: string, action: "approve" | "reject") => {
    try {
      const { error } = await supabase
        .from("submissions")
        .update({ status: action === "approve" ? "approved" : "rejected" })
        .eq("id", submissionId);

      if (error) throw error;

      setSubmissions(submissions.map(s => 
        s.id === submissionId 
          ? { ...s, status: action === "approve" ? "approved" : "rejected" }
          : s
      ));
    } catch (error) {
      console.error("Error updating submission:", error);
    }
  };

  const filteredSubmissions = submissions.filter(submission => 
    submissionFilter === "all" || submission.status === submissionFilter
  );

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="animate-pulse space-y-4">
          <div className="h-8 w-64 bg-zinc-200 dark:bg-zinc-800 rounded"></div>
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-4">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="h-32 bg-zinc-200 dark:bg-zinc-800 rounded-2xl"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (!contest) {
    return (
      <div className="text-center py-12">
        <Trophy className="mx-auto h-12 w-12 text-zinc-400" />
        <h3 className="mt-4 text-lg font-semibold text-zinc-900 dark:text-zinc-100">
          Concours non trouvé
        </h3>
        <p className="mt-2 text-zinc-600 dark:text-zinc-400">
          Ce concours n&apos;existe pas ou vous n&apos;avez pas l&apos;autorisation de le voir.
        </p>
        <Link
          href="/brand/contests"
          className="mt-4 inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 px-6 py-3 text-sm font-medium text-white shadow-sm transition-all duration-200 hover:shadow-md"
        >
          Retour aux concours
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="flex items-start justify-between"
      >
        <div className="flex-1">
          <div className="flex items-center gap-3 mb-2">
            {getStatusBadge(contest.status)}
            <Link
              href="/brand/contests"
              className="text-sm text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200"
            >
              ← Retour aux concours
            </Link>
          </div>
          <h1 className="text-3xl font-bold bg-gradient-to-r from-violet-600 to-indigo-600 bg-clip-text text-transparent">
            {contest.title}
          </h1>
          <p className="mt-2 text-zinc-600 dark:text-zinc-400">
            {contest.description}
          </p>
          {contest.hashtags && contest.hashtags.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-2">
              {contest.hashtags.map((hashtag) => (
                <Badge key={hashtag} variant="secondary" className="text-xs">
                  #{hashtag}
                </Badge>
              ))}
            </div>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Link
            href={`/brand/contests/${contest.id}/edit`}
            className="inline-flex items-center gap-2 rounded-xl border border-zinc-200 px-4 py-2 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
          >
            <Edit className="h-4 w-4" />
            Modifier
          </Link>
        </div>
      </motion.div>

      {/* Metrics Cards */}
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-4">
        {[
          {
            title: "Vues totales",
            value: contest.total_views?.toLocaleString("fr-FR") || "0",
            icon: Eye,
            gradient: "from-blue-500 to-cyan-500",
            bgGradient: "from-blue-50 to-cyan-50 dark:from-blue-950 dark:to-cyan-950",
          },
          {
            title: "Participations",
            value: contest.total_submissions || 0,
            icon: Users,
            gradient: "from-emerald-500 to-teal-500",
            bgGradient: "from-emerald-50 to-teal-50 dark:from-emerald-950 dark:to-teal-950",
          },
          {
            title: "Budget",
            value: `€${(contest.budget_cents / 100).toFixed(2)}`,
            icon: DollarSign,
            gradient: "from-purple-500 to-pink-500",
            bgGradient: "from-purple-50 to-pink-50 dark:from-purple-950 dark:to-pink-950",
          },
          {
            title: "Gains",
            value: `€${(contest.prize_pool_cents / 100).toFixed(2)}`,
            icon: Trophy,
            gradient: "from-amber-500 to-orange-500",
            bgGradient: "from-amber-50 to-orange-50 dark:from-amber-950 dark:to-orange-950",
          },
        ].map((metric, index) => (
          <motion.div
            key={metric.title}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: index * 0.1 }}
            className={`relative overflow-hidden rounded-2xl border border-zinc-200/50 bg-gradient-to-br ${metric.bgGradient} p-6 shadow-sm transition-all duration-300 hover:shadow-lg dark:border-zinc-800/50`}
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-zinc-600 dark:text-zinc-400">{metric.title}</p>
                <p className="mt-2 text-2xl font-bold text-zinc-900 dark:text-zinc-100">{metric.value}</p>
              </div>
              <div className={`flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br ${metric.gradient} shadow-lg`}>
                <metric.icon className="h-6 w-6 text-white" />
              </div>
            </div>
            <div className={`absolute -right-4 -top-4 h-24 w-24 rounded-full bg-gradient-to-br ${metric.gradient} opacity-10`} />
          </motion.div>
        ))}
      </div>

      {/* Submissions Section */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.6 }}
      >
        <div className="mb-6 flex items-center justify-between">
          <h2 className="text-xl font-semibold">Participations ({submissions.length})</h2>
          <div className="flex items-center gap-2">
            <select
              value={submissionFilter}
              onChange={(e) => setSubmissionFilter(e.target.value as "all" | "pending" | "approved" | "rejected")}
              className="rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm focus:border-violet-300 focus:outline-none focus:ring-2 focus:ring-violet-500/20 dark:border-zinc-700 dark:bg-zinc-800"
              aria-label="Filtrer les participations"
            >
              <option value="all">Tous</option>
              <option value="pending">En attente</option>
              <option value="approved">Approuvés</option>
              <option value="rejected">Rejetés</option>
            </select>
          </div>
        </div>

        {filteredSubmissions.length === 0 ? (
          <div className="rounded-2xl border border-zinc-200 bg-zinc-50/50 p-8 text-center dark:border-zinc-800 dark:bg-zinc-900/50">
            <Users className="mx-auto h-12 w-12 text-zinc-400" />
            <h3 className="mt-4 text-lg font-semibold text-zinc-900 dark:text-zinc-100">
              Aucune participation
            </h3>
            <p className="mt-2 text-zinc-600 dark:text-zinc-400">
              {submissionFilter === "all" 
                ? "Aucun créateur n'a encore participé à ce concours"
                : `Aucune participation ${submissionFilter === "pending" ? "en attente" : submissionFilter === "approved" ? "approuvée" : "rejetée"}`}
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {filteredSubmissions.map((submission, index) => (
              <motion.div
                key={submission.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: 0.7 + index * 0.1 }}
                className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900"
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-4">
                    {/* Creator Avatar */}
                    <div className="h-12 w-12 rounded-full bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center">
                      <span className="text-sm font-semibold text-white">
                        {submission.creator?.username?.charAt(0).toUpperCase() || "?"}
                      </span>
                    </div>
                    
                    {/* Submission Info */}
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <h4 className="font-semibold text-zinc-900 dark:text-zinc-100">
                          @{submission.creator?.username || "Utilisateur"}
                        </h4>
                        {getSubmissionStatusBadge(submission.status)}
                      </div>
                      
                      <div className="grid grid-cols-2 gap-4 text-sm text-zinc-600 dark:text-zinc-400">
                        <div className="flex items-center gap-1">
                          <Eye className="h-4 w-4" />
                          <span>{submission.views?.toLocaleString("fr-FR") || 0} vues</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <TrendingUp className="h-4 w-4" />
                          <span>{submission.engagement_rate?.toFixed(1) || 0}% engagement</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <MessageSquare className="h-4 w-4" />
                          <span>{submission.likes || 0} likes</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <Calendar className="h-4 w-4" />
                          <span>{new Date(submission.created_at).toLocaleDateString()}</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2">
                    <a
                      href={submission.content_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-2 rounded-lg border border-zinc-200 px-3 py-2 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
                    >
                      <Eye className="h-4 w-4" />
                      Voir
                    </a>
                    
                    {submission.status === "pending" && (
                      <>
                        <button
                          onClick={() => handleSubmissionAction(submission.id, "approve")}
                          className="inline-flex items-center gap-2 rounded-lg bg-green-600 px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-green-700"
                        >
                          <CheckCircle className="h-4 w-4" />
                          Approuver
                        </button>
                        <button
                          onClick={() => handleSubmissionAction(submission.id, "reject")}
                          className="inline-flex items-center gap-2 rounded-lg bg-red-600 px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-red-700"
                        >
                          <XCircle className="h-4 w-4" />
                          Rejeter
                        </button>
                      </>
                    )}
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </motion.div>
    </div>
  );
}
"use client";
import { useState, useEffect } from "react";
import { getBrowserSupabase } from "@/lib/supabase/client";
import { motion } from "framer-motion";
import { 
  Trophy, 
  Eye, 
  Users, 
  Calendar, 
  MoreVertical,
  Plus,
  Search,
  Filter,
  Edit,
  Trash2,
  Eye as ViewIcon,
  Play,
  Pause,
  CheckCircle,
  Clock
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
};

type FilterType = "all" | "active" | "completed" | "draft" | "paused";
type SortType = "newest" | "oldest" | "views" | "submissions";

export default function ContestsPage() {
  const supabase = getBrowserSupabase();
  const [contests, setContests] = useState<Contest[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [filter, setFilter] = useState<FilterType>("all");
  const [sort, setSort] = useState<SortType>("newest");
  const [showDeleteModal, setShowDeleteModal] = useState<string | null>(null);

  useEffect(() => {
    async function loadContests() {
	const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      try {
        const { data: contestsData } = await supabase
          .from("contests")
          .select("*")
          .eq("brand_id", user.id)
          .order("created_at", { ascending: false });

        setContests((contestsData as Contest[]) || []);
        setLoading(false);
      } catch (error) {
        console.error("Error loading contests:", error);
        setLoading(false);
      }
    }
    loadContests();
  }, [supabase]);

  const filteredContests = contests
    .filter(contest => {
      const matchesSearch = contest.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
                           contest.description.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesFilter = filter === "all" || contest.status === filter;
      return matchesSearch && matchesFilter;
    })
    .sort((a, b) => {
      switch (sort) {
        case "newest":
          return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
        case "oldest":
          return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
        case "views":
          return (b.total_views || 0) - (a.total_views || 0);
        case "submissions":
          return (b.total_submissions || 0) - (a.total_submissions || 0);
        default:
          return 0;
      }
    });

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

  const handleDeleteContest = async (contestId: string) => {
    try {
      const { error } = await supabase
        .from("contests")
        .delete()
        .eq("id", contestId);

      if (error) throw error;

      setContests(contests.filter(c => c.id !== contestId));
      setShowDeleteModal(null);
    } catch (error) {
      console.error("Error deleting contest:", error);
    }
  };

  if (loading) {
	return (
      <div className="space-y-6">
        <div className="animate-pulse space-y-4">
          <div className="h-8 w-64 bg-zinc-200 dark:bg-zinc-800 rounded"></div>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="h-64 bg-zinc-200 dark:bg-zinc-800 rounded-2xl"></div>
            ))}
			</div>
						</div>
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
        className="flex items-center justify-between"
      >
        <div>
          <h1 className="text-3xl font-bold bg-gradient-to-r from-violet-600 to-indigo-600 bg-clip-text text-transparent">
            Mes concours
          </h1>
          <p className="mt-2 text-zinc-600 dark:text-zinc-400">
            Gérez tous vos concours et suivez leurs performances
          </p>
        </div>
        <Link
          href="/brand/contests/new"
          className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 px-6 py-3 text-sm font-medium text-white shadow-sm transition-all duration-200 hover:shadow-md hover:scale-105"
        >
          <Plus className="h-4 w-4" />
          Créer un concours
        </Link>
      </motion.div>

      {/* Filters and Search */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.1 }}
        className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between"
      >
        {/* Search */}
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
          <input
            type="text"
            placeholder="Rechercher un concours..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full rounded-xl border border-zinc-200 bg-zinc-50/50 py-2 pl-10 pr-4 text-sm placeholder:text-zinc-400 focus:border-violet-300 focus:bg-white focus:outline-none focus:ring-2 focus:ring-violet-500/20 dark:border-zinc-700 dark:bg-zinc-800/50 dark:focus:border-violet-600 dark:focus:bg-zinc-800"
          />
        </div>

        {/* Filters */}
        <div className="flex items-center gap-2">
          <Filter className="h-4 w-4 text-zinc-400" />
          <select
            value={filter}
            onChange={(e) => setFilter(e.target.value as FilterType)}
            className="rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm focus:border-violet-300 focus:outline-none focus:ring-2 focus:ring-violet-500/20 dark:border-zinc-700 dark:bg-zinc-800"
            aria-label="Filtrer par statut"
          >
            <option value="all">Tous les statuts</option>
            <option value="active">Actifs</option>
            <option value="completed">Terminés</option>
            <option value="draft">Brouillons</option>
            <option value="paused">En pause</option>
          </select>
          
          <select
            value={sort}
            onChange={(e) => setSort(e.target.value as SortType)}
            className="rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm focus:border-violet-300 focus:outline-none focus:ring-2 focus:ring-violet-500/20 dark:border-zinc-700 dark:bg-zinc-800"
            aria-label="Trier par"
          >
            <option value="newest">Plus récents</option>
            <option value="oldest">Plus anciens</option>
            <option value="views">Plus de vues</option>
            <option value="submissions">Plus de participations</option>
          </select>
        </div>
      </motion.div>

      {/* Contests Grid */}
      {filteredContests.length === 0 ? (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.2 }}
          className="rounded-2xl border border-zinc-200 bg-zinc-50/50 p-8 text-center dark:border-zinc-800 dark:bg-zinc-900/50"
        >
          <Trophy className="mx-auto h-12 w-12 text-zinc-400" />
          <h3 className="mt-4 text-lg font-semibold text-zinc-900 dark:text-zinc-100">
            {searchTerm || filter !== "all" ? "Aucun concours trouvé" : "Aucun concours créé"}
          </h3>
          <p className="mt-2 text-zinc-600 dark:text-zinc-400">
            {searchTerm || filter !== "all" 
              ? "Essayez de modifier vos critères de recherche" 
              : "Créez votre premier concours pour commencer"}
          </p>
          {!searchTerm && filter === "all" && (
            <Link
              href="/brand/contests/new"
              className="mt-4 inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 px-6 py-3 text-sm font-medium text-white shadow-sm transition-all duration-200 hover:shadow-md"
            >
              <Plus className="h-4 w-4" />
              Créer un concours
            </Link>
          )}
        </motion.div>
      ) : (
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
          {filteredContests.map((contest, index) => (
            <motion.div
              key={contest.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.2 + index * 0.1 }}
              whileHover={{ scale: 1.02, y: -2 }}
              className="group relative overflow-hidden rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm transition-all duration-300 hover:shadow-lg dark:border-zinc-800 dark:bg-zinc-900"
            >
              {/* Status Badge */}
              <div className="mb-4 flex items-center justify-between">
                {getStatusBadge(contest.status)}
                <div className="relative">
                  <button 
                    className="rounded-lg p-1 hover:bg-zinc-100 dark:hover:bg-zinc-800"
                    aria-label="Options du concours"
                  >
                    <MoreVertical className="h-4 w-4 text-zinc-400" />
                  </button>
                  {/* Dropdown menu would go here */}
                </div>
              </div>

              {/* Contest Info */}
              <div className="mb-4">
                <h3 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100 line-clamp-2">
                  {contest.title}
                </h3>
                <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400 line-clamp-2">
                  {contest.description}
                </p>
              </div>

              {/* Stats */}
              <div className="mb-4 grid grid-cols-2 gap-4">
                <div className="flex items-center gap-2">
                  <Eye className="h-4 w-4 text-zinc-400" />
                  <div>
                    <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
                      {contest.total_views?.toLocaleString("fr-FR") || 0}
                    </p>
                    <p className="text-xs text-zinc-500">Vues</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Users className="h-4 w-4 text-zinc-400" />
                  <div>
                    <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
                      {contest.total_submissions || 0}
                    </p>
                    <p className="text-xs text-zinc-500">Participations</p>
                  </div>
                </div>
              </div>

              {/* Dates */}
              <div className="mb-4 text-xs text-zinc-500">
                <div className="flex items-center gap-1">
                  <Calendar className="h-3 w-3" />
                  <span>Créé: {new Date(contest.created_at).toLocaleDateString()}</span>
                </div>
                {contest.ends_at && (
                  <div className="mt-1 flex items-center gap-1">
                    <Calendar className="h-3 w-3" />
                    <span>Fin: {new Date(contest.ends_at).toLocaleDateString()}</span>
                  </div>
                )}
              </div>

              {/* Budget */}
              <div className="mb-4 text-xs text-zinc-500">
                <span>Budget: €{(contest.budget_cents / 100).toFixed(2)}</span>
              </div>

              {/* Actions */}
              <div className="flex items-center gap-2">
                <Link
                  href={`/brand/contests/${contest.id}`}
                  className="flex-1 inline-flex items-center justify-center gap-2 rounded-lg bg-violet-50 px-3 py-2 text-sm font-medium text-violet-700 transition-colors hover:bg-violet-100 dark:bg-violet-900/20 dark:text-violet-300 dark:hover:bg-violet-900/30"
                >
                  <ViewIcon className="h-4 w-4" />
                  Voir
                </Link>
                <Link
                  href={`/brand/contests/${contest.id}/edit`}
                  className="inline-flex items-center justify-center rounded-lg border border-zinc-200 px-3 py-2 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
                >
                  <Edit className="h-4 w-4" />
                </Link>
                <button
                  onClick={() => setShowDeleteModal(contest.id)}
                  className="inline-flex items-center justify-center rounded-lg border border-zinc-200 px-3 py-2 text-sm font-medium text-red-600 transition-colors hover:bg-red-50 dark:border-zinc-700 dark:text-red-400 dark:hover:bg-red-950"
                  aria-label="Supprimer le concours"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </motion.div>
          ))}
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl dark:bg-zinc-900"
          >
            <h3 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
              Supprimer le concours
            </h3>
            <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
              Êtes-vous sûr de vouloir supprimer ce concours ? Cette action est irréversible.
            </p>
            <div className="mt-6 flex items-center gap-3">
              <button
                onClick={() => setShowDeleteModal(null)}
                className="flex-1 rounded-lg border border-zinc-200 px-4 py-2 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
              >
                Annuler
              </button>
              <button
                onClick={() => handleDeleteContest(showDeleteModal)}
                className="flex-1 rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-red-700"
              >
                Supprimer
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
}
"use client";
import { useState, useEffect } from "react";
import { getBrowserSupabase } from "@/lib/supabase/client";
import { motion } from "framer-motion";
import { 
  Trophy, 
  Eye, 
  Users, 
  TrendingUp, 
  Plus, 
  ArrowRight,
  Calendar,
  Target,
  BarChart3,
  MessageSquare
} from "lucide-react";
import Link from "next/link";
import { 
  AreaChart, 
  Area, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell
} from "recharts";

type Contest = {
  id: string;
  title: string;
  status: string;
  ends_at: string | null;
  total_views: number;
  total_submissions: number;
  created_at: string;
};

type KPI = {
  title: string;
  value: string | number;
  change: string;
  trend: "up" | "down" | "neutral";
  icon: React.ComponentType<{ className?: string }>;
  gradient: string;
  bgGradient: string;
};

export default function BrandDashboard() {
  const supabase = getBrowserSupabase();
  const [contests, setContests] = useState<Contest[]>([]);
  const [loading, setLoading] = useState(true);
  const [kpis, setKpis] = useState<KPI[]>([]);

  // Mock data for charts
  const viewsData = [
    { name: "Jan", views: 12000, submissions: 45 },
    { name: "Fév", views: 19000, submissions: 78 },
    { name: "Mar", views: 30000, submissions: 120 },
    { name: "Avr", views: 28000, submissions: 95 },
    { name: "Mai", views: 35000, submissions: 150 },
    { name: "Juin", views: 42000, submissions: 180 },
  ];

  const contestStatusData = [
    { name: "Actifs", value: 3, color: "#10B981" },
    { name: "Terminés", value: 8, color: "#6B7280" },
    { name: "En attente", value: 1, color: "#F59E0B" },
  ];

  useEffect(() => {
    async function loadData() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      try {
        // Load contests for this brand
        const { data: contestsData } = await supabase
          .from("contests")
          .select("*")
          .eq("brand_id", user.id)
          .order("created_at", { ascending: false })
          .limit(6);

        setContests((contestsData as Contest[]) || []);

        // Calculate KPIs
        const activeContests = contestsData?.filter(c => c.status === "active").length || 0;
        const totalViews = contestsData?.reduce((sum, c) => sum + (c.total_views || 0), 0) || 0;
        const totalSubmissions = contestsData?.reduce((sum, c) => sum + (c.total_submissions || 0), 0) || 0;
        const avgCPV = totalViews > 0 ? (totalSubmissions * 100 / totalViews).toFixed(2) : "0.00";

        setKpis([
          {
            title: "Concours actifs",
            value: activeContests,
            change: "+2 ce mois",
            trend: "up",
            icon: Trophy,
            gradient: "from-blue-500 to-cyan-500",
            bgGradient: "from-blue-50 to-cyan-50 dark:from-blue-950 dark:to-cyan-950",
          },
          {
            title: "Vues totales",
            value: totalViews.toLocaleString("fr-FR"),
            change: "+15% vs mois dernier",
            trend: "up",
            icon: Eye,
            gradient: "from-emerald-500 to-teal-500",
            bgGradient: "from-emerald-50 to-teal-50 dark:from-emerald-950 dark:to-teal-950",
          },
          {
            title: "Participations",
            value: totalSubmissions,
            change: "+8% vs mois dernier",
            trend: "up",
            icon: Users,
            gradient: "from-purple-500 to-pink-500",
            bgGradient: "from-purple-50 to-pink-50 dark:from-purple-950 dark:to-pink-950",
          },
          {
            title: "CPV moyen",
            value: `${avgCPV}%`,
            change: "-0.5% vs mois dernier",
            trend: "down",
            icon: TrendingUp,
            gradient: "from-amber-500 to-orange-500",
            bgGradient: "from-amber-50 to-orange-50 dark:from-amber-950 dark:to-orange-950",
          },
        ]);

        setLoading(false);
      } catch (error) {
        console.error("Error loading dashboard data:", error);
        setLoading(false);
      }
    }
    loadData();
  }, [supabase]);

  if (loading) {
	return (
      <div className="space-y-8">
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

  return (
    <div className="space-y-8">
      {/* Welcome Section */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="flex items-center justify-between"
      >
        <div>
          <h1 className="text-3xl font-bold bg-gradient-to-r from-violet-600 to-indigo-600 bg-clip-text text-transparent">
            Dashboard Marque
          </h1>
          <p className="mt-2 text-zinc-600 dark:text-zinc-400">
            Gérez vos concours et suivez vos performances
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

      {/* Messaging Quick Access */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.2 }}
        className="rounded-2xl border border-zinc-200 bg-gradient-to-r from-violet-50 to-indigo-50 p-6 shadow-sm dark:border-zinc-800 dark:from-violet-950 dark:to-indigo-950"
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-violet-500 to-indigo-500 shadow-lg">
              <MessageSquare className="h-6 w-6 text-white" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">Messagerie</h3>
              <p className="text-sm text-zinc-600 dark:text-zinc-400">
                Communiquez directement avec les créateurs
              </p>
            </div>
          </div>
          <Link
            href="/brand/messages"
            className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition-all duration-200 hover:shadow-md hover:scale-105"
          >
            Ouvrir la messagerie
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </motion.div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-4">
        {kpis.map((kpi, index) => (
          <motion.div
            key={kpi.title}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: index * 0.1 }}
            whileHover={{ scale: 1.02, y: -2 }}
            className={`relative overflow-hidden rounded-2xl border border-zinc-200/50 bg-gradient-to-br ${kpi.bgGradient} p-6 shadow-sm transition-all duration-300 hover:shadow-lg dark:border-zinc-800/50`}
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-zinc-600 dark:text-zinc-400">{kpi.title}</p>
                <p className="mt-2 text-2xl font-bold text-zinc-900 dark:text-zinc-100">{kpi.value}</p>
                <p className={`mt-1 text-xs flex items-center gap-1 ${
                  kpi.trend === "up" ? "text-green-600" : 
                  kpi.trend === "down" ? "text-red-600" : 
                  "text-zinc-500"
                }`}>
                  <TrendingUp className={`h-3 w-3 ${kpi.trend === "down" ? "rotate-180" : ""}`} />
                  {kpi.change}
                </p>
              </div>
              <div className={`flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br ${kpi.gradient} shadow-lg`}>
                <kpi.icon className="h-6 w-6 text-white" />
              </div>
            </div>
            <div className={`absolute -right-4 -top-4 h-24 w-24 rounded-full bg-gradient-to-br ${kpi.gradient} opacity-10`} />
          </motion.div>
        ))}
      </div>

      {/* Charts Section */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Views & Submissions Chart */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.4 }}
          className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900"
        >
          <div className="mb-4 flex items-center justify-between">
            <h3 className="text-lg font-semibold">Évolution des performances</h3>
            <BarChart3 className="h-5 w-5 text-zinc-400" />
          </div>
          <ResponsiveContainer width="100%" height={300}>
            <AreaChart data={viewsData}>
              <defs>
                <linearGradient id="viewsGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#8B5CF6" stopOpacity={0.3}/>
                  <stop offset="95%" stopColor="#8B5CF6" stopOpacity={0}/>
                </linearGradient>
                <linearGradient id="submissionsGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#06B6D4" stopOpacity={0.3}/>
                  <stop offset="95%" stopColor="#06B6D4" stopOpacity={0}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
              <XAxis dataKey="name" stroke="#6B7280" />
              <YAxis stroke="#6B7280" />
              <Tooltip 
                contentStyle={{ 
                  backgroundColor: "white", 
                  border: "1px solid #E5E7EB", 
                  borderRadius: "8px" 
                }} 
              />
              <Area
                type="monotone"
                dataKey="views"
                stroke="#8B5CF6"
                fillOpacity={1}
                fill="url(#viewsGradient)"
                name="Vues"
              />
              <Area
                type="monotone"
                dataKey="submissions"
                stroke="#06B6D4"
                fillOpacity={1}
                fill="url(#submissionsGradient)"
                name="Participations"
              />
            </AreaChart>
          </ResponsiveContainer>
        </motion.div>

        {/* Contest Status Chart */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.5 }}
          className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900"
        >
          <div className="mb-4 flex items-center justify-between">
            <h3 className="text-lg font-semibold">Statut des concours</h3>
            <Target className="h-5 w-5 text-zinc-400" />
          </div>
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie
                data={contestStatusData}
                cx="50%"
                cy="50%"
                innerRadius={60}
                outerRadius={100}
                paddingAngle={5}
                dataKey="value"
              >
                {contestStatusData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
          <div className="mt-4 flex justify-center gap-6">
            {contestStatusData.map((item) => (
              <div key={item.name} className="flex items-center gap-2">
                <div 
                  className={`h-3 w-3 rounded-full ${
                    item.name === "Actifs" ? "bg-green-500" :
                    item.name === "Terminés" ? "bg-gray-500" :
                    "bg-yellow-500"
                  }`}
                />
                <span className="text-sm text-zinc-600 dark:text-zinc-400">
                  {item.name}: {item.value}
                </span>
              </div>
            ))}
          </div>
        </motion.div>
      </div>

      {/* Recent Contests Section */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.6 }}
      >
        <div className="mb-6 flex items-center justify-between">
          <h2 className="text-xl font-semibold">Concours récents</h2>
          <Link
            href="/brand/contests"
            className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition-all duration-200 hover:shadow-md hover:scale-105"
          >
            Voir tous
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>

        {contests.length === 0 ? (
          <div className="rounded-2xl border border-zinc-200 bg-zinc-50/50 p-8 text-center dark:border-zinc-800 dark:bg-zinc-900/50">
            <Trophy className="mx-auto h-12 w-12 text-zinc-400" />
            <h3 className="mt-4 text-lg font-semibold text-zinc-900 dark:text-zinc-100">Aucun concours créé</h3>
            <p className="mt-2 text-zinc-600 dark:text-zinc-400">Créez votre premier concours pour commencer</p>
            <Link
              href="/brand/contests/new"
              className="mt-4 inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 px-6 py-3 text-sm font-medium text-white shadow-sm transition-all duration-200 hover:shadow-md"
            >
              <Plus className="h-4 w-4" />
              Créer un concours
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {contests.map((contest, index) => (
              <motion.div
                key={contest.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: 0.7 + index * 0.1 }}
                whileHover={{ scale: 1.02, y: -2 }}
                className="group relative overflow-hidden rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm transition-all duration-300 hover:shadow-lg dark:border-zinc-800 dark:bg-zinc-900"
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <h3 className="font-semibold text-zinc-900 dark:text-zinc-100">{contest.title}</h3>
                    <div className="mt-2 flex items-center gap-4 text-sm text-zinc-500">
                      <div className="flex items-center gap-1">
                        <Calendar className="h-4 w-4" />
                        <span>Créé: {new Date(contest.created_at).toLocaleDateString()}</span>
                      </div>
                      {contest.ends_at && (
                        <div className="flex items-center gap-1">
                          <Calendar className="h-4 w-4" />
                          <span>Fin: {new Date(contest.ends_at).toLocaleDateString()}</span>
                        </div>
                      )}
                    </div>
                    <div className="mt-3 flex items-center gap-4 text-sm">
                      <div className="flex items-center gap-1">
                        <Eye className="h-4 w-4 text-zinc-400" />
                        <span>{contest.total_views?.toLocaleString("fr-FR") || 0} vues</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <Users className="h-4 w-4 text-zinc-400" />
                        <span>{contest.total_submissions || 0} participations</span>
                      </div>
                    </div>
                  </div>
                  <div className={`flex h-8 w-8 items-center justify-center rounded-full ${
                    contest.status === "active" ? "bg-green-100 dark:bg-green-900" :
                    contest.status === "completed" ? "bg-gray-100 dark:bg-gray-900" :
                    "bg-yellow-100 dark:bg-yellow-900"
                  }`}>
                    <div className={`h-2 w-2 rounded-full ${
                      contest.status === "active" ? "bg-green-500" :
                      contest.status === "completed" ? "bg-gray-500" :
                      "bg-yellow-500"
                    }`} />
                  </div>
                </div>
                <Link
                  href={`/brand/contests/${contest.id}`}
                  className="mt-4 inline-flex items-center gap-2 text-sm font-medium text-violet-600 transition-colors hover:text-violet-700 dark:text-violet-400 dark:hover:text-violet-300"
                >
                  Voir le détail
                  <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
                </Link>
              </motion.div>
            ))}
          </div>
        )}
      </motion.div>
    </div>
  );
}
"use client";
import { useState, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import { Target, Euro, TrendingUp, Eye, Heart, MessageCircle, Share } from "lucide-react";
import { getBrowserSupabase } from "@/lib/supabase/client";

interface QuickStats {
  totalSubmissions: number;
  approvedSubmissions: number;
  totalEarnings: number;
  totalViews: number;
  totalLikes: number;
  totalComments: number;
  totalShares: number;
  avgEngagement: number;
}

export function QuickStats() {
  const [stats, setStats] = useState<QuickStats>({
    totalSubmissions: 0,
    approvedSubmissions: 0,
    totalEarnings: 0,
    totalViews: 0,
    totalLikes: 0,
    totalComments: 0,
    totalShares: 0,
    avgEngagement: 0,
  });
  const [loading, setLoading] = useState(true);
  const supabase = getBrowserSupabase();

  const loadStats = useCallback(async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Récupérer les soumissions et leurs métriques
      const { data: submissions } = await supabase
        .from("submissions")
        .select(`
          id,
          status,
          metrics_daily(views, likes, comments, shares)
        `)
        .eq("creator_id", user.id);

      if (submissions) {
        const totalSubmissions = submissions.length;
        const approvedSubmissions = submissions.filter(s => s.status === 'approved').length;
        
        // Calculer les métriques totales
        let totalViews = 0;
        let totalLikes = 0;
        let totalComments = 0;
        let totalShares = 0;

        submissions.forEach(submission => {
          if (submission.metrics_daily && submission.metrics_daily.length > 0) {
            const metrics = submission.metrics_daily[0];
            totalViews += metrics.views || 0;
            totalLikes += metrics.likes || 0;
            totalComments += metrics.comments || 0;
            totalShares += metrics.shares || 0;
          }
        });

        // Calculer l'engagement moyen
        const totalEngagement = totalLikes + totalComments + totalShares;
        const avgEngagement = totalViews > 0 ? (totalEngagement / totalViews) * 100 : 0;

        setStats({
          totalSubmissions,
          approvedSubmissions,
          totalEarnings: 0, // À calculer avec les gains réels
          totalViews,
          totalLikes,
          totalComments,
          totalShares,
          avgEngagement,
        });
      }
    } catch (error) {
      console.error('Erreur lors du chargement des statistiques:', error);
    } finally {
      setLoading(false);
    }
  }, [supabase]);

  useEffect(() => {
    loadStats();
  }, [loadStats]);

  const statCards = [
    {
      title: "Soumissions",
      value: stats.totalSubmissions,
      subtitle: `${stats.approvedSubmissions} approuvées`,
      icon: Target,
      gradient: "from-emerald-500 to-teal-500",
      bgGradient: "from-emerald-50 to-teal-50 dark:from-emerald-950 dark:to-teal-950",
    },
    {
      title: "Vues totales",
      value: stats.totalViews.toLocaleString(),
      subtitle: "Toutes plateformes",
      icon: Eye,
      gradient: "from-blue-500 to-cyan-500",
      bgGradient: "from-blue-50 to-cyan-50 dark:from-blue-950 dark:to-cyan-950",
    },
    {
      title: "Engagement",
      value: `${stats.avgEngagement.toFixed(1)}%`,
      subtitle: `${(stats.totalLikes + stats.totalComments + stats.totalShares).toLocaleString()} interactions`,
      icon: TrendingUp,
      gradient: "from-purple-500 to-pink-500",
      bgGradient: "from-purple-50 to-pink-50 dark:from-purple-950 dark:to-pink-950",
    },
    {
      title: "Gains",
      value: `€${(stats.totalEarnings / 100).toFixed(2)}`,
      subtitle: "Total cumulé",
      icon: Euro,
      gradient: "from-amber-500 to-orange-500",
      bgGradient: "from-amber-50 to-orange-50 dark:from-amber-950 dark:to-orange-950",
    },
  ];

  const engagementCards = [
    {
      title: "Likes",
      value: stats.totalLikes.toLocaleString(),
      icon: Heart,
      color: "text-red-500",
      bgColor: "bg-red-100 dark:bg-red-900",
    },
    {
      title: "Commentaires",
      value: stats.totalComments.toLocaleString(),
      icon: MessageCircle,
      color: "text-green-500",
      bgColor: "bg-green-100 dark:bg-green-900",
    },
    {
      title: "Partages",
      value: stats.totalShares.toLocaleString(),
      icon: Share,
      color: "text-blue-500",
      bgColor: "bg-blue-100 dark:bg-blue-900",
    },
  ];

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="animate-pulse space-y-4">
          <div className="h-8 w-48 bg-zinc-200 dark:bg-zinc-800 rounded"></div>
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
    <div className="space-y-6">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        <h2 className="text-xl font-semibold text-zinc-900 dark:text-zinc-100">
          Statistiques rapides
        </h2>
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          Vue d&apos;ensemble de vos performances
        </p>
      </motion.div>

      {/* Main Stats */}
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-4">
        {statCards.map((card, index) => (
          <motion.div
            key={card.title}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: index * 0.1 }}
            whileHover={{ scale: 1.02, y: -2 }}
            className={`relative overflow-hidden rounded-2xl border border-zinc-200/50 bg-gradient-to-br ${card.bgGradient} p-6 shadow-sm transition-all duration-300 hover:shadow-lg dark:border-zinc-800/50`}
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-zinc-600 dark:text-zinc-400">{card.title}</p>
                <p className="mt-2 text-2xl font-bold text-zinc-900 dark:text-zinc-100">{card.value}</p>
                <p className="text-xs text-zinc-500 dark:text-zinc-400">{card.subtitle}</p>
              </div>
              <div className={`flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br ${card.gradient} shadow-lg`}>
                <card.icon className="h-6 w-6 text-white" />
              </div>
            </div>
            <div className={`absolute -right-4 -top-4 h-24 w-24 rounded-full bg-gradient-to-br ${card.gradient} opacity-10`} />
          </motion.div>
        ))}
      </div>

      {/* Engagement Breakdown */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.4 }}
        className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900"
      >
        <h3 className="mb-4 text-lg font-semibold text-zinc-900 dark:text-zinc-100">
          Détail de l&apos;engagement
        </h3>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          {engagementCards.map((card, index) => (
            <motion.div
              key={card.title}
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.3, delay: 0.5 + index * 0.1 }}
              className="flex items-center gap-3 rounded-xl bg-zinc-50 p-4 dark:bg-zinc-800"
            >
              <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${card.bgColor}`}>
                <card.icon className={`h-5 w-5 ${card.color}`} />
              </div>
              <div>
                <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100">{card.value}</p>
                <p className="text-xs text-zinc-500 dark:text-zinc-400">{card.title}</p>
              </div>
            </motion.div>
          ))}
        </div>
      </motion.div>
    </div>
  );
}

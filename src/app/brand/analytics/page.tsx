"use client";
import { useState, useEffect, useCallback } from "react";
import { getBrowserSupabase } from "@/lib/supabase/client";
import { motion } from "framer-motion";
import { 
  BarChart3, 
  TrendingUp, 
  Eye, 
  Users, 
  DollarSign,
  Target,
  Calendar,
  Download,
  Filter,
  RefreshCw,
  ArrowUpRight,
  ArrowDownRight,
  Minus
} from "lucide-react";
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
  Cell,
  Legend
} from "recharts";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

type AnalyticsData = {
  totalContests: number;
  activeContests: number;
  totalViews: number;
  totalSubmissions: number;
  totalSpent: number;
  avgEngagement: number;
  conversionRate: number;
  avgCPV: number;
  totalReach: number;
};

type TimeSeriesData = {
  date: string;
  views: number;
  submissions: number;
  engagement: number;
  reach: number;
  spend: number;
};

type ContestPerformance = {
  id: string;
  title: string;
  status: "active" | "completed" | "draft" | "paused";
  views: number;
  submissions: number;
  engagement: number;
  conversionRate: number;
  budget: number;
  spent: number;
  roi: number;
  startDate: string;
  endDate: string;
};

type EngagementData = {
  name: string;
  value: number;
  color: string;
  percentage: number;
};

type MetricCard = {
  title: string;
  value: string | number;
  change: string;
  trend: "up" | "down" | "neutral";
  icon: React.ComponentType<{ className?: string }>;
  gradient: string;
  bgGradient: string;
  format?: "number" | "currency" | "percentage";
};

// Mock data for development
const mockAnalytics: AnalyticsData = {
    totalContests: 12,
    activeContests: 3,
    totalViews: 245000,
    totalSubmissions: 156,
    totalSpent: 15000,
    avgEngagement: 6.2,
    conversionRate: 8.5,
    avgCPV: 0.06,
    totalReach: 180000,
  };

const mockTimeSeriesData: TimeSeriesData[] = [
    { date: "2024-01-01", views: 1200, submissions: 8, engagement: 45, reach: 950, spend: 120 },
    { date: "2024-01-02", views: 1900, submissions: 12, engagement: 52, reach: 1400, spend: 180 },
    { date: "2024-01-03", views: 2500, submissions: 18, engagement: 48, reach: 1900, spend: 220 },
    { date: "2024-01-04", views: 3200, submissions: 25, engagement: 55, reach: 2400, spend: 280 },
    { date: "2024-01-05", views: 2800, submissions: 22, engagement: 51, reach: 2100, spend: 250 },
    { date: "2024-01-06", views: 3500, submissions: 28, engagement: 58, reach: 2600, spend: 320 },
    { date: "2024-01-07", views: 4200, submissions: 35, engagement: 62, reach: 3100, spend: 380 },
    { date: "2024-01-08", views: 3800, submissions: 32, engagement: 59, reach: 2800, spend: 350 },
    { date: "2024-01-09", views: 4500, submissions: 38, engagement: 65, reach: 3300, spend: 420 },
    { date: "2024-01-10", views: 5200, submissions: 42, engagement: 68, reach: 3800, spend: 480 },
  ];

const mockContestPerformance: ContestPerformance[] = [
    { 
      id: "1", 
      title: "Collection Printemps 2024", 
      status: "completed",
      views: 45000, 
      submissions: 120, 
      engagement: 6.2, 
      conversionRate: 85, 
      budget: 5000, 
      spent: 4800, 
      roi: 240,
      startDate: "2024-01-01",
      endDate: "2024-01-31"
    },
    { 
      id: "2", 
      title: "Style Été", 
      status: "active",
      views: 32000, 
      submissions: 95, 
      engagement: 5.8, 
      conversionRate: 78, 
      budget: 4000, 
      spent: 2200, 
      roi: 180,
      startDate: "2024-02-01",
      endDate: "2024-02-28"
    },
    { 
      id: "3", 
      title: "Mode Automne", 
      status: "completed",
      views: 28000, 
      submissions: 80, 
      engagement: 5.5, 
      conversionRate: 72, 
      budget: 3500, 
      spent: 3400, 
      roi: 160,
      startDate: "2023-10-01",
      endDate: "2023-10-31"
    },
    { 
      id: "4", 
      title: "Collection Hiver", 
      status: "paused",
      views: 38000, 
      submissions: 110, 
      engagement: 6.0, 
      conversionRate: 82, 
      budget: 4500, 
      spent: 1800, 
      roi: 200,
      startDate: "2023-12-01",
      endDate: "2023-12-31"
    },
  ];

const mockEngagementData: EngagementData[] = [
    { name: "Likes", value: 1250, color: "#8B5CF6", percentage: 65 },
    { name: "Comments", value: 180, color: "#06B6D4", percentage: 20 },
    { name: "Shares", value: 95, color: "#10B981", percentage: 15 },
  ];

export default function AnalyticsPage() {
  const supabase = getBrowserSupabase();
  const [analytics, setAnalytics] = useState<AnalyticsData | null>(null);
  const [timeSeriesData, setTimeSeriesData] = useState<TimeSeriesData[]>([]);
  const [contestPerformance, setContestPerformance] = useState<ContestPerformance[]>([]);
  const [engagementData, setEngagementData] = useState<EngagementData[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [dateRange, setDateRange] = useState("30d");
  const [selectedMetric, setSelectedMetric] = useState("views");

  const loadAnalytics = useCallback(async () => {
    setRefreshing(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // TODO: Replace with actual API calls
      // const { data: analyticsData } = await supabase
      //   .rpc('brand_analytics_metrics', { p_brand_id: user.id, p_date_range: dateRange })
      //   .single();

      // Simulate API delay
      await new Promise(resolve => setTimeout(resolve, 1000));

      setAnalytics(mockAnalytics);
      setTimeSeriesData(mockTimeSeriesData);
      setContestPerformance(mockContestPerformance);
      setEngagementData(mockEngagementData);
      setLoading(false);
    } catch (error) {
      console.error("Error loading analytics:", error);
      setLoading(false);
    } finally {
      setRefreshing(false);
    }
  }, [supabase]);

  useEffect(() => {
    loadAnalytics();
  }, [loadAnalytics]);

  const getMetricCards = (): MetricCard[] => {
    if (!analytics) return [];
    
    return [
      {
        title: "Total concours",
        value: analytics.totalContests,
        change: "+2 ce mois",
        trend: "up",
        icon: BarChart3,
        gradient: "from-blue-500 to-cyan-500",
        bgGradient: "from-blue-50 to-cyan-50 dark:from-blue-950 dark:to-cyan-950",
        format: "number"
      },
      {
        title: "Vues totales",
        value: analytics.totalViews.toLocaleString("fr-FR"),
        change: "+15% vs mois dernier",
        trend: "up",
        icon: Eye,
        gradient: "from-emerald-500 to-teal-500",
        bgGradient: "from-emerald-50 to-teal-50 dark:from-emerald-950 dark:to-teal-950",
        format: "number"
      },
      {
        title: "Participations",
        value: analytics.totalSubmissions,
        change: "+8% vs mois dernier",
        trend: "up",
        icon: Users,
        gradient: "from-purple-500 to-pink-500",
        bgGradient: "from-purple-50 to-pink-50 dark:from-purple-950 dark:to-pink-950",
        format: "number"
      },
      {
        title: "Budget total",
        value: `€${(analytics.totalSpent / 100).toFixed(2)}`,
        change: "+12% vs mois dernier",
        trend: "up",
        icon: DollarSign,
        gradient: "from-amber-500 to-orange-500",
        bgGradient: "from-amber-50 to-orange-50 dark:from-amber-950 dark:to-orange-950",
        format: "currency"
      },
      {
        title: "Engagement moyen",
        value: `${analytics.avgEngagement}%`,
        change: "+0.3% vs mois dernier",
        trend: "up",
        icon: Target,
        gradient: "from-violet-500 to-indigo-500",
        bgGradient: "from-violet-50 to-indigo-50 dark:from-violet-950 dark:to-indigo-950",
        format: "percentage"
      },
      {
        title: "Taux de conversion",
        value: `${analytics.conversionRate}%`,
        change: "-0.5% vs mois dernier",
        trend: "down",
        icon: TrendingUp,
        gradient: "from-rose-500 to-pink-500",
        bgGradient: "from-rose-50 to-pink-50 dark:from-rose-950 dark:to-pink-950",
        format: "percentage"
      }
    ];
  };

  const getStatusBadge = (status: string) => {
    const statusConfig = {
      active: { color: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200", label: "Actif" },
      completed: { color: "bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200", label: "Terminé" },
      draft: { color: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200", label: "Brouillon" },
      paused: { color: "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200", label: "En pause" },
    };
    
    const config = statusConfig[status as keyof typeof statusConfig] || statusConfig.draft;
    
    return (
      <Badge className={`${config.color} border-0 text-xs`}>
        {config.label}
      </Badge>
    );
  };

  const getTrendIcon = (trend: "up" | "down" | "neutral") => {
    switch (trend) {
      case "up":
        return <ArrowUpRight className="h-3 w-3" />;
      case "down":
        return <ArrowDownRight className="h-3 w-3" />;
      default:
        return <Minus className="h-3 w-3" />;
    }
  };

  const handleExport = () => {
    // TODO: Implement data export functionality
    console.log("Exporting analytics data...");
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("fr-FR");
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="animate-pulse space-y-4">
          <div className="h-8 w-64 bg-zinc-200 dark:bg-zinc-800 rounded"></div>
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="h-32 bg-zinc-200 dark:bg-zinc-800 rounded-2xl"></div>
            ))}
          </div>
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <div className="h-80 bg-zinc-200 dark:bg-zinc-800 rounded-2xl"></div>
            <div className="h-80 bg-zinc-200 dark:bg-zinc-800 rounded-2xl"></div>
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
            Analytics
          </h1>
          <p className="mt-2 text-zinc-600 dark:text-zinc-400">
            Analysez les performances de vos concours et optimisez vos campagnes
          </p>
        </div>
        <div className="flex items-center gap-3">
          <select
            value={dateRange}
            onChange={(e) => setDateRange(e.target.value)}
            className="rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm focus:border-violet-300 focus:outline-none focus:ring-2 focus:ring-violet-500/20 dark:border-zinc-700 dark:bg-zinc-800"
            aria-label="Sélectionner la période"
          >
            <option value="7d">7 derniers jours</option>
            <option value="30d">30 derniers jours</option>
            <option value="90d">90 derniers jours</option>
            <option value="1y">1 an</option>
          </select>
          <Button
            onClick={loadAnalytics}
            disabled={refreshing}
            variant="outline"
            size="sm"
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${refreshing ? "animate-spin" : ""}`} />
            Actualiser
          </Button>
          <Button onClick={handleExport} variant="outline" size="sm">
            <Download className="h-4 w-4 mr-2" />
            Exporter
          </Button>
        </div>
      </motion.div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        {getMetricCards().map((metric, index) => (
          <motion.div
            key={metric.title}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: index * 0.1 }}
            className={`relative overflow-hidden rounded-2xl border border-zinc-200/50 bg-gradient-to-br ${metric.bgGradient} p-6 shadow-sm transition-all duration-300 hover:shadow-lg dark:border-zinc-800/50`}
          >
            <div className="flex items-center justify-between">
              <div className="flex-1">
                <p className="text-sm font-medium text-zinc-600 dark:text-zinc-400">{metric.title}</p>
                <p className="mt-2 text-2xl font-bold text-zinc-900 dark:text-zinc-100">{metric.value}</p>
                <p className={`mt-1 text-xs flex items-center gap-1 ${
                  metric.trend === "up" ? "text-green-600 dark:text-green-400" : 
                  metric.trend === "down" ? "text-red-600 dark:text-red-400" : 
                  "text-zinc-500 dark:text-zinc-400"
                }`}>
                  {getTrendIcon(metric.trend)}
                  {metric.change}
                </p>
              </div>
              <div className={`flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br ${metric.gradient} shadow-lg`}>
                <metric.icon className="h-6 w-6 text-white" />
              </div>
            </div>
            <div className={`absolute -right-4 -top-4 h-24 w-24 rounded-full bg-gradient-to-br ${metric.gradient} opacity-10`} />
          </motion.div>
        ))}
      </div>

      {/* Charts Section */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Performance Over Time */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.4 }}
          className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-700 dark:bg-zinc-900"
        >
          <div className="mb-4 flex items-center justify-between">
            <h3 className="text-lg font-semibold">Évolution des performances</h3>
            <div className="flex items-center gap-2">
              <select
                value={selectedMetric}
                onChange={(e) => setSelectedMetric(e.target.value)}
                className="rounded-lg border border-zinc-200 bg-white px-2 py-1 text-xs focus:border-violet-300 focus:outline-none focus:ring-2 focus:ring-violet-500/20 dark:border-zinc-700 dark:bg-zinc-800"
                aria-label="Sélectionner la métrique"
              >
                <option value="views">Vues</option>
                <option value="submissions">Participations</option>
                <option value="engagement">Engagement</option>
                <option value="reach">Portée</option>
                <option value="spend">Dépenses</option>
              </select>
              <Calendar className="h-5 w-5 text-zinc-400" />
            </div>
          </div>
          <ResponsiveContainer width="100%" height={300}>
            <AreaChart data={timeSeriesData}>
              <defs>
                <linearGradient id="viewsGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#8B5CF6" stopOpacity={0.3}/>
                  <stop offset="95%" stopColor="#8B5CF6" stopOpacity={0}/>
                </linearGradient>
                <linearGradient id="submissionsGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#06B6D4" stopOpacity={0.3}/>
                  <stop offset="95%" stopColor="#06B6D4" stopOpacity={0}/>
                </linearGradient>
                <linearGradient id="engagementGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#10B981" stopOpacity={0.3}/>
                  <stop offset="95%" stopColor="#10B981" stopOpacity={0}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
              <XAxis 
                dataKey="date" 
                stroke="#6B7280" 
                tickFormatter={(value) => new Date(value).toLocaleDateString("fr-FR", { month: "short", day: "numeric" })}
              />
              <YAxis stroke="#6B7280" />
              <Tooltip 
                contentStyle={{ 
                  backgroundColor: "white", 
                  border: "1px solid #E5E7EB", 
                  borderRadius: "8px",
                  boxShadow: "0 4px 6px -1px rgba(0, 0, 0, 0.1)"
                }}
                labelFormatter={(value) => new Date(value).toLocaleDateString("fr-FR")}
              />
              <Area
                type="monotone"
                dataKey={selectedMetric}
                stroke={selectedMetric === "views" ? "#8B5CF6" : selectedMetric === "submissions" ? "#06B6D4" : "#10B981"}
                fillOpacity={1}
                fill={`url(#${selectedMetric}Gradient)`}
                name={selectedMetric === "views" ? "Vues" : selectedMetric === "submissions" ? "Participations" : selectedMetric === "engagement" ? "Engagement" : selectedMetric === "reach" ? "Portée" : "Dépenses"}
              />
            </AreaChart>
          </ResponsiveContainer>
        </motion.div>

        {/* Engagement Breakdown */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.5 }}
          className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-700 dark:bg-zinc-900"
        >
          <div className="mb-4 flex items-center justify-between">
            <h3 className="text-lg font-semibold">Répartition de l&apos;engagement</h3>
            <Target className="h-5 w-5 text-zinc-400" />
          </div>
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie
                data={engagementData}
                cx="50%"
                cy="50%"
                innerRadius={60}
                outerRadius={100}
                paddingAngle={5}
                dataKey="value"
              >
                {engagementData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip 
                formatter={(value: number, name: string) => [value, name]}
                contentStyle={{ 
                  backgroundColor: "white", 
                  border: "1px solid #E5E7EB", 
                  borderRadius: "8px",
                  boxShadow: "0 4px 6px -1px rgba(0, 0, 0, 0.1)"
                }}
              />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
          <div className="mt-4 flex justify-center gap-6">
            {engagementData.map((item) => (
              <div key={item.name} className="flex items-center gap-2">
                <div 
                  className={`h-3 w-3 rounded-full ${
                    item.name === "Likes" ? "bg-violet-500" :
                    item.name === "Comments" ? "bg-cyan-500" :
                    "bg-emerald-500"
                  }`}
                />
                <span className="text-sm text-zinc-600 dark:text-zinc-400">
                  {item.name}: {item.value} ({item.percentage}%)
                </span>
              </div>
            ))}
          </div>
        </motion.div>
      </div>

      {/* Contest Performance Table */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.6 }}
        className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-700 dark:bg-zinc-900"
      >
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-lg font-semibold">Performance par concours</h3>
          <div className="flex items-center gap-2">
            <Filter className="h-5 w-5 text-zinc-400" />
            <BarChart3 className="h-5 w-5 text-zinc-400" />
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-zinc-200 dark:border-zinc-700">
                <th className="text-left py-3 px-4 font-medium text-zinc-600 dark:text-zinc-400">Concours</th>
                <th className="text-center py-3 px-4 font-medium text-zinc-600 dark:text-zinc-400">Statut</th>
                <th className="text-right py-3 px-4 font-medium text-zinc-600 dark:text-zinc-400">Vues</th>
                <th className="text-right py-3 px-4 font-medium text-zinc-600 dark:text-zinc-400">Participations</th>
                <th className="text-right py-3 px-4 font-medium text-zinc-600 dark:text-zinc-400">Engagement</th>
                <th className="text-right py-3 px-4 font-medium text-zinc-600 dark:text-zinc-400">Taux de conversion</th>
                <th className="text-right py-3 px-4 font-medium text-zinc-600 dark:text-zinc-400">ROI</th>
                <th className="text-right py-3 px-4 font-medium text-zinc-600 dark:text-zinc-400">Période</th>
              </tr>
            </thead>
            <tbody>
              {contestPerformance.map((contest) => (
                <tr key={contest.id} className="border-b border-zinc-100 dark:border-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-800/50">
                  <td className="py-3 px-4 font-medium text-zinc-900 dark:text-zinc-100">
                    {contest.title}
                  </td>
                  <td className="py-3 px-4 text-center">
                    {getStatusBadge(contest.status)}
                  </td>
                  <td className="py-3 px-4 text-right text-zinc-600 dark:text-zinc-400">
                    {contest.views.toLocaleString("fr-FR")}
                  </td>
                  <td className="py-3 px-4 text-right text-zinc-600 dark:text-zinc-400">
                    {contest.submissions}
                  </td>
                  <td className="py-3 px-4 text-right text-zinc-600 dark:text-zinc-400">
                    {contest.engagement}%
                  </td>
                  <td className="py-3 px-4 text-right text-zinc-600 dark:text-zinc-400">
                    {contest.conversionRate}%
                  </td>
                  <td className="py-3 px-4 text-right text-zinc-600 dark:text-zinc-400">
                    {contest.roi}%
                  </td>
                  <td className="py-3 px-4 text-right text-zinc-600 dark:text-zinc-400">
                    {formatDate(contest.startDate)} - {formatDate(contest.endDate)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </motion.div>

      {/* Additional Insights */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.7 }}
        className="grid grid-cols-1 gap-6 lg:grid-cols-2"
      >
        {/* Top Performing Content */}
        <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-700 dark:bg-zinc-900">
          <h3 className="text-lg font-semibold mb-4">Contenu le plus performant</h3>
          <div className="space-y-3">
            {contestPerformance.slice(0, 3).map((contest, index) => (
              <div key={contest.id} className="flex items-center justify-between p-3 rounded-lg bg-zinc-50 dark:bg-zinc-800">
                <div className="flex items-center gap-3">
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-r from-violet-600 to-indigo-600 text-white text-sm font-semibold">
                    {index + 1}
                  </div>
                  <div>
                    <p className="font-medium text-sm">{contest.title}</p>
                    <p className="text-xs text-zinc-600 dark:text-zinc-400">{contest.views.toLocaleString("fr-FR")} vues</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-sm font-semibold text-green-600 dark:text-green-400">{contest.engagement}%</p>
                  <p className="text-xs text-zinc-600 dark:text-zinc-400">engagement</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Quick Actions */}
        <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-700 dark:bg-zinc-900">
          <h3 className="text-lg font-semibold mb-4">Actions rapides</h3>
          <div className="space-y-3">
            <Button className="w-full justify-start" variant="outline">
              <BarChart3 className="h-4 w-4 mr-2" />
              Créer un nouveau concours
            </Button>
            <Button className="w-full justify-start" variant="outline">
              <Download className="h-4 w-4 mr-2" />
              Exporter les données
            </Button>
            <Button className="w-full justify-start" variant="outline">
              <Target className="h-4 w-4 mr-2" />
              Optimiser les campagnes
            </Button>
          </div>
        </div>
      </motion.div>
    </div>
  );
}

"use client";
import { useState, useEffect } from "react";
import { getBrowserSupabase } from "@/lib/supabase/client";
import { motion } from "framer-motion";
import { Trophy, Target, Euro, TrendingUp, Calendar, ArrowRight } from "lucide-react";
import Link from "next/link";

type Contest = {
	id: string;
	title: string;
	status: string;
	ends_at: string | null;
};

export default function CreatorDashboard() {
	const supabase = getBrowserSupabase();
	const [activeContests, setActiveContests] = useState<Contest[]>([]);
	const [totalSubmissions, setTotalSubmissions] = useState(0);
	const [totalEarningsCents, setTotalEarningsCents] = useState(0);
	const [avgEngagement, setAvgEngagement] = useState(0);
	const [loading, setLoading] = useState(true);

	useEffect(() => {
		async function loadData() {
			const { data: { user } } = await supabase.auth.getUser();
			if (!user) return;

			const [contestsRes, submissionsRes, earningsRes, engagementRes] = await Promise.all([
				supabase.from("contests").select("id,title,status,ends_at").eq("status", "active").order("ends_at", { ascending: true }).limit(6),
				supabase.from("submissions").select("id").eq("creator_id", user.id),
				supabase.rpc("creator_total_earnings_cents", { p_creator_id: user.id }).single(),
				supabase.rpc("creator_avg_engagement", { p_creator_id: user.id }).single(),
			]);

			setActiveContests((contestsRes.data ?? []) as Contest[]);
			setTotalSubmissions((submissionsRes.data ?? []).length);
			setTotalEarningsCents(Number((earningsRes?.data as { creator_total_earnings_cents?: number })?.creator_total_earnings_cents ?? 0));
			setAvgEngagement(Number((engagementRes?.data as { creator_avg_engagement?: number })?.creator_avg_engagement ?? 0));
			setLoading(false);
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

	const kpiCards = [
		{
			title: "Concours en cours",
			value: activeContests.length,
			icon: Trophy,
			gradient: "from-blue-500 to-cyan-500",
			bgGradient: "from-blue-50 to-cyan-50 dark:from-blue-950 dark:to-cyan-950",
		},
		{
			title: "Total participations",
			value: totalSubmissions,
			icon: Target,
			gradient: "from-emerald-500 to-teal-500",
			bgGradient: "from-emerald-50 to-teal-50 dark:from-emerald-950 dark:to-teal-950",
		},
		{
			title: "Gains cumulés",
			value: `€${(totalEarningsCents / 100).toFixed(2)}`,
			icon: Euro,
			gradient: "from-amber-500 to-orange-500",
			bgGradient: "from-amber-50 to-orange-50 dark:from-amber-950 dark:to-orange-950",
		},
		{
			title: "Engagement moyen",
			value: `${avgEngagement.toFixed(1)}%`,
			icon: TrendingUp,
			gradient: "from-purple-500 to-pink-500",
			bgGradient: "from-purple-50 to-pink-50 dark:from-purple-950 dark:to-pink-950",
		},
	];

	return (
		<div className="space-y-8">
			{/* Welcome Section */}
			<motion.div
				initial={{ opacity: 0, y: 20 }}
				animate={{ opacity: 1, y: 0 }}
				transition={{ duration: 0.5 }}
				className="text-center"
			>
				<h1 className="text-3xl font-bold bg-gradient-to-r from-indigo-600 to-violet-600 bg-clip-text text-transparent">
					Bienvenue sur votre Dashboard
				</h1>
				<p className="mt-2 text-zinc-600 dark:text-zinc-400">
					Suivez vos performances et découvrez de nouveaux concours
				</p>
			</motion.div>

			{/* KPI Cards */}
			<div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-4">
				{kpiCards.map((card, index) => (
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
							</div>
							<div className={`flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br ${card.gradient} shadow-lg`}>
								<card.icon className="h-6 w-6 text-white" />
							</div>
						</div>
						<div className={`absolute -right-4 -top-4 h-24 w-24 rounded-full bg-gradient-to-br ${card.gradient} opacity-10`} />
					</motion.div>
				))}
			</div>

			{/* Active Contests Section */}
			<motion.div
				initial={{ opacity: 0, y: 20 }}
				animate={{ opacity: 1, y: 0 }}
				transition={{ duration: 0.5, delay: 0.4 }}
			>
				<div className="mb-6 flex items-center justify-between">
					<h2 className="text-xl font-semibold">Concours actifs</h2>
					<Link
						href="/creator/discover"
						className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition-all duration-200 hover:shadow-md hover:scale-105"
					>
						Découvrir les concours
						<ArrowRight className="h-4 w-4" />
					</Link>
				</div>

				{activeContests.length === 0 ? (
					<div className="rounded-2xl border border-zinc-200 bg-zinc-50/50 p-8 text-center dark:border-zinc-800 dark:bg-zinc-900/50">
						<Trophy className="mx-auto h-12 w-12 text-zinc-400" />
						<h3 className="mt-4 text-lg font-semibold text-zinc-900 dark:text-zinc-100">Aucun concours actif</h3>
						<p className="mt-2 text-zinc-600 dark:text-zinc-400">Découvrez de nouveaux concours pour commencer à participer</p>
						<Link
							href="/creator/discover"
							className="mt-4 inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 px-6 py-3 text-sm font-medium text-white shadow-sm transition-all duration-200 hover:shadow-md"
						>
							Explorer les concours
							<ArrowRight className="h-4 w-4" />
						</Link>
					</div>
				) : (
					<div className="grid grid-cols-1 gap-4 md:grid-cols-2">
						{activeContests.map((contest, index) => (
							<motion.div
								key={contest.id}
								initial={{ opacity: 0, y: 20 }}
								animate={{ opacity: 1, y: 0 }}
								transition={{ duration: 0.5, delay: 0.5 + index * 0.1 }}
								whileHover={{ scale: 1.02, y: -2 }}
								className="group relative overflow-hidden rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm transition-all duration-300 hover:shadow-lg dark:border-zinc-800 dark:bg-zinc-900"
							>
								<div className="flex items-start justify-between">
									<div className="flex-1">
										<h3 className="font-semibold text-zinc-900 dark:text-zinc-100">{contest.title}</h3>
										<div className="mt-2 flex items-center gap-2 text-sm text-zinc-500">
											<Calendar className="h-4 w-4" />
											<span>Fin: {contest.ends_at ? new Date(contest.ends_at).toLocaleDateString() : "—"}</span>
										</div>
									</div>
									<div className="flex h-8 w-8 items-center justify-center rounded-full bg-green-100 dark:bg-green-900">
										<div className="h-2 w-2 rounded-full bg-green-500" />
									</div>
								</div>
								<Link
									href={`/creator/contests/${contest.id}`}
									className="mt-4 inline-flex items-center gap-2 text-sm font-medium text-indigo-600 transition-colors hover:text-indigo-700 dark:text-indigo-400 dark:hover:text-indigo-300"
								>
									Voir le concours
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
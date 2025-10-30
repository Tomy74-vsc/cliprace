"use client";
import { useState, useEffect } from "react";
import { getBrowserSupabase } from "@/lib/supabase/client";
import { motion } from "framer-motion";
import { Trophy, Calendar, ArrowRight, MessageSquare } from "lucide-react";
import Link from "next/link";
import { QuickStats } from "@/components/creator/QuickStats";

type Contest = {
	id: string;
	title: string;
	status: string;
	ends_at: string | null;
};

export default function CreatorDashboard() {
	const supabase = getBrowserSupabase();
	const [activeContests, setActiveContests] = useState<Contest[]>([]);
	const [loading, setLoading] = useState(true);
	const [userProfile, setUserProfile] = useState<{
		name?: string;
		handle?: string;
		bio?: string;
		social_media?: Record<string, string>;
	} | null>(null);

	useEffect(() => {
		async function loadData() {
			const { data: { user } } = await supabase.auth.getUser();
			if (!user) return;

			// Charger le profil utilisateur
			const [mainProfile, creatorProfile] = await Promise.all([
				supabase.from("profiles").select("*").eq("id", user.id).single(),
				supabase.from("profiles_creator").select("*").eq("user_id", user.id).single()
			]);

			const combinedProfile = {
				...mainProfile.data,
				...creatorProfile.data,
				name: mainProfile.data?.name || creatorProfile.data?.handle || "Créateur",
				handle: creatorProfile.data?.handle || "",
				bio: creatorProfile.data?.bio || "",
				social_media: creatorProfile.data?.social_media || {},
			};
			setUserProfile(combinedProfile);

			// Charger les données du dashboard
			const contestsRes = await supabase.from("contests").select("id,title,status,ends_at").eq("status", "active").order("ends_at", { ascending: true }).limit(6);

			setActiveContests((contestsRes.data ?? []) as Contest[]);
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
					Bienvenue, {userProfile?.name || "Créateur"} !
				</h1>
				<p className="mt-2 text-zinc-600 dark:text-zinc-400">
					{userProfile?.bio || "Suivez vos performances et découvrez de nouveaux concours"}
				</p>
				{userProfile?.handle && (
					<div className="mt-3 inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-indigo-50 to-violet-50 px-4 py-2 text-sm font-medium text-indigo-700 dark:from-indigo-950 dark:to-violet-950 dark:text-indigo-300">
						<span className="h-2 w-2 rounded-full bg-green-500"></span>
						@{userProfile.handle}
					</div>
				)}
			</motion.div>

			{/* Quick Stats Component */}
			<QuickStats />

			{/* Messaging Quick Access */}
			<motion.div
				initial={{ opacity: 0, y: 20 }}
				animate={{ opacity: 1, y: 0 }}
				transition={{ duration: 0.5, delay: 0.3 }}
				className="rounded-2xl border border-zinc-200 bg-gradient-to-r from-indigo-50 to-violet-50 p-6 shadow-sm dark:border-zinc-800 dark:from-indigo-950 dark:to-violet-950"
			>
				<div className="flex items-center justify-between">
					<div className="flex items-center gap-4">
						<div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 to-violet-500 shadow-lg">
							<MessageSquare className="h-6 w-6 text-white" />
						</div>
						<div>
							<h3 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">Messagerie</h3>
							<p className="text-sm text-zinc-600 dark:text-zinc-400">
								Communiquez directement avec les marques
							</p>
						</div>
					</div>
					<Link
						href="/creator/messages"
						className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition-all duration-200 hover:shadow-md hover:scale-105"
					>
						Ouvrir la messagerie
						<ArrowRight className="h-4 w-4" />
					</Link>
				</div>
			</motion.div>

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
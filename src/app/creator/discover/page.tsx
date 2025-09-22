"use client";
import { useState, useEffect } from "react";
import { getBrowserSupabase } from "@/lib/supabase/client";
import { motion } from "framer-motion";
import { Calendar, Euro, Users, Filter, ArrowRight, Trophy } from "lucide-react";
import Link from "next/link";

type Contest = {
	id: string;
	title: string;
	status: string;
	total_prize_cents: number | null;
	ends_at: string | null;
	brand_id: string;
};

export default function DiscoverContests() {
	const supabase = getBrowserSupabase();
	const [contests, setContests] = useState<Contest[]>([]);
	const [loading, setLoading] = useState(true);

	useEffect(() => {
		async function loadContests() {
			const { data } = await supabase
				.from("contests")
				.select("id,title,status,total_prize_cents,ends_at,brand_id")
				.eq("status", "active")
				.order("created_at", { ascending: false });

			setContests(data ?? []);
			setLoading(false);
		}
		loadContests();
	}, [supabase]);

	if (loading) {
		return (
			<div className="space-y-8">
				<div className="animate-pulse space-y-4">
					<div className="h-8 w-64 bg-zinc-200 dark:bg-zinc-800 rounded mx-auto"></div>
					<div className="h-4 w-96 bg-zinc-200 dark:bg-zinc-800 rounded mx-auto"></div>
					<div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
						{[...Array(6)].map((_, i) => (
							<div key={i} className="h-80 bg-zinc-200 dark:bg-zinc-800 rounded-2xl"></div>
						))}
					</div>
				</div>
			</div>
		);
	}

	return (
		<div className="space-y-8">
			{/* Header */}
			<motion.div
				initial={{ opacity: 0, y: 20 }}
				animate={{ opacity: 1, y: 0 }}
				transition={{ duration: 0.5 }}
				className="text-center"
			>
				<h1 className="text-3xl font-bold bg-gradient-to-r from-indigo-600 to-violet-600 bg-clip-text text-transparent">
					Découvrir les concours
				</h1>
				<p className="mt-2 text-zinc-600 dark:text-zinc-400">
					Participez aux concours et gagnez des récompenses
				</p>
			</motion.div>

			{/* Filters */}
			<motion.div
				initial={{ opacity: 0, y: 20 }}
				animate={{ opacity: 1, y: 0 }}
				transition={{ duration: 0.5, delay: 0.1 }}
				className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between"
			>
				<div className="flex items-center gap-2">
					<Filter className="h-5 w-5 text-zinc-500" />
					<span className="text-sm font-medium text-zinc-700 dark:text-zinc-300">Filtres</span>
				</div>
				<div className="flex flex-wrap gap-2">
					<select 
						aria-label="Trier par"
						className="h-10 rounded-xl border border-zinc-200 bg-white px-3 text-sm focus:border-indigo-300 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 dark:border-zinc-700 dark:bg-zinc-800"
					>
						<option>Popularité</option>
						<option>Date de fin</option>
						<option>Gains</option>
					</select>
					<select 
						aria-label="Filtrer par statut"
						className="h-10 rounded-xl border border-zinc-200 bg-white px-3 text-sm focus:border-indigo-300 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 dark:border-zinc-700 dark:bg-zinc-800"
					>
						<option>Tous les concours</option>
						<option>Ouverts</option>
						<option>Bientôt fermés</option>
					</select>
				</div>
			</motion.div>

			{/* Contests Grid */}
			{contests.length === 0 ? (
				<motion.div
					initial={{ opacity: 0, y: 20 }}
					animate={{ opacity: 1, y: 0 }}
					transition={{ duration: 0.5, delay: 0.2 }}
					className="rounded-2xl border border-zinc-200 bg-zinc-50/50 p-8 text-center dark:border-zinc-800 dark:bg-zinc-900/50"
				>
					<Trophy className="mx-auto h-12 w-12 text-zinc-400" />
					<h3 className="mt-4 text-lg font-semibold text-zinc-900 dark:text-zinc-100">Aucun concours disponible</h3>
					<p className="mt-2 text-zinc-600 dark:text-zinc-400">Revenez plus tard pour découvrir de nouveaux concours</p>
				</motion.div>
			) : (
				<div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
					{contests.map((contest, index) => (
						<motion.div
							key={contest.id}
							initial={{ opacity: 0, y: 20 }}
							animate={{ opacity: 1, y: 0 }}
							transition={{ duration: 0.5, delay: 0.2 + index * 0.1 }}
							whileHover={{ scale: 1.02, y: -4 }}
							className="group relative overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm transition-all duration-300 hover:shadow-xl dark:border-zinc-800 dark:bg-zinc-900"
						>
							{/* Contest Header */}
							<div className="relative h-32 bg-gradient-to-br from-indigo-500 to-violet-600 p-6">
								<div className="absolute inset-0 bg-black/20" />
								<div className="relative flex h-full flex-col justify-between">
									<div className="flex items-start justify-between">
										<div className="flex h-10 w-10 items-center justify-center rounded-full bg-white/20 backdrop-blur-sm">
											<Trophy className="h-5 w-5 text-white" />
										</div>
										<div className="rounded-full bg-green-500 px-3 py-1 text-xs font-medium text-white">
											Ouvert
										</div>
									</div>
									<div>
										<h3 className="text-lg font-semibold text-white">{contest.title}</h3>
									</div>
								</div>
							</div>

							{/* Contest Content */}
							<div className="p-6">
								<div className="space-y-4">
									{/* Prize */}
									<div className="flex items-center gap-3">
										<div className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-100 dark:bg-amber-900">
											<Euro className="h-4 w-4 text-amber-600 dark:text-amber-400" />
										</div>
										<div>
											<p className="text-sm text-zinc-500">Récompense totale</p>
											<p className="font-semibold text-amber-600 dark:text-amber-400">
												€{((contest.total_prize_cents ?? 0) / 100).toFixed(0)}
											</p>
										</div>
									</div>

									{/* End Date */}
									<div className="flex items-center gap-3">
										<div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-100 dark:bg-blue-900">
											<Calendar className="h-4 w-4 text-blue-600 dark:text-blue-400" />
										</div>
										<div>
											<p className="text-sm text-zinc-500">Date de fin</p>
											<p className="font-medium text-zinc-900 dark:text-zinc-100">
												{contest.ends_at ? new Date(String(contest.ends_at)).toLocaleDateString() : "—"}
											</p>
										</div>
									</div>

									{/* Participants */}
									<div className="flex items-center gap-3">
										<div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-100 dark:bg-emerald-900">
											<Users className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
										</div>
										<div>
											<p className="text-sm text-zinc-500">Participants</p>
											<p className="font-medium text-zinc-900 dark:text-zinc-100">
												{Math.floor(Math.random() * 50) + 10} créateurs
											</p>
										</div>
									</div>
								</div>

								{/* Action Button */}
								<Link
									href={`/creator/contests/${contest.id}`}
									className="mt-6 flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 py-3 text-sm font-medium text-white shadow-sm transition-all duration-200 hover:shadow-md group-hover:scale-105"
								>
									Voir le concours
									<ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
								</Link>
							</div>
						</motion.div>
					))}
				</div>
			)}
		</div>
	);
}
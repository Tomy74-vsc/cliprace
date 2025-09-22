"use client";
import { useState, useEffect } from "react";
import { getBrowserSupabase } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { motion } from "framer-motion";
import Link from "next/link";
import { Calendar, Trophy, Users, Euro } from "lucide-react";

type Contest = {
	id: string;
	title: string;
	description: string;
	total_prize_cents: number;
	ends_at: string | null;
	created_at: string;
	brand_id: string;
	status: string;
};

type LeaderboardEntry = {
	rank: number;
	creator_id: string;
	views_weighted: number;
	prize_cents: number;
	submission_id: string;
};

export default function ContestDetailPage({ params }: { params: { id: string } }) {
	const supabase = getBrowserSupabase();
	const [contest, setContest] = useState<Contest | null>(null);
	const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
	const [userSubmission, setUserSubmission] = useState<{ id: string; status: string } | null>(null);
	const [loading, setLoading] = useState(true);

	useEffect(() => {
		async function loadData() {
			const { data: { user } } = await supabase.auth.getUser();
			if (!user) {
				setLoading(false);
				return;
			}

			const [contestRes, leaderboardRes, userSubmissionRes] = await Promise.all([
				supabase.from("contests").select("*").eq("id", params.id).single(),
				supabase.from("leaderboards").select("rank,creator_id,views_weighted,prize_cents,submission_id").eq("contest_id", params.id).order("rank", { ascending: true }).limit(10),
				supabase.from("submissions").select("id,status").eq("contest_id", params.id).eq("creator_id", user.id).single(),
			]);

			setContest(contestRes.data as Contest | null);
			setLeaderboard((leaderboardRes.data ?? []) as LeaderboardEntry[]);
			setUserSubmission(userSubmissionRes.data);
			setLoading(false);
		}
		loadData();
	}, [supabase, params.id]);

	if (loading) {
		return (
			<div className="space-y-6">
				<div className="animate-pulse space-y-4">
					<div className="h-32 bg-zinc-200 dark:bg-zinc-800 rounded-2xl"></div>
					<div className="h-12 bg-zinc-200 dark:bg-zinc-800 rounded-2xl"></div>
					<div className="h-64 bg-zinc-200 dark:bg-zinc-800 rounded-2xl"></div>
				</div>
			</div>
		);
	}

	if (!contest) {
		return (
			<div className="space-y-6">
				<div className="text-center">
					<h1 className="text-2xl font-bold">Concours introuvable</h1>
					<p className="mt-2 text-zinc-600 dark:text-zinc-400">Ce concours n&apos;existe pas ou a été supprimé.</p>
					<Link href="/creator/discover" className="mt-4 inline-block">
						<Button>Retour aux concours</Button>
					</Link>
				</div>
			</div>
		);
	}

	const canParticipate = contest.status === "active" && !userSubmission;
	const hasParticipated = !!userSubmission;

	return (
		<div className="space-y-6">
			{/* Header */}
			<motion.div 
				initial={{ opacity: 0, y: 20 }}
				animate={{ opacity: 1, y: 0 }}
				transition={{ duration: 0.5 }}
				className="rounded-2xl border border-zinc-200 bg-gradient-to-r from-indigo-50 to-violet-50 p-6 dark:border-zinc-800 dark:from-indigo-950 dark:to-violet-950"
			>
				<h1 className="text-3xl font-bold">{contest.title}</h1>
				<p className="mt-2 text-zinc-600 dark:text-zinc-400">{contest.description}</p>
				<div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-3">
					<div className="flex items-center gap-2">
						<Euro className="h-5 w-5 text-indigo-600" />
						<span className="text-sm font-medium">Prix total: €{(contest.total_prize_cents / 100).toFixed(0)}</span>
					</div>
					<div className="flex items-center gap-2">
						<Calendar className="h-5 w-5 text-indigo-600" />
						<span className="text-sm font-medium">Fin: {contest.ends_at ? new Date(contest.ends_at).toLocaleDateString() : "—"}</span>
					</div>
					<div className="flex items-center gap-2">
						<Users className="h-5 w-5 text-indigo-600" />
						<span className="text-sm font-medium">{leaderboard.length} participants</span>
					</div>
				</div>
			</motion.div>

			{/* Actions */}
			<motion.div 
				initial={{ opacity: 0, y: 20 }}
				animate={{ opacity: 1, y: 0 }}
				transition={{ duration: 0.5, delay: 0.1 }}
				className="flex flex-col gap-3 sm:flex-row"
			>
				{canParticipate && (
					<Link href={`/creator/participate/${contest.id}`} className="flex-1">
						<Button className="w-full">Participer au concours</Button>
					</Link>
				)}
				{hasParticipated && (
					<div className="flex-1">
						<Button variant="outline" className="w-full" disabled>
							{userSubmission?.status === "pending" ? "Participation en attente" : 
							 userSubmission?.status === "approved" ? "Participation approuvée" : 
							 "Participation rejetée"}
						</Button>
					</div>
				)}
				<Link href="/creator/discover">
					<Button variant="outline">Retour aux concours</Button>
				</Link>
			</motion.div>

			{/* Leaderboard */}
			{leaderboard.length > 0 && (
				<motion.div 
					initial={{ opacity: 0, y: 20 }}
					animate={{ opacity: 1, y: 0 }}
					transition={{ duration: 0.5, delay: 0.2 }}
					className="rounded-2xl border border-zinc-200 p-6 dark:border-zinc-800"
				>
					<div className="mb-4 flex items-center gap-2">
						<Trophy className="h-5 w-5 text-yellow-500" />
						<h2 className="text-lg font-semibold">Classement</h2>
					</div>
					<div className="space-y-2">
						{leaderboard.map((entry, index) => (
							<motion.div 
								key={entry.rank}
								initial={{ opacity: 0, x: -20 }}
								animate={{ opacity: 1, x: 0 }}
								transition={{ duration: 0.3, delay: 0.3 + index * 0.1 }}
								className="flex items-center justify-between rounded-lg border border-zinc-100 p-3 dark:border-zinc-700"
							>
								<div className="flex items-center gap-3">
									<div className="flex h-8 w-8 items-center justify-center rounded-full bg-indigo-100 text-sm font-semibold text-indigo-600 dark:bg-indigo-900">
										{entry.rank}
									</div>
									<div>
										<div className="text-sm font-medium">Créateur #{entry.creator_id.slice(0, 8)}</div>
										<div className="text-xs text-zinc-500">{entry.views_weighted.toLocaleString()} vues</div>
									</div>
								</div>
								<div className="text-sm font-semibold text-green-600">€{(entry.prize_cents / 100).toFixed(2)}</div>
							</motion.div>
						))}
					</div>
				</motion.div>
			)}
		</div>
	);
}

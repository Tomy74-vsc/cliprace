"use client";
import { useState, useEffect } from "react";
import { getBrowserSupabase } from "@/lib/supabase/client";
import { motion } from "framer-motion";
import { ExternalLink, Eye, Heart, MessageCircle, Share, Trash2, Calendar, Trophy, ArrowRight } from "lucide-react";
import Link from "next/link";
import Image from "next/image";

type Submission = {
	id: string;
	contest_id: string;
	network: string;
	video_url: string;
	title: string | null;
	description: string | null;
	thumbnail_url: string | null;
	status: string;
	created_at: string;
	contest: {
		title: string;
		status: string;
	};
	metrics: {
		views: number;
		likes: number;
		comments: number;
		shares: number;
	} | null;
};

export default function MySubmissions() {
	const supabase = getBrowserSupabase();
	const [submissions, setSubmissions] = useState<Submission[]>([]);
	const [loading, setLoading] = useState(true);
	const [user, setUser] = useState<{ id: string } | null>(null);

	useEffect(() => {
		async function loadData() {
	const { data: { user } } = await supabase.auth.getUser();
			if (!user) {
				setLoading(false);
				return;
			}
			setUser(user);
			
	const { data } = await supabase
		.from("submissions")
				.select(`
					id,contest_id,network,video_url,title,description,thumbnail_url,status,created_at,
					contest:contests(title,status),
					metrics_daily(views,likes,comments,shares)
				`)
		.eq("creator_id", user.id)
		.order("created_at", { ascending: false });

			// eslint-disable-next-line @typescript-eslint/no-explicit-any
			const formattedSubmissions = (data ?? []).map((s: any) => ({
				...s,
				metrics: s.metrics_daily?.[0] ? {
					views: s.metrics_daily[0].views || 0,
					likes: s.metrics_daily[0].likes || 0,
					comments: s.metrics_daily[0].comments || 0,
					shares: s.metrics_daily[0].shares || 0,
				} : null
			})) as Submission[];

			setSubmissions(formattedSubmissions);
			setLoading(false);
		}
		loadData();
	}, [supabase]);

	if (loading) {
	return (
			<div className="space-y-8">
				<div className="animate-pulse space-y-4">
					<div className="h-8 w-64 bg-zinc-200 dark:bg-zinc-800 rounded"></div>
					<div className="space-y-6">
						{[...Array(3)].map((_, i) => (
							<div key={i} className="h-48 bg-zinc-200 dark:bg-zinc-800 rounded-2xl"></div>
						))}
					</div>
				</div>
		</div>
	);
}

	if (!user) {
		return <div className="mx-auto max-w-4xl px-6 py-12">Veuillez vous connecter.</div>;
	}

	const getStatusConfig = (status: string) => {
		switch (status) {
			case "approved":
				return {
					label: "Approuvé",
					className: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
					icon: "✓"
				};
			case "rejected":
				return {
					label: "Rejeté",
					className: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
					icon: "✗"
				};
			default:
				return {
					label: "En attente",
					className: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200",
					icon: "⏳"
				};
		}
	};

	return (
		<div className="space-y-8">
			{/* Header */}
			<motion.div
				initial={{ opacity: 0, y: 20 }}
				animate={{ opacity: 1, y: 0 }}
				transition={{ duration: 0.5 }}
				className="flex flex-col items-center justify-between gap-4 sm:flex-row"
			>
				<div>
					<h1 className="text-3xl font-bold bg-gradient-to-r from-indigo-600 to-violet-600 bg-clip-text text-transparent">
						Mes participations
					</h1>
					<p className="mt-2 text-zinc-600 dark:text-zinc-400">
						Suivez vos soumissions et leurs performances
					</p>
				</div>
				<Link
					href="/creator/discover"
					className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 px-6 py-3 text-sm font-medium text-white shadow-sm transition-all duration-200 hover:shadow-md hover:scale-105"
				>
					<Trophy className="h-4 w-4" />
					Découvrir des concours
					<ArrowRight className="h-4 w-4" />
				</Link>
			</motion.div>

			{/* Submissions List */}
			{submissions.length === 0 ? (
				<motion.div
					initial={{ opacity: 0, y: 20 }}
					animate={{ opacity: 1, y: 0 }}
					transition={{ duration: 0.5, delay: 0.1 }}
					className="rounded-2xl border border-zinc-200 bg-zinc-50/50 p-8 text-center dark:border-zinc-800 dark:bg-zinc-900/50"
				>
					<Trophy className="mx-auto h-12 w-12 text-zinc-400" />
					<h2 className="mt-4 text-lg font-semibold text-zinc-900 dark:text-zinc-100">Aucune participation</h2>
					<p className="mt-2 text-zinc-600 dark:text-zinc-400">Vous n&apos;avez pas encore participé à un concours.</p>
					<Link
						href="/creator/discover"
						className="mt-4 inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 px-6 py-3 text-sm font-medium text-white shadow-sm transition-all duration-200 hover:shadow-md"
					>
						<Trophy className="h-4 w-4" />
						Découvrir les concours
						<ArrowRight className="h-4 w-4" />
					</Link>
				</motion.div>
			) : (
				<div className="space-y-6">
					{submissions.map((submission, index) => {
						const statusConfig = getStatusConfig(submission.status);
						return (
							<motion.div
								key={submission.id}
								initial={{ opacity: 0, y: 20 }}
								animate={{ opacity: 1, y: 0 }}
								transition={{ duration: 0.5, delay: 0.1 + index * 0.1 }}
								whileHover={{ scale: 1.01, y: -2 }}
								className="group overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm transition-all duration-300 hover:shadow-lg dark:border-zinc-800 dark:bg-zinc-900"
							>
								<div className="p-6">
									<div className="flex flex-col gap-6 lg:flex-row">
										{/* Thumbnail */}
										{submission.thumbnail_url && (
											<div className="flex-shrink-0">
												<div className="relative h-32 w-32 overflow-hidden rounded-xl">
													<Image
														src={submission.thumbnail_url}
														alt="Miniature"
														fill
														className="object-cover transition-transform duration-300 group-hover:scale-105"
													/>
												</div>
											</div>
										)}

										{/* Content */}
										<div className="flex-1">
											<div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
												<div className="flex-1">
													<h3 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
														{submission.title || "Sans titre"}
													</h3>
													<p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
														Concours: {submission.contest.title}
													</p>
													
													{submission.description && (
														<p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400 line-clamp-2">
															{submission.description}
														</p>
													)}

													{/* Status and Meta */}
													<div className="mt-3 flex flex-wrap items-center gap-3">
														<span className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-semibold ${statusConfig.className}`}>
															<span>{statusConfig.icon}</span>
															{statusConfig.label}
														</span>
														<div className="flex items-center gap-1 text-xs text-zinc-500">
															<Calendar className="h-3 w-3" />
															<span>{new Date(submission.created_at).toLocaleDateString()}</span>
														</div>
														<span className="text-xs text-zinc-500 capitalize">
															{submission.network}
														</span>
													</div>

													{/* Metrics */}
													{submission.metrics && (
														<div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-4">
															<div className="flex items-center gap-2 rounded-lg bg-zinc-50 p-3 dark:bg-zinc-800">
																<Eye className="h-4 w-4 text-blue-500" />
																<div>
																	<p className="text-xs text-zinc-500">Vues</p>
																	<p className="font-semibold text-zinc-900 dark:text-zinc-100">
																		{submission.metrics.views.toLocaleString()}
																	</p>
																</div>
															</div>
															<div className="flex items-center gap-2 rounded-lg bg-zinc-50 p-3 dark:bg-zinc-800">
																<Heart className="h-4 w-4 text-red-500" />
																<div>
																	<p className="text-xs text-zinc-500">Likes</p>
																	<p className="font-semibold text-zinc-900 dark:text-zinc-100">
																		{submission.metrics.likes.toLocaleString()}
																	</p>
																</div>
															</div>
															<div className="flex items-center gap-2 rounded-lg bg-zinc-50 p-3 dark:bg-zinc-800">
																<MessageCircle className="h-4 w-4 text-green-500" />
																<div>
																	<p className="text-xs text-zinc-500">Commentaires</p>
																	<p className="font-semibold text-zinc-900 dark:text-zinc-100">
																		{submission.metrics.comments.toLocaleString()}
																	</p>
																</div>
															</div>
															<div className="flex items-center gap-2 rounded-lg bg-zinc-50 p-3 dark:bg-zinc-800">
																<Share className="h-4 w-4 text-purple-500" />
																<div>
																	<p className="text-xs text-zinc-500">Partages</p>
																	<p className="font-semibold text-zinc-900 dark:text-zinc-100">
																		{submission.metrics.shares.toLocaleString()}
																	</p>
																</div>
															</div>
														</div>
													)}
												</div>

												{/* Actions */}
												<div className="flex flex-col gap-2 sm:flex-row lg:flex-col">
													<a
														href={submission.video_url}
														target="_blank"
														rel="noopener noreferrer"
														className="inline-flex items-center justify-center gap-2 rounded-xl border border-zinc-200 bg-white px-4 py-2 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700"
													>
														<ExternalLink className="h-4 w-4" />
														Voir la vidéo
													</a>
													{submission.status === "pending" && (
														<button className="inline-flex items-center justify-center gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-2 text-sm font-medium text-red-700 transition-colors hover:bg-red-100 dark:border-red-800 dark:bg-red-950 dark:text-red-400 dark:hover:bg-red-900">
															<Trash2 className="h-4 w-4" />
															Supprimer
														</button>
													)}
												</div>
											</div>
										</div>
									</div>
								</div>
							</motion.div>
						);
					})}
				</div>
			)}
		</div>
	);
}
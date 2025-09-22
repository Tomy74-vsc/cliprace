"use client";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { getBrowserSupabase } from "@/lib/supabase/client";
import { detectNetworkFromUrl } from "@/services/metrics";
import { motion } from "framer-motion";
import Link from "next/link";
import { ArrowLeft, Upload, Link as LinkIcon } from "lucide-react";

export default function ParticipatePage({ params }: { params: { id: string } }) {
	const supabase = getBrowserSupabase();
	const [videoUrl, setVideoUrl] = useState("");
	const [title, setTitle] = useState("");
	const [description, setDescription] = useState("");
	const [thumbnail, setThumbnail] = useState<File | null>(null);
	const [loading, setLoading] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [success, setSuccess] = useState(false);

	async function onSubmit(e: React.FormEvent) {
		e.preventDefault();
		setError(null);
		setLoading(true);

		// Validate URL
		const network = detectNetworkFromUrl(videoUrl);
		if (!network) {
			setError("URL invalide. Veuillez fournir un lien TikTok, Instagram ou YouTube.");
			setLoading(false);
			return;
		}

		try {
			const { data: { user } } = await supabase.auth.getUser();
			if (!user) {
				setError("Vous devez être connecté pour participer.");
				setLoading(false);
				return;
			}

			// Upload thumbnail if provided
			let thumbnailUrl = null;
			if (thumbnail) {
				const fileExt = thumbnail.name.split('.').pop();
				const fileName = `${user.id}/${params.id}/${Date.now()}.${fileExt}`;
				const { error: uploadError } = await supabase.storage
					.from('thumbnails')
					.upload(fileName, thumbnail);
				
				if (uploadError) {
					setError("Erreur lors de l&apos;upload de la miniature.");
					setLoading(false);
					return;
				}
				
				const { data: { publicUrl } } = supabase.storage
					.from('thumbnails')
					.getPublicUrl(fileName);
				thumbnailUrl = publicUrl;
			}

			// Submit participation
			const { error: submitError } = await supabase.from("submissions").insert({
				contest_id: params.id,
				creator_id: user.id,
				video_url: videoUrl,
				title: title || null,
				description: description || null,
				thumbnail_url: thumbnailUrl,
				network,
				status: "pending",
			});

			if (submitError) {
				setError(submitError.message);
				setLoading(false);
				return;
			}

			setSuccess(true);
			setTimeout(() => {
				window.location.href = "/creator/submissions";
			}, 2000);
		} catch {
			setError("Une erreur inattendue s&apos;est produite.");
		}
		setLoading(false);
	}

	if (success) {
		return (
			<div className="space-y-6">
				<motion.div 
					initial={{ opacity: 0, y: 12 }} 
					animate={{ opacity: 1, y: 0 }} 
					className="rounded-2xl border border-green-200 bg-green-50 p-6 text-center dark:border-green-800 dark:bg-green-950"
				>
					<h1 className="text-2xl font-bold text-green-800 dark:text-green-200">Participation soumise !</h1>
					<p className="mt-2 text-green-600 dark:text-green-400">Votre vidéo a été soumise avec succès. Elle sera examinée par notre équipe.</p>
					<Link href="/creator/submissions" className="mt-4 inline-block">
						<Button>Voir mes participations</Button>
					</Link>
				</motion.div>
			</div>
		);
	}

	return (
		<div className="space-y-6">
			<div className="flex items-center gap-3">
				<Link href={`/creator/contests/${params.id}`}>
					<Button variant="outline" size="sm">
						<ArrowLeft className="h-4 w-4" />
					</Button>
				</Link>
				<h1 className="text-2xl font-bold">Participer au concours</h1>
			</div>

			<motion.div 
				initial={{ opacity: 0, y: 12 }} 
				animate={{ opacity: 1, y: 0 }} 
				className="rounded-2xl border border-zinc-200 p-6 dark:border-zinc-800"
			>
				<form onSubmit={onSubmit} className="space-y-6">
					<div>
						<label className="mb-2 block text-sm font-medium text-zinc-700 dark:text-zinc-200">
							<LinkIcon className="mr-2 inline h-4 w-4" />
							URL de la vidéo *
						</label>
						<Input
							type="url"
							placeholder="https://www.tiktok.com/@user/video/..."
							value={videoUrl}
							onChange={(e) => setVideoUrl(e.target.value)}
							required
						/>
						<p className="mt-1 text-xs text-zinc-500">TikTok, Instagram Reels ou YouTube Shorts</p>
					</div>

					<div>
						<label className="mb-2 block text-sm font-medium text-zinc-700 dark:text-zinc-200">
							Titre de votre participation
						</label>
						<Input
							placeholder="Titre accrocheur..."
							value={title}
							onChange={(e) => setTitle(e.target.value)}
						/>
					</div>

					<div>
						<label className="mb-2 block text-sm font-medium text-zinc-700 dark:text-zinc-200">
							Description
						</label>
						<textarea
							className="flex min-h-[100px] w-full rounded-xl border border-zinc-300 bg-white px-3 py-2 text-sm placeholder:text-zinc-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 disabled:cursor-not-allowed disabled:opacity-60 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
							placeholder="Décrivez votre vidéo, votre inspiration..."
							value={description}
							onChange={(e) => setDescription(e.target.value)}
						/>
					</div>

					<div>
						<label className="mb-2 block text-sm font-medium text-zinc-700 dark:text-zinc-200">
							<Upload className="mr-2 inline h-4 w-4" />
							Miniature (optionnel)
						</label>
						<input
							type="file"
							accept="image/*"
							onChange={(e) => setThumbnail(e.target.files?.[0] || null)}
							aria-label="Sélectionner une miniature"
							className="block w-full text-sm text-zinc-500 file:mr-4 file:rounded-lg file:border-0 file:bg-indigo-50 file:px-4 file:py-2 file:text-sm file:font-semibold file:text-indigo-700 hover:file:bg-indigo-100 dark:file:bg-indigo-900 dark:file:text-indigo-300"
						/>
						<p className="mt-1 text-xs text-zinc-500">JPG, PNG ou GIF (max 5MB)</p>
					</div>

					{error && (
						<div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-600 dark:border-red-800 dark:bg-red-950">
							{error}
						</div>
					)}

					<div className="flex gap-3">
						<Button type="submit" disabled={loading} className="flex-1">
							{loading ? "Soumission..." : "Soumettre ma participation"}
						</Button>
						<Link href={`/creator/contests/${params.id}`}>
							<Button type="button" variant="outline">Annuler</Button>
						</Link>
					</div>
				</form>
			</motion.div>
		</div>
	);
}

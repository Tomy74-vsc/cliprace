"use client";
import { useState, useEffect } from "react";
import { getBrowserSupabase } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { motion } from "framer-motion";
import { User, Mail, Lock, Instagram, Youtube, Twitter, Camera, Save, Trash2 } from "lucide-react";
import Link from "next/link";
import Image from "next/image";

type Profile = {
	id: string;
	email: string;
	full_name: string | null;
	avatar_url: string | null;
	bio: string | null;
	handle?: string;
	tiktok_handle: string | null;
	instagram_handle: string | null;
	youtube_handle: string | null;
	twitter_handle: string | null;
};

export default function CreatorProfile() {
	const supabase = getBrowserSupabase();
	const [profile, setProfile] = useState<Profile | null>(null);
	const [loading, setLoading] = useState(true);
	const [saving, setSaving] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [success, setSuccess] = useState<string | null>(null);
	const [avatar, setAvatar] = useState<File | null>(null);

	const [formData, setFormData] = useState({
		full_name: "",
		bio: "",
		tiktok_handle: "",
		instagram_handle: "",
		youtube_handle: "",
		twitter_handle: "",
	});

	useEffect(() => {
		async function loadProfile() {
			const { data: { user } } = await supabase.auth.getUser();
			if (!user) return;

			// Rcuprer les donnes depuis les deux tables
			const [mainProfile, creatorProfile] = await Promise.all([
				supabase
					.from("profiles")
					.select("*")
					.eq("id", user.id)
					.single(),
				supabase
					.from("profiles_creator")
					.select("*")
					.eq("user_id", user.id)
					.single()
			]);

			// Combiner les donnes des deux tables
			const combinedData = {
				...mainProfile.data,
				...creatorProfile.data,
				// Mapper les champs correctement
				full_name: mainProfile.data?.name || creatorProfile.data?.handle || "",
				bio: creatorProfile.data?.bio || mainProfile.data?.description || "",
				handle: creatorProfile.data?.handle || "",
				country: creatorProfile.data?.country || "FR",
				primary_network: creatorProfile.data?.primary_network || "tiktok",
				social_media: creatorProfile.data?.social_media || {},
			};

			if (combinedData) {
				setProfile(combinedData);
				setFormData({
					full_name: combinedData.full_name || "",
					bio: combinedData.bio || "",
					tiktok_handle: combinedData.social_media?.tiktok || "",
					instagram_handle: combinedData.social_media?.instagram || "",
					youtube_handle: combinedData.social_media?.youtube || "",
					twitter_handle: combinedData.social_media?.twitter || "",
				});
			}
			setLoading(false);
		}
		loadProfile();
	}, [supabase]);

	async function handleSave(e: React.FormEvent) {
		e.preventDefault();
		setError(null);
		setSuccess(null);
		setSaving(true);

		try {
			const { data: { user } } = await supabase.auth.getUser();
			if (!user) {
				setError("Veuillez vous connecter pour continuer");
				return;
		}

			// Upload avatar if provided
			let avatarUrl = profile?.avatar_url;
			if (avatar) {
				const formData = new FormData();
				formData.append("file", avatar);
				const uploadResponse = await fetch("/api/uploads/avatar", {
					method: "POST",
					credentials: "include",
					body: formData,
				});
				const uploadResult = await uploadResponse.json();
				if (!uploadResponse.ok || !uploadResult?.publicUrl) {
					setError(uploadResult?.error ?? "Erreur lors du televersement de l avatar");
					return;
				}
				avatarUrl = uploadResult.publicUrl as string;
			}

		// Mettre a jour les deux tables
			const socialMediaData = {
				tiktok: formData.tiktok_handle || null,
				instagram: formData.instagram_handle || null,
				youtube: formData.youtube_handle || null,
				twitter: formData.twitter_handle || null,
			};

			// Mettre a jour le profil principal
			const { error: mainUpdateError } = await supabase
				.from("profiles")
				.upsert({
					id: user.id,
					email: user.email,
					name: formData.full_name || null,
					description: formData.bio || null,
					profile_image_url: avatarUrl,
					updated_at: new Date().toISOString(),
				});

			if (mainUpdateError) {
				setError(`Erreur profil principal: ${mainUpdateError.message}`);
				return;
			}

			// Mettre a jour le profil crateur
			const { error: creatorUpdateError } = await supabase
				.from("profiles_creator")
				.upsert({
					user_id: user.id,
					handle: profile?.handle || `creator_${user.id.slice(0, 8)}`,
					bio: formData.bio || null,
					social_media: socialMediaData,
					updated_at: new Date().toISOString(),
				});

			if (creatorUpdateError) {
				setError(`Erreur profil crateur: ${creatorUpdateError.message}`);
				return;
			}

			setSuccess("Profil mis  jour avec succs");
			setAvatar(null);
		} catch {
			setError("Une erreur inattendue s&apos;est produite");
		}
		setSaving(false);
	}

	async function handleDeleteAccount() {
		if (!confirm("Etes-vous sur de vouloir supprimer votre compte ? Cette action est irreversible.")) {
			return;
		}
		
		setError(null);
		setSaving(true);
		
		try {
			const { error } = await supabase.auth.signOut();
			if (error) {
				setError(error.message);
				return;
			}
			
			// Redirect to home
			window.location.href = "/";
		} catch {
			setError("Erreur lors de la suppression du compte");
		}
		setSaving(false);
	}

	if (loading) {
		return (
			<div className="space-y-6">
				<h1 className="text-2xl font-bold">Profil</h1>
				<div className="animate-pulse space-y-4">
					<div className="h-64 rounded-2xl bg-zinc-200 dark:bg-zinc-800"></div>
					<div className="h-96 rounded-2xl bg-zinc-200 dark:bg-zinc-800"></div>
				</div>
			</div>
		);
	}

	return (
		<div className="space-y-6">
			<h1 className="text-2xl font-bold">Profil</h1>

			{/* Avatar Section */}
			<motion.div 
				initial={{ opacity: 0, y: 12 }} 
				animate={{ opacity: 1, y: 0 }} 
				className="rounded-2xl border border-zinc-200 p-6 dark:border-zinc-800"
			>
				<div className="flex items-center gap-6">
					<div className="relative">
						{profile?.avatar_url ? (
							<Image
								src={profile.avatar_url}
								alt="Avatar"
								width={80}
								height={80}
								className="h-20 w-20 rounded-full object-cover"
							/>
						) : (
							<div className="flex h-20 w-20 items-center justify-center rounded-full bg-indigo-100 dark:bg-indigo-900">
								<User className="h-10 w-10 text-indigo-600" />
							</div>
						)}
						<label className="absolute -bottom-1 -right-1 flex h-8 w-8 cursor-pointer items-center justify-center rounded-full bg-indigo-600 text-white hover:bg-indigo-700">
							<Camera className="h-4 w-4" />
							<input
								type="file"
								accept="image/*"
								onChange={(e) => setAvatar(e.target.files?.[0] || null)}
								className="hidden"
								aria-label="Changer l&apos;avatar"
							/>
						</label>
					</div>
					<div>
						<h2 className="text-xl font-semibold">{profile?.full_name || "Utilisateur"}</h2>
						<p className="text-zinc-600 dark:text-zinc-400">{profile?.email}</p>
						{avatar && (
							<p className="text-sm text-indigo-600">Nouvelle photo slectionne</p>
						)}
					</div>
				</div>
			</motion.div>

			{/* Profile Form */}
			<motion.form 
				initial={{ opacity: 0, y: 12 }} 
				animate={{ opacity: 1, y: 0 }} 
				transition={{ delay: 0.1 }}
				onSubmit={handleSave}
				className="space-y-6"
			>
				<div className="rounded-2xl border border-zinc-200 p-6 dark:border-zinc-800">
					<h3 className="mb-4 text-lg font-semibold">Informations personnelles</h3>
					<div className="grid gap-4 md:grid-cols-2">
						<div>
							<label className="mb-2 block text-sm font-medium text-zinc-700 dark:text-zinc-200">
								Nom complet
							</label>
							<Input
								value={formData.full_name}
								onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
								placeholder="Votre nom complet"
							/>
						</div>
						<div>
							<label className="mb-2 block text-sm font-medium text-zinc-700 dark:text-zinc-200">
								<Mail className="mr-2 inline h-4 w-4" />
								Email (lecture seule)
							</label>
							<Input
								value={profile?.email || ""}
								disabled
								className="bg-zinc-50 dark:bg-zinc-800"
							/>
						</div>
					</div>
					<div className="mt-4">
						<label className="mb-2 block text-sm font-medium text-zinc-700 dark:text-zinc-200">
							Bio
						</label>
						<textarea
							value={formData.bio}
							onChange={(e) => setFormData({ ...formData, bio: e.target.value })}
							placeholder="Parlez-nous de vous..."
							className="flex min-h-[100px] w-full rounded-xl border border-zinc-300 bg-white px-3 py-2 text-sm placeholder:text-zinc-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 disabled:cursor-not-allowed disabled:opacity-60 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
						/>
					</div>
				</div>

				<div className="rounded-2xl border border-zinc-200 p-6 dark:border-zinc-800">
					<h3 className="mb-4 text-lg font-semibold">Rseaux sociaux</h3>
					<div className="grid gap-4 md:grid-cols-2">
						<div>
							<label className="mb-2 block text-sm font-medium text-zinc-700 dark:text-zinc-200">
								<Instagram className="mr-2 inline h-4 w-4" />
								Instagram
							</label>
							<Input
								value={formData.instagram_handle}
								onChange={(e) => setFormData({ ...formData, instagram_handle: e.target.value })}
								placeholder="@votre_handle"
							/>
						</div>
						<div>
							<label className="mb-2 block text-sm font-medium text-zinc-700 dark:text-zinc-200">
								<Youtube className="mr-2 inline h-4 w-4" />
								YouTube
							</label>
							<Input
								value={formData.youtube_handle}
								onChange={(e) => setFormData({ ...formData, youtube_handle: e.target.value })}
								placeholder="@votre_handle"
							/>
						</div>
						<div>
							<label className="mb-2 block text-sm font-medium text-zinc-700 dark:text-zinc-200">
								<Twitter className="mr-2 inline h-4 w-4" />
								Twitter/X
							</label>
							<Input
								value={formData.twitter_handle}
								onChange={(e) => setFormData({ ...formData, twitter_handle: e.target.value })}
								placeholder="@votre_handle"
							/>
						</div>
						<div>
							<label className="mb-2 block text-sm font-medium text-zinc-700 dark:text-zinc-200">
								TikTok
							</label>
							<Input
								value={formData.tiktok_handle}
								onChange={(e) => setFormData({ ...formData, tiktok_handle: e.target.value })}
								placeholder="@votre_handle"
							/>
						</div>
					</div>
				</div>

				{/* Messages */}
				{error && (
					<div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-600 dark:border-red-800 dark:bg-red-950">
						{error}
					</div>
				)}
				{success && (
					<div className="rounded-lg border border-green-200 bg-green-50 p-3 text-sm text-green-600 dark:border-green-800 dark:bg-green-950">
						{success}
					</div>
				)}

				{/* Actions */}
				<div className="flex flex-col gap-3 sm:flex-row">
					<Button type="submit" disabled={saving} className="flex-1">
						<Save className="mr-2 h-4 w-4" />
						{saving ? "Sauvegarde..." : "Mettre  jour"}
					</Button>
					<Link href="/auth/reset-password">
						<Button type="button" variant="outline">
							<Lock className="mr-2 h-4 w-4" />
							Changer le mot de passe
						</Button>
					</Link>
				</div>
			</motion.form>

			{/* Danger Zone */}
			<motion.div 
				initial={{ opacity: 0, y: 12 }} 
				animate={{ opacity: 1, y: 0 }} 
				transition={{ delay: 0.2 }}
				className="rounded-2xl border border-red-200 p-6 dark:border-red-800"
			>
				<h3 className="mb-4 text-lg font-semibold text-red-600">Zone dangereuse</h3>
				<p className="mb-4 text-sm text-zinc-600 dark:text-zinc-400">
					Une fois votre compte supprim, toutes vos donnes seront dfinitivement perdues.
				</p>
				<Button
					variant="outline"
					onClick={handleDeleteAccount}
					disabled={saving}
					className="border-red-300 text-red-600 hover:bg-red-50 dark:border-red-700 dark:text-red-400 dark:hover:bg-red-950"
				>
					<Trash2 className="mr-2 h-4 w-4" />
					Supprimer mon compte
				</Button>
			</motion.div>
		</div>
	);
}


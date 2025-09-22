"use client";
import Link from "next/link";
import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Search, Bell, User, LogOut, Settings, ChevronDown } from "lucide-react";

export function CreatorHeader() {
	const [showUserMenu, setShowUserMenu] = useState(false);
	const [notifications] = useState(3); // Mock notifications count

	return (
		<header className="sticky top-0 z-30 border-b border-zinc-200/50 bg-white/95 backdrop-blur-sm dark:border-zinc-800/50 dark:bg-zinc-900/95">
			<div className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between px-4">
				{/* Logo */}
				<Link href="/creator" className="inline-flex items-center gap-3">
					<div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-indigo-500 to-violet-600">
						<span className="text-sm font-bold text-white">C</span>
					</div>
					<span className="text-lg font-semibold bg-gradient-to-r from-indigo-600 to-violet-600 bg-clip-text text-transparent">
						ClipRace
					</span>
				</Link>

				{/* Search Bar - Hidden on mobile */}
				<div className="hidden md:flex flex-1 max-w-md mx-8">
					<div className="relative w-full">
						<Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
						<input
							type="text"
							placeholder="Rechercher des concours..."
							className="w-full rounded-xl border border-zinc-200 bg-zinc-50/50 py-2 pl-10 pr-4 text-sm placeholder:text-zinc-400 focus:border-indigo-300 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 dark:border-zinc-700 dark:bg-zinc-800/50 dark:focus:border-indigo-600 dark:focus:bg-zinc-800"
						/>
					</div>
				</div>

				{/* Right Actions */}
				<div className="flex items-center gap-2">
					{/* Notifications */}
					<button 
						aria-label="Notifications" 
						className="relative rounded-lg p-2 hover:bg-zinc-100 dark:hover:bg-zinc-800"
					>
						<Bell className="h-5 w-5 text-zinc-600 dark:text-zinc-400" />
						{notifications > 0 && (
							<span className="absolute -top-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-xs font-medium text-white">
								{notifications}
							</span>
						)}
					</button>

					{/* User Menu */}
					<div className="relative">
						<button
							onClick={() => setShowUserMenu(!showUserMenu)}
							aria-label="Menu utilisateur"
							className="flex items-center gap-2 rounded-xl border border-zinc-200 px-3 py-2 hover:bg-zinc-50 dark:border-zinc-700 dark:hover:bg-zinc-800"
						>
							<div className="h-8 w-8 rounded-full bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center">
								<User className="h-4 w-4 text-white" />
							</div>
							<ChevronDown className="h-4 w-4 text-zinc-500" />
						</button>

						<AnimatePresence>
							{showUserMenu && (
								<motion.div
									initial={{ opacity: 0, y: 8, scale: 0.95 }}
									animate={{ opacity: 1, y: 0, scale: 1 }}
									exit={{ opacity: 0, y: 8, scale: 0.95 }}
									transition={{ duration: 0.15 }}
									className="absolute right-0 top-full mt-2 w-48 rounded-xl border border-zinc-200 bg-white p-1 shadow-lg dark:border-zinc-700 dark:bg-zinc-800"
								>
									<Link
										href="/creator/profile"
										className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm hover:bg-zinc-50 dark:hover:bg-zinc-700"
									>
										<User className="h-4 w-4" />
										Profil
									</Link>
									<Link
										href="/creator/profile"
										className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm hover:bg-zinc-50 dark:hover:bg-zinc-700"
									>
										<Settings className="h-4 w-4" />
										Paramètres
									</Link>
									<hr className="my-1 border-zinc-200 dark:border-zinc-700" />
									<a
										href="/api/auth/signout"
										className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950"
									>
										<LogOut className="h-4 w-4" />
										Déconnexion
									</a>
								</motion.div>
							)}
						</AnimatePresence>
					</div>
				</div>
			</div>
		</header>
	);
}



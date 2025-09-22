"use client";
import { CreatorHeader } from "./components/Header";
import Link from "next/link";
import { motion } from "framer-motion";
import { Home, Search, FileText, Wallet, User } from "lucide-react";

export default function CreatorLayout({ children }: { children: React.ReactNode }) {
	const navItems = [
		{ href: "/creator", label: "Dashboard", icon: Home },
		{ href: "/creator/discover", label: "Découvrir", icon: Search },
		{ href: "/creator/submissions", label: "Mes participations", icon: FileText },
		{ href: "/creator/wallet", label: "Portefeuille", icon: Wallet },
		{ href: "/creator/profile", label: "Profil", icon: User },
	];

	return (
		<div className="min-h-svh bg-white text-zinc-900 dark:bg-zinc-900 dark:text-zinc-100">
			<CreatorHeader />
			<div className="mx-auto grid w-full max-w-6xl grid-cols-1 gap-6 px-4 py-6 md:grid-cols-[240px_1fr]">
				{/* Desktop Sidebar */}
				<aside className="hidden md:block">
					<nav className="sticky top-20 space-y-2">
						{navItems.map((item, index) => (
							<motion.div
								key={item.href}
								initial={{ opacity: 0, x: -20 }}
								animate={{ opacity: 1, x: 0 }}
								transition={{ duration: 0.3, delay: index * 0.1 }}
							>
								<Link
									href={item.href}
									className="group flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium text-zinc-600 transition-all duration-200 hover:bg-zinc-100 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-100"
								>
									<item.icon className="h-5 w-5 transition-transform duration-200 group-hover:scale-110" />
									<span>{item.label}</span>
								</Link>
							</motion.div>
						))}
					</nav>
				</aside>

				{/* Main Content */}
				<main className="min-h-[calc(100vh-8rem)]">
					<motion.div
						initial={{ opacity: 0, y: 20 }}
						animate={{ opacity: 1, y: 0 }}
						transition={{ duration: 0.5 }}
					>
						{children}
					</motion.div>
				</main>
			</div>

			{/* Mobile Bottom Navigation */}
			<nav className="fixed inset-x-0 bottom-0 z-30 grid grid-cols-4 border-t border-zinc-200/50 bg-white/95 p-2 backdrop-blur-sm md:hidden dark:border-zinc-800/50 dark:bg-zinc-900/95">
				{navItems.slice(0, 4).map((item, index) => (
					<motion.div
						key={item.href}
						initial={{ opacity: 0, y: 20 }}
						animate={{ opacity: 1, y: 0 }}
						transition={{ duration: 0.3, delay: index * 0.1 }}
					>
						<Link
							href={item.href}
							className="flex flex-col items-center gap-1 rounded-lg px-3 py-2 text-xs font-medium text-zinc-600 transition-colors hover:bg-zinc-100 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-100"
						>
							<item.icon className="h-5 w-5" />
							<span className="truncate">{item.label.split(' ')[0]}</span>
						</Link>
					</motion.div>
				))}
			</nav>
		</div>
	);
}



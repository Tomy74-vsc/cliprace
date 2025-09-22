"use client";
import Link from "next/link";
import Image from "next/image";
import { motion } from "framer-motion";

export function AuthHeader() {
	return (
		<motion.div
			initial={{ opacity: 0, y: 8 }}
			animate={{ opacity: 1, y: 0 }}
			transition={{ duration: 0.3 }}
			className="mb-8 flex items-center justify-between"
		>
			<Link href="/" className="inline-flex items-center gap-2">
				<Image src="/vercel.svg" alt="ClipRace" width={28} height={28} />
				<span className="font-semibold">ClipRace</span>
			</Link>
			<Link href="/" className="text-sm text-zinc-600 hover:text-zinc-900 dark:text-zinc-300 dark:hover:text-white">
				Accueil
			</Link>
		</motion.div>
	);
}



"use client";
import Link from "next/link";

export default function BrandDashboard() {
	return (
		<div className="mx-auto max-w-6xl px-6 py-12">
			<h1 className="text-2xl font-bold">Espace Marque</h1>
			<div className="mt-4 grid gap-3">
				<Link href="/brand/contests" className="underline">Mes concours</Link>
				<Link href="/brand/contests/new" className="underline">Créer un concours</Link>
			</div>
		</div>
	);
}



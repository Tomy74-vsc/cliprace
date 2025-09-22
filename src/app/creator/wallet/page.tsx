"use client";
import { useState, useEffect } from "react";
import { getBrowserSupabase } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { motion } from "framer-motion";
import { Wallet, Euro, TrendingUp, Clock, CheckCircle, XCircle } from "lucide-react";

type Transaction = {
	id: string;
	amount_cents: number;
	status: string;
	created_at: string;
	contest_id: string | null;
	contest_title: string | null;
};

export default function WalletPage() {
	const supabase = getBrowserSupabase();
	const [balance, setBalance] = useState(0);
	const [transactions, setTransactions] = useState<Transaction[]>([]);
	const [amount, setAmount] = useState(0);
	const [loading, setLoading] = useState(false);
	const [msg, setMsg] = useState<string | null>(null);
	const [loadingData, setLoadingData] = useState(true);

	useEffect(() => {
		async function loadData() {
			const { data: { user } } = await supabase.auth.getUser();
			if (!user) return;

			// Load balance and transactions
			const [balanceRes, transactionsRes] = await Promise.all([
				supabase.rpc("creator_balance_cents", { p_creator_id: user.id }).single(),
				supabase.from("cashouts").select(`
					id,amount_cents,status,created_at,contest_id,
					contest:contests(title)
				`).eq("creator_id", user.id).order("created_at", { ascending: false })
			]);

			setBalance(Number((balanceRes.data as { creator_balance_cents?: number })?.creator_balance_cents ?? 0));
			// eslint-disable-next-line @typescript-eslint/no-explicit-any
			setTransactions((transactionsRes.data ?? []).map((t: any) => ({
				...t,
				contest_title: t.contest?.title || null
			})));
			setLoadingData(false);
		}
		loadData();
	}, [supabase]);

	async function onCashout(e: React.FormEvent) {
		e.preventDefault();
		if (amount < 1000) {
			setMsg("Le montant minimum est de 10€");
			return;
		}
		if (amount > balance) {
			setMsg("Montant insuffisant");
			return;
		}
		
		setMsg(null);
		setLoading(true);
		const res = await fetch("/api/cashouts", { method: "POST", body: JSON.stringify({ gross_cents: amount }) });
		setLoading(false);
		if (!res.ok) setMsg(await res.text()); else {
			setMsg("Demande envoyée");
			setAmount(0);
			// Reload data
			window.location.reload();
		}
	}

	if (loadingData) {
		return (
			<div className="space-y-6">
				<h1 className="text-2xl font-bold">Portefeuille & Cashout</h1>
				<div className="animate-pulse space-y-4">
					<div className="h-32 rounded-2xl bg-zinc-200 dark:bg-zinc-800"></div>
					<div className="h-64 rounded-2xl bg-zinc-200 dark:bg-zinc-800"></div>
				</div>
			</div>
		);
	}

	return (
		<div className="space-y-6">
			<h1 className="text-2xl font-bold">Portefeuille & Cashout</h1>

			{/* Balance Card */}
			<motion.div 
				initial={{ opacity: 0, y: 12 }} 
				animate={{ opacity: 1, y: 0 }} 
				className="rounded-2xl border border-zinc-200 bg-gradient-to-r from-indigo-50 to-violet-50 p-6 dark:border-zinc-800 dark:from-indigo-950 dark:to-violet-950"
			>
				<div className="flex items-center gap-3">
					<Wallet className="h-8 w-8 text-indigo-600" />
					<div>
						<h2 className="text-lg font-semibold">Solde disponible</h2>
						<p className="text-3xl font-bold text-indigo-600">€{(balance / 100).toFixed(2)}</p>
					</div>
				</div>
			</motion.div>

			{/* Cashout Form */}
			<motion.div 
				initial={{ opacity: 0, y: 12 }} 
				animate={{ opacity: 1, y: 0 }} 
				transition={{ delay: 0.1 }}
				className="rounded-2xl border border-zinc-200 p-6 dark:border-zinc-800"
			>
				<h3 className="mb-4 text-lg font-semibold">Retirer mes gains</h3>
				<form onSubmit={onCashout} className="space-y-4">
					<div>
						<label className="mb-2 block text-sm font-medium text-zinc-700 dark:text-zinc-200">
							Montant à retirer (€)
						</label>
						<Input
							type="number"
							step="0.01"
							min="10"
							max={balance / 100}
							placeholder="Ex: 25.00"
							value={amount || ""}
							onChange={(e) => setAmount(Number(e.target.value) * 100)}
						/>
						<p className="mt-1 text-xs text-zinc-500">Minimum: 10€ • Maximum: €{(balance / 100).toFixed(2)}</p>
					</div>
					<Button type="submit" disabled={loading || amount < 1000} className="w-full">
						{loading ? "Demande en cours..." : "Demander le cashout"}
					</Button>
					{msg && (
						<div className={`rounded-lg p-3 text-sm ${
							msg.includes("envoyée") ? "bg-green-50 text-green-600 dark:bg-green-950 dark:text-green-400" :
							"bg-red-50 text-red-600 dark:bg-red-950 dark:text-red-400"
						}`}>
							{msg}
						</div>
					)}
				</form>
			</motion.div>

			{/* Transactions History */}
			<motion.div 
				initial={{ opacity: 0, y: 12 }} 
				animate={{ opacity: 1, y: 0 }} 
				transition={{ delay: 0.2 }}
				className="rounded-2xl border border-zinc-200 p-6 dark:border-zinc-800"
			>
				<h3 className="mb-4 text-lg font-semibold">Historique des transactions</h3>
				{transactions.length === 0 ? (
					<div className="text-center py-8">
						<TrendingUp className="mx-auto h-12 w-12 text-zinc-400" />
						<p className="mt-2 text-zinc-600 dark:text-zinc-400">Aucune transaction pour le moment</p>
					</div>
				) : (
					<div className="space-y-3">
						{transactions.map((transaction) => (
							<div key={transaction.id} className="flex items-center justify-between rounded-lg border border-zinc-100 p-4 dark:border-zinc-700">
								<div className="flex items-center gap-3">
									<div className="flex h-10 w-10 items-center justify-center rounded-full bg-indigo-100 dark:bg-indigo-900">
										<Euro className="h-5 w-5 text-indigo-600" />
									</div>
									<div>
										<div className="font-medium">€{(transaction.amount_cents / 100).toFixed(2)}</div>
										<div className="text-sm text-zinc-500">
											{transaction.contest_title ? `Concours: ${transaction.contest_title}` : "Cashout"}
										</div>
									</div>
								</div>
								<div className="text-right">
									<div className="flex items-center gap-2">
										{transaction.status === "completed" ? (
											<CheckCircle className="h-4 w-4 text-green-500" />
										) : transaction.status === "failed" ? (
											<XCircle className="h-4 w-4 text-red-500" />
										) : (
											<Clock className="h-4 w-4 text-yellow-500" />
										)}
										<span className={`text-sm font-medium ${
											transaction.status === "completed" ? "text-green-600" :
											transaction.status === "failed" ? "text-red-600" :
											"text-yellow-600"
										}`}>
											{transaction.status === "completed" ? "Terminé" :
											 transaction.status === "failed" ? "Échoué" :
											 transaction.status === "pending" ? "En attente" : transaction.status}
										</span>
									</div>
									<div className="text-xs text-zinc-500">
										{new Date(transaction.created_at).toLocaleDateString()}
									</div>
								</div>
							</div>
						))}
					</div>
				)}
			</motion.div>
		</div>
	);
}



"use client";
import { useState, useEffect } from "react";
import { getBrowserSupabase } from "@/lib/supabase/client";
import { motion } from "framer-motion";
import { 
  CreditCard, 
  Download, 
  Eye, 
  Calendar, 
  DollarSign,
  CheckCircle,
  Clock,
  XCircle,
  FileText,
  Filter,
  Search
} from "lucide-react";
import { Badge } from "@/components/ui/badge";

type Invoice = {
  id: string;
  contest_id: string;
  amount_cents: number;
  status: "pending" | "paid" | "failed" | "refunded";
  payment_intent_id: string;
  created_at: string;
  paid_at: string | null;
  contest: {
    title: string;
    created_at: string;
  };
};

type FilterType = "all" | "pending" | "paid" | "failed" | "refunded";

export default function InvoicesPage() {
  const supabase = getBrowserSupabase();
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [filter, setFilter] = useState<FilterType>("all");

  useEffect(() => {
    async function loadInvoices() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      try {
        const { data: invoicesData } = await supabase
          .from("payments_brand")
          .select(`
            *,
            contest:contests!payments_brand_contest_id_fkey(
              title,
              created_at
            )
          `)
          .eq("brand_id", user.id)
          .order("created_at", { ascending: false });

        setInvoices((invoicesData as Invoice[]) || []);
        setLoading(false);
      } catch (error) {
        console.error("Error loading invoices:", error);
        setLoading(false);
      }
    }
    loadInvoices();
  }, [supabase]);

  const getStatusBadge = (status: string) => {
    const statusConfig = {
      paid: { color: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200", icon: CheckCircle },
      pending: { color: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200", icon: Clock },
      failed: { color: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200", icon: XCircle },
      refunded: { color: "bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200", icon: XCircle },
    };
    
    const config = statusConfig[status as keyof typeof statusConfig] || statusConfig.pending;
    const Icon = config.icon;
    
    return (
      <Badge className={`${config.color} border-0`}>
        <Icon className="h-3 w-3 mr-1" />
        {status === "paid" ? "Payé" : 
         status === "pending" ? "En attente" :
         status === "failed" ? "Échoué" : "Remboursé"}
      </Badge>
    );
  };

  const filteredInvoices = invoices.filter(invoice => {
    const matchesSearch = invoice.contest?.title.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesFilter = filter === "all" || invoice.status === filter;
    return matchesSearch && matchesFilter;
  });

  const totalPaid = invoices
    .filter(invoice => invoice.status === "paid")
    .reduce((sum, invoice) => sum + invoice.amount_cents, 0);

  const totalPending = invoices
    .filter(invoice => invoice.status === "pending")
    .reduce((sum, invoice) => sum + invoice.amount_cents, 0);

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="animate-pulse space-y-4">
          <div className="h-8 w-64 bg-zinc-200 dark:bg-zinc-800 rounded"></div>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="h-32 bg-zinc-200 dark:bg-zinc-800 rounded-2xl"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="flex items-center justify-between"
      >
        <div>
          <h1 className="text-3xl font-bold bg-gradient-to-r from-violet-600 to-indigo-600 bg-clip-text text-transparent">
            Factures
          </h1>
          <p className="mt-2 text-zinc-600 dark:text-zinc-400">
            Gérez vos paiements et téléchargez vos factures
          </p>
        </div>
      </motion.div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.1 }}
          className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-700 dark:bg-zinc-900"
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-zinc-600 dark:text-zinc-400">Total payé</p>
              <p className="mt-2 text-2xl font-bold text-zinc-900 dark:text-zinc-100">
                €{(totalPaid / 100).toFixed(2)}
              </p>
            </div>
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-green-100 dark:bg-green-900">
              <CheckCircle className="h-6 w-6 text-green-600 dark:text-green-400" />
            </div>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.2 }}
          className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-700 dark:bg-zinc-900"
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-zinc-600 dark:text-zinc-400">En attente</p>
              <p className="mt-2 text-2xl font-bold text-zinc-900 dark:text-zinc-100">
                €{(totalPending / 100).toFixed(2)}
              </p>
            </div>
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-yellow-100 dark:bg-yellow-900">
              <Clock className="h-6 w-6 text-yellow-600 dark:text-yellow-400" />
            </div>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.3 }}
          className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-700 dark:bg-zinc-900"
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-zinc-600 dark:text-zinc-400">Total factures</p>
              <p className="mt-2 text-2xl font-bold text-zinc-900 dark:text-zinc-100">
                {invoices.length}
              </p>
            </div>
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-violet-100 dark:bg-violet-900">
              <FileText className="h-6 w-6 text-violet-600 dark:text-violet-400" />
            </div>
          </div>
        </motion.div>
      </div>

      {/* Filters and Search */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.4 }}
        className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between"
      >
        {/* Search */}
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
          <input
            type="text"
            placeholder="Rechercher une facture..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full rounded-xl border border-zinc-200 bg-zinc-50/50 py-2 pl-10 pr-4 text-sm placeholder:text-zinc-400 focus:border-violet-300 focus:bg-white focus:outline-none focus:ring-2 focus:ring-violet-500/20 dark:border-zinc-700 dark:bg-zinc-800/50 dark:focus:border-violet-600 dark:focus:bg-zinc-800"
          />
        </div>

        {/* Filter */}
        <div className="flex items-center gap-2">
          <Filter className="h-4 w-4 text-zinc-400" />
          <select
            value={filter}
            onChange={(e) => setFilter(e.target.value as FilterType)}
            className="rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm focus:border-violet-300 focus:outline-none focus:ring-2 focus:ring-violet-500/20 dark:border-zinc-700 dark:bg-zinc-800"
            aria-label="Filtrer par statut"
          >
            <option value="all">Tous les statuts</option>
            <option value="paid">Payées</option>
            <option value="pending">En attente</option>
            <option value="failed">Échouées</option>
            <option value="refunded">Remboursées</option>
          </select>
        </div>
      </motion.div>

      {/* Invoices List */}
      {filteredInvoices.length === 0 ? (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.5 }}
          className="rounded-2xl border border-zinc-200 bg-zinc-50/50 p-8 text-center dark:border-zinc-700 dark:bg-zinc-900/50"
        >
          <CreditCard className="mx-auto h-12 w-12 text-zinc-400" />
          <h3 className="mt-4 text-lg font-semibold text-zinc-900 dark:text-zinc-100">
            Aucune facture
          </h3>
          <p className="mt-2 text-zinc-600 dark:text-zinc-400">
            {searchTerm || filter !== "all" 
              ? "Aucune facture ne correspond à vos critères" 
              : "Vous n'avez pas encore de factures"}
          </p>
        </motion.div>
      ) : (
        <div className="space-y-4">
          {filteredInvoices.map((invoice, index) => (
            <motion.div
              key={invoice.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.5 + index * 0.1 }}
              className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-700 dark:bg-zinc-900"
            >
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <h3 className="font-semibold text-zinc-900 dark:text-zinc-100">
                      {invoice.contest?.title || "Concours"}
                    </h3>
                    {getStatusBadge(invoice.status)}
                  </div>
                  
                  <div className="grid grid-cols-1 gap-4 md:grid-cols-3 text-sm text-zinc-600 dark:text-zinc-400">
                    <div className="flex items-center gap-2">
                      <DollarSign className="h-4 w-4" />
                      <span>€{(invoice.amount_cents / 100).toFixed(2)}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Calendar className="h-4 w-4" />
                      <span>Créé: {new Date(invoice.created_at).toLocaleDateString()}</span>
                    </div>
                    {invoice.paid_at && (
                      <div className="flex items-center gap-2">
                        <Calendar className="h-4 w-4" />
                        <span>Payé: {new Date(invoice.paid_at).toLocaleDateString()}</span>
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button className="inline-flex items-center gap-2 rounded-lg border border-zinc-200 px-3 py-2 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800">
                    <Eye className="h-4 w-4" />
                    Voir
                  </button>
                  {invoice.status === "paid" && (
                    <button className="inline-flex items-center gap-2 rounded-lg bg-violet-600 px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-violet-700">
                      <Download className="h-4 w-4" />
                      PDF
                    </button>
                  )}
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}

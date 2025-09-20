"use client";
import Link from "next/link";

export function AuthHeader() {
  return (
    <header className="relative py-6">
      <div className="absolute left-4 top-1/2 -translate-y-1/2">
        <Link href="/" className="inline-flex items-center gap-2 text-zinc-600 hover:text-zinc-900">
          ← <span className="underline underline-offset-4">Retour</span>
        </Link>
      </div>
      <div className="flex items-center justify-center gap-3">
        <div className="h-9 w-9 rounded-2xl bg-gradient-to-br from-[#7C3AED] to-[#635BFF]" />
        <div className="text-2xl font-extrabold tracking-tight">ClipRace</div>
      </div>
    </header>
  );
}

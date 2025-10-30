"use client";

import React, { useMemo } from "react";

function scorePassword(pw: string): number {
  if (!pw) return 0;
  let score = 0;
  const lengthScore = Math.min(40, pw.length * 4); // up to 40 for length
  score += lengthScore;
  if (/[a-z]/.test(pw)) score += 15;
  if (/[A-Z]/.test(pw)) score += 15;
  if (/[0-9]/.test(pw)) score += 15;
  if (/[^A-Za-z0-9]/.test(pw)) score += 15;
  return Math.max(0, Math.min(100, score));
}

function labelFor(score: number): { text: string; color: string } {
  if (score < 35) return { text: "Faible", color: "bg-rose-500" };
  if (score < 70) return { text: "Moyen", color: "bg-amber-500" };
  return { text: "Fort", color: "bg-emerald-500" };
}

export default function PasswordStrength({ password }: { password: string }) {
  const s = useMemo(() => scorePassword(password), [password]);
  const { text, color } = useMemo(() => labelFor(s), [s]);
  return (
    <div className="mt-2" aria-live="polite">
      <div className="h-2 w-full rounded-full bg-gray-200 overflow-hidden">
        <div
          className={`h-full ${color} transition-all duration-300`}
          style={{ width: `${s}%` }}
        />
      </div>
      <div className="mt-1 text-xs text-gray-600">Force du mot de passe: <span className="font-medium">{text}</span></div>
    </div>
  );
}



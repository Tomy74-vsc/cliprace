"use client";

import React from "react";

type Props = {
  children: React.ReactNode;
  loading?: boolean;
  disabled?: boolean;
  className?: string;
};

export default function SubmitButton({ children, loading, disabled, className }: Props) {
  return (
    <button
      type="submit"
      disabled={disabled || loading}
      className={
        "inline-flex w-full items-center justify-center rounded-lg bg-violet-600 px-4 py-2.5 font-medium text-white shadow-sm transition hover:bg-violet-600/90 hover:shadow-md focus:outline-none focus:ring-2 focus:ring-violet-500 disabled:opacity-60 " +
        (className ?? "")
      }
    >
      {loading ? (
        <span className="inline-flex items-center gap-2">
          <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" aria-hidden="true" />
          <span>Veuillez patienter...</span>
        </span>
      ) : (
        children
      )}
    </button>
  );
}



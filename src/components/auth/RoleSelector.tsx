"use client";

import React from "react";

type Role = "creator" | "brand";

type Props = {
  value: Role;
  onChange: (role: Role) => void;
  name?: string;
};

const base =
  "inline-flex items-center justify-center rounded-full border px-3 py-2 text-sm font-medium transition focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 focus-within:ring-2 focus-within:ring-violet-500";

export default function RoleSelector({ value, onChange, name = "role" }: Props) {
  return (
    <div role="radiogroup" aria-label="Choisissez votre rôle" className="grid grid-cols-2 gap-2">
      {(["creator", "brand"] as Role[]).map((option) => {
        const selected = value === option;
        return (
          <label
            key={option}
            className={
              base +
              " " +
              (selected
                ? "border-violet-400 bg-violet-50 text-violet-800"
                : "border-gray-200 bg-white text-gray-700 hover:bg-gray-50")
            }
            role="button"
            aria-pressed={selected}
          >
            <input
              type="radio"
              name={name}
              value={option}
              className="sr-only"
              checked={selected}
              onChange={() => onChange(option)}
              aria-checked={selected}
            />
            {option === "creator" ? "Creator" : "Brand"}
          </label>
        );
      })}
    </div>
  );
}



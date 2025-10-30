import React from "react";

type CardProps = {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
};

export function Card({ title, subtitle, children, footer }: CardProps) {
  return (
    <div className="w-full max-w-[480px] rounded-2xl bg-white/90 shadow-xl ring-1 ring-black/5 backdrop-blur px-8 py-10">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight text-gray-900">{title}</h1>
        {subtitle ? (
          <p className="mt-1 text-sm text-gray-500">{subtitle}</p>
        ) : null}
      </div>
      <div>{children}</div>
      {footer ? <div className="mt-6 text-sm text-gray-500">{footer}</div> : null}
    </div>
  );
}



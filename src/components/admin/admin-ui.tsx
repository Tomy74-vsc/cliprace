'use client';

import React, { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { SlidersHorizontal } from 'lucide-react';

import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

export type AdminDensity = 'compact' | 'comfort' | 'dense';

type AdminUIContextValue = {
  density: AdminDensity;
  setDensity: (density: AdminDensity) => void;
};

const AdminUIContext = createContext<AdminUIContextValue | undefined>(undefined);

const STORAGE_KEY = 'cliprace.admin.density';

function readStoredDensity(): AdminDensity | null {
  try {
    const value = window.localStorage.getItem(STORAGE_KEY);
    if (value === 'compact' || value === 'comfort' || value === 'dense') return value;
    return null;
  } catch {
    return null;
  }
}

function storeDensity(density: AdminDensity) {
  try {
    window.localStorage.setItem(STORAGE_KEY, density);
  } catch {
    // ignore
  }
}

export function AdminUIProvider({ children }: { children: ReactNode }) {
  const [density, setDensity] = useState<AdminDensity>('comfort');

  useEffect(() => {
    const stored = readStoredDensity();
    if (stored) setDensity(stored);
  }, []);

  const value = useMemo<AdminUIContextValue>(() => {
    return {
      density,
      setDensity: (next) => {
        setDensity(next);
        storeDensity(next);
      },
    };
  }, [density]);

  return (
    <AdminUIContext.Provider value={value}>
      <div data-admin-density={density} className="admin-scope">
        {children}
      </div>
    </AdminUIContext.Provider>
  );
}

export function useAdminUI() {
  const ctx = useContext(AdminUIContext);
  if (!ctx) throw new Error('useAdminUI must be used within AdminUIProvider');
  return ctx;
}

const LABELS: Record<AdminDensity, string> = {
  compact: 'Compact',
  comfort: 'Confort',
  dense: 'Dense',
};

export function AdminDensityToggle() {
  const { density, setDensity } = useAdminUI();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="sm" className="h-10 rounded-full">
          <SlidersHorizontal className="h-4 w-4" />
          <span className="hidden md:inline">{LABELS[density]}</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel>Densité</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {(['compact', 'comfort', 'dense'] as const).map((value) => (
          <DropdownMenuItem key={value} onClick={() => setDensity(value)}>
            <span className="flex-1">{LABELS[value]}</span>
            {density === value ? <span className="text-xs text-muted-foreground">Actif</span> : null}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}


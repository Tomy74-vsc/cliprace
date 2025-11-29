'use client';

import { Moon, Sun } from 'lucide-react';
import { useTheme } from 'next-themes';
import { useEffect, useState } from 'react';
import { Button } from './button';

/**
 * Simple dark/light toggle using next-themes.
 * Intended for topbar use.
 */
export function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) return null;

  const isDark = theme === 'dark';

  return (
    <Button
      variant="ghost"
      size="sm"
      aria-label={isDark ? 'Passer en thème clair' : 'Passer en thème sombre'}
      onClick={() => setTheme(isDark ? 'light' : 'dark')}
      className="h-12 w-12 rounded-full"
    >
      {isDark ? <Sun className="h-10 w-10" /> : <Moon className="h-10 w-10" />}
    </Button>
  );
}


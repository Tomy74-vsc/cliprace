'use client';

/**
 * useBrandPortalContainer — Returns the portal root element inside .brand-scope.
 *
 * Radix/Vaul portals mount into document.body by default, which is OUTSIDE
 * .brand-scope — so Brand Ink tokens (--surface-1, --text-1, etc.) don't resolve.
 *
 * BrandShell renders <div id="brand-portal-root" /> inside .brand-scope.
 * This hook returns that element so Dialog/Drawer portals render inside scope.
 */
import { useEffect, useState } from 'react';

export const BRAND_PORTAL_ID = 'brand-portal-root';

export function useBrandPortalContainer(): HTMLElement | undefined {
  const [container, setContainer] = useState<HTMLElement | undefined>(
    undefined,
  );

  useEffect(() => {
    const el = document.getElementById(BRAND_PORTAL_ID);
    if (el) setContainer(el);
  }, []);

  return container;
}

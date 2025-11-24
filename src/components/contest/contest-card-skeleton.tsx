/*
Source: Component ContestCardSkeleton
Purpose: Skeleton animé pour ContestCard
*/
'use client';

import { motion } from 'framer-motion';
import { Card, CardContent, CardFooter } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';

export function ContestCardSkeleton() {
  return (
    <Card className="h-full overflow-hidden">
      <Skeleton className="h-48 w-full rounded-t-lg" />
      <CardContent className="p-5 space-y-4">
        <Skeleton className="h-6 w-3/4" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-2/3" />
        <div className="flex items-center gap-2">
          <Skeleton className="h-5 w-5 rounded-full" />
          <Skeleton className="h-4 w-24" />
        </div>
        <div className="p-3 rounded-xl bg-zinc-100 dark:bg-zinc-900 space-y-2">
          <Skeleton className="h-8 w-32" />
          <Skeleton className="h-3 w-20" />
        </div>
        <div className="flex gap-2">
          <Skeleton className="h-6 w-16 rounded-full" />
          <Skeleton className="h-6 w-20 rounded-full" />
        </div>
      </CardContent>
      <CardFooter className="border-t p-4">
        <Skeleton className="h-4 w-24" />
      </CardFooter>
    </Card>
  );
}


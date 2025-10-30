"use client";

import { useState } from 'react';
import { cn } from '@/lib/utils';
import type { MessagingThread } from './types';
import { MessagingThreadList } from './MessagingThreadList';
import { MessagingThreadView } from './MessagingThreadView';

interface MessagingPanelProps {
  className?: string;
}

export function MessagingPanel({ className }: MessagingPanelProps) {
  const [selectedThread, setSelectedThread] = useState<MessagingThread | null>(null);

  return (
    <div className={cn('flex h-full w-full gap-4', className)}>
      <aside className="w-full max-w-xs flex-shrink-0">
        <MessagingThreadList
          activeThreadId={selectedThread?.id}
          onSelect={thread => setSelectedThread(thread)}
        />
      </aside>
      <section className="flex-1">
        <MessagingThreadView thread={selectedThread} />
      </section>
    </div>
  );
}

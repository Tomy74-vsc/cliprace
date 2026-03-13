'use client';

import { useEffect, useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { formatDistanceToNow } from 'date-fns';
import { enUS } from 'date-fns/locale';
import { supabase } from '@/lib/supabase/client';
import { Panel, StatusBadge, EmptyState } from '@/components/brand-ui';

interface LiveSubmission {
  id: string;
  contest_id: string;
  created_at: string;
  title: string | null;
  status: string;
}

interface DashboardLiveRailProps {
  brandId: string;
}

export function DashboardLiveRail({ brandId }: DashboardLiveRailProps) {
  const [submissions, setSubmissions] = useState<LiveSubmission[]>([]);
  const [offline, setOffline] = useState(false);

  useEffect(() => {
    let isCancelled = false;

    async function bootstrap() {
      // 1) Fetch recent contests for this brand
      const { data: contests, error: contestsError } = await supabase
        .from('contests')
        .select('id')
        .eq('brand_id', brandId)
        .order('created_at', { ascending: false })
        .limit(20);

      if (contestsError || !contests || contests.length === 0) {
        if (!isCancelled) {
          setSubmissions([]);
        }
        return;
      }

      const contestIds = contests.map((c) => c.id as string);

      // 2) Load last 5 submissions for these contests
      const { data: initial, error: submissionsError } = await supabase
        .from('submissions')
        .select('id, contest_id, created_at, title, status')
        .in('contest_id', contestIds)
        .order('created_at', { ascending: false })
        .limit(5);

      if (!isCancelled) {
        if (!submissionsError && initial) {
          setSubmissions(initial as LiveSubmission[]);
        }
      }

      // 3) Realtime subscription
      const channel = supabase
        .channel(`brand-submissions-${brandId}`)
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'submissions',
            filter: `contest_id=in.(${contestIds.join(',')})`,
          },
          (payload) => {
            const row = payload.new as LiveSubmission;
            setSubmissions((current) => {
              const next = [row, ...current];
              return next.slice(0, 5);
            });
          },
        )
        .subscribe((status) => {
          if (!isCancelled) {
            setOffline(status !== 'SUBSCRIBED');
          }
        });

      return () => {
        supabase.removeChannel(channel);
      };
    }

    const cleanupPromise = bootstrap();

    return () => {
      isCancelled = true;
      cleanupPromise
        .then((cleanup) => {
          if (typeof cleanup === 'function') cleanup();
        })
        .catch(() => {});
    };
  }, [brandId]);

  const content = useMemo(() => {
    if (submissions.length === 0) {
      return (
        <div className="h-[260px] flex items-center justify-center">
          <EmptyState
            title="Waiting for submissions..."
            description="New creator videos will appear here as they come in."
          />
        </div>
      );
    }

    return (
      <div className="h-[260px] overflow-y-auto space-y-3">
        <AnimatePresence initial={false}>
          {submissions.map((submission) => (
            <motion.div
              key={submission.id}
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 8 }}
              transition={{ type: 'spring', stiffness: 300, damping: 30 }}
              className="flex items-start justify-between gap-3 rounded-[var(--r2)] border border-[var(--border-1)]/60 bg-[var(--surface-2)]/40 px-3 py-2.5"
            >
              <div className="flex items-start gap-3 min-w-0">
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[var(--surface-2)] border border-[var(--border-1)] text-[11px] font-semibold text-[var(--text-2)]">
                  {/* Initials stand-in for creator avatar until we have a join */}
                  VS
                </div>
                <div className="min-w-0">
                  <p className="text-[13px] font-medium text-[var(--text-1)] truncate">
                    {submission.title || 'New submission'}
                  </p>
                  <p className="mt-0.5 text-[12px] text-[var(--text-3)]">
                    {formatDistanceToNow(new Date(submission.created_at), {
                      addSuffix: true,
                      locale: enUS,
                    })}
                  </p>
                </div>
              </div>
              <StatusBadge status={submission.status === 'approved' ? 'approved' : 'pending'} />
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    );
  }, [submissions]);

  return (
    <Panel
      title="Live"
      description={offline ? 'Realtime offline — refreshing soon.' : 'Latest submissions in realtime.'}
      className="h-[320px]"
    >
      {content}
    </Panel>
  );
}


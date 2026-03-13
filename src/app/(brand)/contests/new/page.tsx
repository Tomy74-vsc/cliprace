import Link from 'next/link';
import { redirect } from 'next/navigation';
import { ChevronLeft } from 'lucide-react';
import { getSession } from '@/lib/auth';
import { WizardShell } from './_components/wizard-shell';

export default async function NewContestPage() {
  const { user } = await getSession();
  if (!user) {
    redirect('/auth/login');
  }

  return (
    <div className="brand-scope">
      <div className="flex items-center gap-3 px-6 pt-6">
        <Link
          href="/app/brand/contests"
          className="inline-flex items-center gap-1 text-sm text-[var(--text-3)] hover:text-[var(--text-1)]"
        >
          <ChevronLeft className="h-4 w-4" />
          Campaigns
        </Link>
        <h1 className="text-[22px] font-semibold text-[var(--text-1)]">
          Create a contest
        </h1>
      </div>
      <WizardShell />
    </div>
  );
}


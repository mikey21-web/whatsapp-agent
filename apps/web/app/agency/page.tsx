'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/lib/auth-store';
import { Briefcase, CreditCard, Globe } from 'lucide-react';

export default function AgencyHome() {
  const router = useRouter();
  const principal = useAuth((s) => s.principal);
  useEffect(() => {
    if (!principal || principal.type !== 'AGENCY') router.replace('/login/agency');
  }, [principal, router]);

  return (
    <main className="mx-auto max-w-4xl p-8">
      <h1 className="mb-6 text-2xl font-semibold">Agency Dashboard</h1>
      <div className="grid gap-4 md:grid-cols-3">
        <Tile href="/agency/clients" icon={<Briefcase size={18} />} title="Clients" desc="Manage your sub-accounts" />
        <Tile href="/agency/billing" icon={<CreditCard size={18} />} title="Billing" desc="Plan, usage, and invoices" />
        <Tile href="/agency/domain" icon={<Globe size={18} />} title="Custom Domain" desc="Point your domain at the platform" />
      </div>
    </main>
  );
}

function Tile({ href, icon, title, desc }: { href: string; icon: React.ReactNode; title: string; desc: string }) {
  return (
    <Link
      href={href}
      className="block rounded-md border border-border p-4 transition hover:border-[var(--brand)]"
    >
      <div className="mb-2 flex items-center gap-2 font-medium">
        {icon}
        <span>{title}</span>
      </div>
      <p className="text-xs text-muted-foreground">{desc}</p>
    </Link>
  );
}

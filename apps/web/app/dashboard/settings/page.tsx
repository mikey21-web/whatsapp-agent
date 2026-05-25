'use client';

import Link from 'next/link';
import { useAuth } from '@/lib/auth-store';
import { Phone } from 'lucide-react';

export default function SettingsPage() {
  const principal = useAuth((s) => s.principal);
  return (
    <div className="h-full overflow-auto p-6">
      <h1 className="mb-4 text-2xl font-semibold">Settings</h1>

      <div className="mb-6 grid gap-3 md:grid-cols-2">
        <Link
          href="/dashboard/settings/connect-whatsapp"
          className="flex items-center gap-3 rounded-md border border-border p-4 hover:border-[var(--brand)]"
        >
          <Phone size={20} />
          <div>
            <div className="font-medium">Connect WhatsApp</div>
            <div className="text-xs text-muted-foreground">
              Embedded Signup with Meta · 60 seconds, ban-proof
            </div>
          </div>
        </Link>
      </div>

      <details className="rounded-md border border-border p-4 text-sm">
        <summary className="cursor-pointer text-muted-foreground">Debug: principal</summary>
        <pre className="mt-2 rounded bg-muted/30 p-3 text-xs">
          {JSON.stringify(principal, null, 2)}
        </pre>
      </details>
    </div>
  );
}

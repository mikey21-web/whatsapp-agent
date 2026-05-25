'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-store';

export default function SuperAdminHome() {
  const router = useRouter();
  const principal = useAuth((s) => s.principal);
  useEffect(() => {
    if (!principal || principal.type !== 'SUPER_ADMIN') router.replace('/login/superadmin');
  }, [principal, router]);
  return (
    <main className="p-8">
      <h1 className="mb-4 text-2xl font-semibold">Super Admin</h1>
      <p className="text-muted-foreground">
        Phase 1 stub. Agency CRUD UI lands in Phase 4. The API endpoints are live now at{' '}
        <code className="rounded bg-muted px-1">/agencies</code>.
      </p>
    </main>
  );
}

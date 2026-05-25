'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-store';
import { api } from '@/lib/api';
import {
  MessageSquare, Users, Settings, LogOut, Bot, BookOpen, Briefcase,
  Workflow, Megaphone, Sparkles, BarChart3, Plug, Zap, Menu, X, FileText,
} from 'lucide-react';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const principal = useAuth((s) => s.principal);
  const clear = useAuth((s) => s.clear);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    if (!principal) router.replace('/login/team');
  }, [principal, router]);

  async function logout() {
    await api('/auth/logout', { method: 'POST' }).catch(() => undefined);
    clear();
    router.replace('/login/team');
  }

  return (
    <div className="flex h-screen overflow-hidden">
      <button
        onClick={() => setMobileOpen(true)}
        aria-label="Open menu"
        className="fixed left-3 top-3 z-30 inline-flex h-10 w-10 items-center justify-center rounded-md border border-border bg-background md:hidden"
      >
        <Menu size={18} />
      </button>

      <aside
        className={[
          'flex w-56 flex-col border-r border-border bg-muted/30 p-3',
          'md:static md:translate-x-0',
          'fixed inset-y-0 left-0 z-40 transition-transform',
          mobileOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0',
        ].join(' ')}
      >
        <div className="flex items-center justify-between px-3 py-2">
          <span className="text-lg font-semibold">diyaa.ai</span>
          <button
            onClick={() => setMobileOpen(false)}
            className="md:hidden"
            aria-label="Close menu"
          >
            <X size={16} />
          </button>
        </div>
        <nav className="mt-4 flex flex-col gap-1">
          <NavLink href="/dashboard/inbox" icon={<MessageSquare size={16} />} label="Inbox" onNav={() => setMobileOpen(false)} />
          <NavLink href="/dashboard/contacts" icon={<Users size={16} />} label="Contacts" onNav={() => setMobileOpen(false)} />
          <NavLink href="/dashboard/deals" icon={<Briefcase size={16} />} label="Deals" onNav={() => setMobileOpen(false)} />
          <NavLink href="/dashboard/agents" icon={<Bot size={16} />} label="AI Agents" onNav={() => setMobileOpen(false)} />
          <NavLink href="/dashboard/knowledge" icon={<BookOpen size={16} />} label="Knowledge" onNav={() => setMobileOpen(false)} />
          <NavLink href="/dashboard/flows" icon={<Workflow size={16} />} label="Flows" onNav={() => setMobileOpen(false)} />
          <NavLink href="/dashboard/campaigns" icon={<Megaphone size={16} />} label="Campaigns" onNav={() => setMobileOpen(false)} />
          <NavLink href="/dashboard/templates-meta" icon={<FileText size={16} />} label="WhatsApp Templates" onNav={() => setMobileOpen(false)} />
          <NavLink href="/dashboard/analytics" icon={<BarChart3 size={16} />} label="Analytics" onNav={() => setMobileOpen(false)} />
          <NavLink href="/dashboard/integrations" icon={<Plug size={16} />} label="Integrations" onNav={() => setMobileOpen(false)} />
          <NavLink href="/dashboard/quick-replies" icon={<Zap size={16} />} label="Quick Replies" onNav={() => setMobileOpen(false)} />
          <NavLink href="/dashboard/templates" icon={<Sparkles size={16} />} label="Templates" onNav={() => setMobileOpen(false)} />
          <NavLink href="/dashboard/settings" icon={<Settings size={16} />} label="Settings" onNav={() => setMobileOpen(false)} />
        </nav>
        <button
          onClick={logout}
          className="mt-auto flex items-center gap-2 rounded-md px-3 py-2 text-sm hover:bg-muted"
        >
          <LogOut size={16} /> Sign out
        </button>
      </aside>

      {mobileOpen && (
        <div
          onClick={() => setMobileOpen(false)}
          className="fixed inset-0 z-30 bg-black/30 md:hidden"
        />
      )}

      <main className="flex-1 overflow-hidden pt-14 md:pt-0">{children}</main>
    </div>
  );
}

function NavLink({
  href, icon, label, onNav,
}: {
  href: string;
  icon: React.ReactNode;
  label: string;
  onNav: () => void;
}) {
  return (
    <Link
      href={href}
      onClick={onNav}
      className="flex items-center gap-2 rounded-md px-3 py-2 text-sm hover:bg-muted"
    >
      {icon}
      <span>{label}</span>
    </Link>
  );
}

import Link from 'next/link';
import type { ReactNode } from 'react';

/**
 * Public marketing layout. Wraps `/`, `/pricing`, `/features` with a shared
 * header + footer. Auth pages and dashboard intentionally don't use this so
 * they stay distraction-free.
 */
export default function MarketingLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      <Header />
      <main className="flex-1">{children}</main>
      <Footer />
    </div>
  );
}

function Header() {
  return (
    <header className="border-b border-border/60 bg-background/80 backdrop-blur sticky top-0 z-30">
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-6">
        <Link href="/" className="flex items-center gap-2 font-semibold">
          <span className="inline-block h-6 w-6 rounded-md bg-[var(--brand,#6366f1)]" aria-hidden />
          <span>diyaa.ai</span>
        </Link>
        <nav className="hidden items-center gap-6 text-sm md:flex">
          <Link href="/features" className="text-muted-foreground hover:text-foreground">Features</Link>
          <Link href="/pricing" className="text-muted-foreground hover:text-foreground">Pricing</Link>
          <Link href="/login/client" className="text-muted-foreground hover:text-foreground">Sign in</Link>
          <Link
            href="/signup"
            className="rounded-md bg-foreground px-3 py-1.5 text-sm font-medium text-background hover:opacity-90"
          >
            Start free
          </Link>
        </nav>
        <Link
          href="/signup"
          className="rounded-md bg-foreground px-3 py-1.5 text-sm font-medium text-background md:hidden"
        >
          Start free
        </Link>
      </div>
    </header>
  );
}

function Footer() {
  return (
    <footer className="border-t border-border/60 py-10">
      <div className="mx-auto grid max-w-6xl grid-cols-2 gap-8 px-6 text-sm md:grid-cols-4">
        <div>
          <div className="font-semibold">diyaa.ai</div>
          <p className="mt-2 text-muted-foreground">
            AI-powered WhatsApp for every business.
          </p>
        </div>
        <div>
          <div className="text-xs uppercase tracking-wide text-muted-foreground">Product</div>
          <ul className="mt-2 space-y-1">
            <li><Link href="/features" className="hover:underline">Features</Link></li>
            <li><Link href="/pricing" className="hover:underline">Pricing</Link></li>
            <li><Link href="/signup" className="hover:underline">Get started</Link></li>
          </ul>
        </div>
        <div>
          <div className="text-xs uppercase tracking-wide text-muted-foreground">Account</div>
          <ul className="mt-2 space-y-1">
            <li><Link href="/login/client" className="hover:underline">Sign in</Link></li>
            <li><Link href="/login/agency" className="hover:underline">Agency portal</Link></li>
            <li><Link href="/forgot-password" className="hover:underline">Forgot password</Link></li>
          </ul>
        </div>
        <div>
          <div className="text-xs uppercase tracking-wide text-muted-foreground">Legal</div>
          <ul className="mt-2 space-y-1">
            <li><a href="mailto:hello@diyaa.ai" className="hover:underline">Contact</a></li>
          </ul>
        </div>
      </div>
      <div className="mx-auto mt-8 max-w-6xl px-6 text-xs text-muted-foreground">
        © {new Date().getFullYear()} diyaa.ai · Built for Indian SMBs
      </div>
    </footer>
  );
}

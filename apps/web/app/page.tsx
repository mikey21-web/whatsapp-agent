import Link from 'next/link';

export default function HomePage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6 p-8">
      <h1 className="text-4xl font-bold">diyaa.ai</h1>
      <p className="text-muted-foreground">WhatsApp AI automation for Indian SMBs.</p>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {(['superadmin', 'agency', 'client', 'team'] as const).map((role) => (
          <Link
            key={role}
            href={`/login/${role}`}
            className="rounded-md border border-border px-4 py-2 text-sm capitalize hover:bg-muted"
          >
            {role} login
          </Link>
        ))}
      </div>
    </main>
  );
}

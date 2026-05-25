export const dynamic = 'force-static';

export default function OfflinePage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-8 text-center">
      <h1 className="mb-2 text-2xl font-semibold">You're offline</h1>
      <p className="text-sm text-muted-foreground">
        diyaa.ai needs a connection to load conversations. Try again when you're back online.
      </p>
    </main>
  );
}

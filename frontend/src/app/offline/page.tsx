'use client';

import { WifiOff } from 'lucide-react';

export default function OfflinePage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-canvas-light px-4 text-center dark:bg-canvas-dark">
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400">
        <WifiOff className="h-6 w-6" />
      </div>
      <h1 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">Page non disponible hors-ligne</h1>
      <p className="max-w-sm text-sm text-zinc-500 dark:text-zinc-500">
        Cette page n'a pas encore été visitée en ligne, elle n'est donc pas en cache. La Caisse,
        elle, fonctionne hors-ligne une fois le catalogue chargé.
      </p>
    </div>
  );
}

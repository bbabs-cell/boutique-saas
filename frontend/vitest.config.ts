import { defineConfig } from 'vitest/config';
import { resolve } from 'path';

export default defineConfig({
  test: {
    environment: 'node',
    globals: true,
    include: ['src/**/*.spec.ts', 'src/**/*.spec.tsx'],
    // fake-indexeddb fournit une vraie implémentation d'IndexedDB en mémoire : la file de
    // ventes hors-ligne est donc testée à travers Dexie, comme en production, plutôt que
    // contre un faux qui ne reproduirait ni les transactions ni les index.
    setupFiles: ['src/lib/__tests__/setup.ts'],
  },
  resolve: {
    alias: { '@': resolve(__dirname, 'src') },
  },
});

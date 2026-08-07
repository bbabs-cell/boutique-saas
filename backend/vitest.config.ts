import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    globals: true,
    include: ['src/**/*.spec.ts'],
    setupFiles: ['src/common/testing/setup-env.ts'],
    // Les tests d'intégration ont besoin d'une vraie base PostgreSQL : ils ont leur propre
    // configuration (vitest.integration.config.ts) et leur propre commande, pour que
    // `npm test` reste exécutable sans aucune dépendance externe.
    exclude: ['**/node_modules/**', 'src/**/*.integration.spec.ts'],
  },
});

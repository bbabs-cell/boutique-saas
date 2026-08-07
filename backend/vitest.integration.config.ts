import { defineConfig } from 'vitest/config';

/**
 * Tests d'intégration : ils parlent à une vraie base PostgreSQL, migrée au préalable
 * (`npx prisma migrate deploy`). Ils vérifient ce qu'un Prisma simulé ne peut pas prouver —
 * l'isolation entre organisations, le comportement réel des transactions et des verrous,
 * et les contraintes posées en base.
 *
 *   DATABASE_URL=postgresql://... npm run test:integration
 *
 * Séquentiels (un seul worker) : ils partagent la même base et se marcheraient dessus.
 */
export default defineConfig({
  test: {
    environment: 'node',
    globals: true,
    include: ['src/**/*.integration.spec.ts'],
    pool: 'forks',
    poolOptions: { forks: { singleFork: true } },
    testTimeout: 30_000,
    hookTimeout: 30_000,
  },
});

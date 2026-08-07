import { z } from 'zod';

/**
 * Valeur d'exemple livrée dans `.env.example`. Elle est publiée dans le dépôt : l'accepter
 * reviendrait à signer les JWT avec un secret que tout le monde peut lire — donc à laisser
 * n'importe qui forger un token ADMIN pour n'importe quel tenant. On la refuse explicitement
 * pour que `cp .env.example .env` sans relecture ne puisse pas partir en production.
 */
const PLACEHOLDER_JWT_SECRET = 'change-me-in-production';

const MIN_JWT_SECRET_LENGTH = 32;

const envSchema = z.object({
  DATABASE_URL: z.string().min(1, 'DATABASE_URL est obligatoire.'),
  JWT_SECRET: z
    .string({ required_error: 'JWT_SECRET est obligatoire.' })
    .min(
      MIN_JWT_SECRET_LENGTH,
      `JWT_SECRET doit faire au moins ${MIN_JWT_SECRET_LENGTH} caractères. ` +
        'Génère-en un avec : openssl rand -base64 48',
    )
    .refine((value) => value !== PLACEHOLDER_JWT_SECRET, {
      message:
        "JWT_SECRET a encore la valeur d'exemple du dépôt, qui est publique. " +
        'Génère un secret propre avec : openssl rand -base64 48',
    }),
  JWT_EXPIRES_IN: z.string().default('7d'),
  PORT: z.coerce.number().int().positive().default(3001),
});

/**
 * Vérifiée au démarrage par ConfigModule : une configuration incomplète doit empêcher le
 * serveur de démarrer, jamais le laisser tourner avec une valeur de repli silencieuse.
 * Les variables optionnelles (SUPABASE_*, PLATFORM_ADMIN_SECRET) ne sont volontairement pas
 * listées : les fonctionnalités qui en dépendent échouent déjà proprement à l'usage, et les
 * exiger ici empêcherait de démarrer une instance qui n'en a pas besoin.
 */
export function validateEnv(config: Record<string, unknown>): Record<string, unknown> {
  const result = envSchema.safeParse(config);

  if (!result.success) {
    const details = result.error.issues
      .map((issue) => `  - ${issue.path.join('.')} : ${issue.message}`)
      .join('\n');
    throw new Error(`Configuration d'environnement invalide :\n${details}`);
  }

  // On repart de la config complète : le schéma ne décrit que les variables critiques, mais
  // ConfigService doit continuer à exposer toutes les autres (SUPABASE_URL, etc.).
  return { ...config, ...result.data };
}

export { PLACEHOLDER_JWT_SECRET, MIN_JWT_SECRET_LENGTH };

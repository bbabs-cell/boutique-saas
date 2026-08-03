import { randomBytes, createHash } from 'crypto';

const KEY_PREFIX = 'bsk_';

/** Génère une nouvelle clé API en clair (affichée une seule fois) et son hash (stocké en base). */
export function generateApiKey(): { plainKey: string; keyHash: string } {
  const plainKey = KEY_PREFIX + randomBytes(32).toString('base64url');
  return { plainKey, keyHash: hashApiKey(plainKey) };
}

/**
 * SHA-256, pas bcrypt : une clé API est un jeton à haute entropie généré par nous (pas un mot
 * de passe choisi par un humain), donc pas besoin de salage contre les attaques par dictionnaire.
 * Un hash déterministe permet de retrouver la clé par recherche directe (`keyHash` unique),
 * ce que bcrypt ne permet pas (salage différent à chaque hash).
 */
export function hashApiKey(plainKey: string): string {
  return createHash('sha256').update(plainKey).digest('hex');
}

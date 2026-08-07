import { createCipheriv, createDecipheriv, hkdfSync, randomBytes } from 'crypto';

/**
 * Chiffrement des secrets applicatifs stockés en base — aujourd'hui le secret TOTP du 2FA.
 *
 * Pourquoi : stocké en clair, ce secret est le second facteur lui-même. Une fuite de la base
 * livrerait donc les mots de passe (hachés, mais attaquables) ET le 2FA censé les protéger,
 * dans le même fichier. Le chiffrer déplace le secret hors de la base : un dump ne suffit plus.
 *
 * AES-256-GCM : chiffre et authentifie en une passe, donc un enregistrement altéré est détecté
 * au déchiffrement au lieu de produire silencieusement un mauvais secret.
 */

const ALGORITHM = 'aes-256-gcm';
const KEY_LENGTH = 32;
const IV_LENGTH = 12; // 96 bits, taille recommandée pour GCM
const ENVELOPE_PREFIX = 'v1';

/**
 * Clé dédiée si TWO_FACTOR_ENCRYPTION_KEY est fournie, sinon dérivée de JWT_SECRET par HKDF.
 *
 * La dérivation évite d'imposer une variable d'environnement de plus — mais elle lie les deux
 * secrets : changer JWT_SECRET rendrait les secrets 2FA existants indéchiffrables, et les
 * utilisateurs concernés perdraient l'accès à leur compte. Une installation qui prévoit de
 * faire tourner ses secrets doit donc renseigner TWO_FACTOR_ENCRYPTION_KEY, qui est alors
 * indépendante (voir .env.example).
 *
 * Non mise en cache : les tests changent l'environnement entre deux cas, et le coût d'un HKDF
 * est négligeable devant celui d'une vérification TOTP.
 */
function encryptionKey(): Buffer {
  const dedicated = process.env.TWO_FACTOR_ENCRYPTION_KEY;
  if (dedicated) {
    return Buffer.from(hkdfSync('sha256', dedicated, '', 'boutikpro:2fa', KEY_LENGTH));
  }

  const jwtSecret = process.env.JWT_SECRET;
  if (!jwtSecret) {
    throw new Error(
      'Impossible de chiffrer les secrets : ni TWO_FACTOR_ENCRYPTION_KEY ni JWT_SECRET ne sont définis.',
    );
  }
  return Buffer.from(hkdfSync('sha256', jwtSecret, '', 'boutikpro:2fa', KEY_LENGTH));
}

/** Chiffre une valeur. Le résultat porte son préfixe de version, ce qui rend le format évolutif. */
export function encryptSecret(plaintext: string): string {
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, encryptionKey(), iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();

  return [
    ENVELOPE_PREFIX,
    iv.toString('base64'),
    authTag.toString('base64'),
    ciphertext.toString('base64'),
  ].join(':');
}

/**
 * Déchiffre une valeur produite par `encryptSecret`.
 *
 * Une valeur sans enveloppe est rendue telle quelle : ce sont les secrets enregistrés en clair
 * avant l'introduction du chiffrement. Ils restent donc utilisables, et sont automatiquement
 * remplacés par une version chiffrée à la prochaine écriture — pas de migration de données à
 * orchestrer, pas d'utilisateur enfermé dehors le jour du déploiement.
 */
export function decryptSecret(stored: string): string {
  if (!isEncrypted(stored)) {
    return stored;
  }

  const [, ivPart, tagPart, dataPart] = stored.split(':');
  const decipher = createDecipheriv(ALGORITHM, encryptionKey(), Buffer.from(ivPart, 'base64'));
  decipher.setAuthTag(Buffer.from(tagPart, 'base64'));

  return Buffer.concat([
    decipher.update(Buffer.from(dataPart, 'base64')),
    decipher.final(),
  ]).toString('utf8');
}

/** Vrai si la valeur porte l'enveloppe de chiffrement (par opposition à un secret hérité en clair). */
export function isEncrypted(stored: string): boolean {
  return stored.startsWith(`${ENVELOPE_PREFIX}:`) && stored.split(':').length === 4;
}

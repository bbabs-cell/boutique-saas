import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { decryptSecret, encryptSecret, isEncrypted } from './secret-encryption';

const ORIGINAL_JWT = process.env.JWT_SECRET;
const ORIGINAL_KEY = process.env.TWO_FACTOR_ENCRYPTION_KEY;

describe('secret-encryption', () => {
  beforeEach(() => {
    process.env.JWT_SECRET = 'un-secret-de-test-suffisamment-long-pour-hkdf';
    delete process.env.TWO_FACTOR_ENCRYPTION_KEY;
  });

  afterEach(() => {
    process.env.JWT_SECRET = ORIGINAL_JWT;
    if (ORIGINAL_KEY === undefined) delete process.env.TWO_FACTOR_ENCRYPTION_KEY;
    else process.env.TWO_FACTOR_ENCRYPTION_KEY = ORIGINAL_KEY;
  });

  it('rend la valeur d’origine après un aller-retour', () => {
    const secret = 'JBSWY3DPEHPK3PXP';
    expect(decryptSecret(encryptSecret(secret))).toBe(secret);
  });

  it('ne laisse pas le secret en clair dans la valeur stockée', () => {
    const stored = encryptSecret('JBSWY3DPEHPK3PXP');

    expect(stored).not.toContain('JBSWY3DPEHPK3PXP');
    expect(isEncrypted(stored)).toBe(true);
  });

  it('produit un chiffré différent à chaque appel (IV aléatoire)', () => {
    const a = encryptSecret('JBSWY3DPEHPK3PXP');
    const b = encryptSecret('JBSWY3DPEHPK3PXP');

    expect(a).not.toBe(b);
    expect(decryptSecret(a)).toBe(decryptSecret(b));
  });

  it('détecte une valeur altérée au lieu de rendre un mauvais secret', () => {
    const stored = encryptSecret('JBSWY3DPEHPK3PXP');
    const [version, iv, tag] = stored.split(':');
    const corrompu = [version, iv, tag, Buffer.from('autre-chose').toString('base64')].join(':');

    expect(() => decryptSecret(corrompu)).toThrow();
  });

  it('laisse passer un secret hérité stocké en clair', () => {
    // Cas des secrets enregistrés avant l'introduction du chiffrement : ils doivent rester
    // utilisables, sinon le déploiement enfermerait dehors tous les utilisateurs 2FA.
    expect(decryptSecret('JBSWY3DPEHPK3PXP')).toBe('JBSWY3DPEHPK3PXP');
    expect(isEncrypted('JBSWY3DPEHPK3PXP')).toBe(false);
  });

  it('utilise la clé dédiée quand elle est fournie', () => {
    process.env.TWO_FACTOR_ENCRYPTION_KEY = 'une-cle-dediee-bien-distincte-du-jwt';
    const stored = encryptSecret('JBSWY3DPEHPK3PXP');

    expect(decryptSecret(stored)).toBe('JBSWY3DPEHPK3PXP');

    // Sans la clé dédiée, la valeur n'est plus déchiffrable : les deux clés sont bien distinctes.
    delete process.env.TWO_FACTOR_ENCRYPTION_KEY;
    expect(() => decryptSecret(stored)).toThrow();
  });

  it('échoue clairement si aucune clé n’est disponible', () => {
    delete process.env.JWT_SECRET;

    expect(() => encryptSecret('x')).toThrow(/TWO_FACTOR_ENCRYPTION_KEY|JWT_SECRET/);
  });
});

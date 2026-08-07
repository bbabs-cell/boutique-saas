import { describe, it, expect } from 'vitest';
import { validateEnv, PLACEHOLDER_JWT_SECRET } from './env.validation';

const VALID_SECRET = 'x'.repeat(48);
const VALID_ENV = {
  DATABASE_URL: 'postgresql://postgres:postgres@localhost:5432/boutique_saas',
  JWT_SECRET: VALID_SECRET,
};

describe('validateEnv', () => {
  it('accepte une configuration complète', () => {
    expect(() => validateEnv({ ...VALID_ENV })).not.toThrow();
  });

  it('refuse une configuration sans JWT_SECRET', () => {
    expect(() => validateEnv({ DATABASE_URL: VALID_ENV.DATABASE_URL })).toThrow(/JWT_SECRET/);
  });

  it("refuse la valeur d'exemple publiée dans le dépôt", () => {
    expect(() => validateEnv({ ...VALID_ENV, JWT_SECRET: PLACEHOLDER_JWT_SECRET })).toThrow(
      /valeur d'exemple/,
    );
  });

  it('refuse un secret trop court pour être sérieux', () => {
    expect(() => validateEnv({ ...VALID_ENV, JWT_SECRET: 'trop-court' })).toThrow(/32 caractères/);
  });

  it('refuse une configuration sans DATABASE_URL', () => {
    expect(() => validateEnv({ JWT_SECRET: VALID_SECRET })).toThrow(/DATABASE_URL/);
  });

  it('applique les valeurs par défaut des variables optionnelles', () => {
    const config = validateEnv({ ...VALID_ENV });

    expect(config.JWT_EXPIRES_IN).toBe('7d');
    expect(config.PORT).toBe(3001);
  });

  it('conserve les variables non décrites par le schéma', () => {
    const config = validateEnv({ ...VALID_ENV, SUPABASE_URL: 'https://exemple.supabase.co' });

    expect(config.SUPABASE_URL).toBe('https://exemple.supabase.co');
  });

  it('signale toutes les variables fautives en une fois', () => {
    expect(() => validateEnv({})).toThrow(/DATABASE_URL[\s\S]*JWT_SECRET/);
  });
});

import eslint from '@eslint/js';
import tseslint from 'typescript-eslint';

/**
 * Configuration volontairement resserrée : elle vise les erreurs réelles, pas le style.
 * Le formatage n'est pas arbitré ici — un lint qui crie sur des virgules finit par être
 * ignoré, y compris quand il signale un vrai problème.
 */
export default tseslint.config(
  { ignores: ['dist/**', 'node_modules/**', 'prisma/**'] },

  eslint.configs.recommended,
  ...tseslint.configs.recommended,

  {
    languageOptions: {
      parserOptions: { ecmaVersion: 2022, sourceType: 'module' },
    },
    rules: {
      // Les `any` sont assumés à quelques endroits (typages de bibliothèques, mocks de test) :
      // un avertissement les rend visibles sans bloquer la construction.
      '@typescript-eslint/no-explicit-any': 'warn',

      // Un argument inutilisé préfixé d'un underscore est une intention, pas un oubli.
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_', caughtErrors: 'none' },
      ],

      // Une promesse non attendue dans un service est presque toujours un bug — sauf quand
      // elle est explicitement détachée (les `.catch(() => {})` de journalisation le sont).
      'no-console': 'off',
    },
  },

  {
    // Les tests manipulent des objets partiels et des mocks : y exiger un typage complet
    // rendrait les fichiers illisibles sans rien apporter.
    files: ['**/*.spec.ts'],
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-unsafe-function-type': 'off',
    },
  },
);

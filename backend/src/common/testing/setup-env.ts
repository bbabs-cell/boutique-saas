/**
 * Chargé avant chaque fichier de test (voir `setupFiles` dans vitest.config.ts).
 *
 * Certains modules ont besoin d'une configuration minimale pour fonctionner — le chiffrement
 * des secrets dérive sa clé de JWT_SECRET, par exemple. Fournir ces valeurs ici évite de les
 * répéter dans chaque fichier de test, et garantit qu'un test ne dépend jamais de la
 * configuration réelle de la machine qui l'exécute.
 */
process.env.JWT_SECRET ??= 'secret-de-test-uniquement-suffisamment-long-pour-hkdf';

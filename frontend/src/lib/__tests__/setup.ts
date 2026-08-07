// IndexedDB n'existe pas sous Node : cette importation en installe une implémentation
// complète en mémoire, ce qui permet de tester la file de ventes hors-ligne à travers Dexie
// exactement comme elle tourne dans le navigateur — transactions et index compris.
import 'fake-indexeddb/auto';

// `crypto.randomUUID` est utilisé pour identifier chaque vente créée hors-ligne.
if (!globalThis.crypto) {
  globalThis.crypto = (await import('crypto')).webcrypto as Crypto;
}

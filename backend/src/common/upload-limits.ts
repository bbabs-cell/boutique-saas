/**
 * Tailles maximales des fichiers acceptés en upload.
 *
 * Ces valeurs servent à deux endroits qui doivent rester d'accord :
 *  - `FileInterceptor(..., { limits: { fileSize } })`, qui coupe la lecture du flux dès le
 *    dépassement — c'est la seule barrière qui empêche un fichier de 500 Mo d'être entièrement
 *    chargé en mémoire avant d'être refusé ;
 *  - la vérification applicative dans le service, qui produit un message clair pour l'utilisateur.
 *
 * D'où leur définition ici plutôt qu'en double dans chaque module.
 */
export const MAX_LOGO_SIZE_BYTES = 2 * 1024 * 1024; // 2 Mo

export const MAX_CATALOG_IMPORT_SIZE_BYTES = 5 * 1024 * 1024; // 5 Mo

/** Un seul fichier par requête : aucun de ces endpoints n'en attend plusieurs. */
export const SINGLE_FILE_UPLOAD = 1;

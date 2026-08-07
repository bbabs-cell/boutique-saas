# BoutikPro — V1 (Sprints 1-4) + V2 (Sprints 5-7) + V3 (Sprints 8-11) + V4 complète (Sprints 12-13)

SaaS de gestion de boutique pour les commerces d'Afrique de l'Ouest (priorité Mali). **Projet complet — les 13 sprints du prompt initial sont livrés.**

- **Sprint 1** : authentification, gestion des employés (ADMIN/CAISSIER), gestion des produits
- **Sprint 2** : caisse — panier, remise, TVA optionnelle, paiements combinés (espèces/Orange Money/Moov Money/carte), décrément du stock, reçu imprimable, historique des ventes
- **Sprint 3** : ajustements de stock avec historique, alertes de stock faible, fiches clients, vente à crédit avec plafond, règlement de dette
- **Sprint 4 (fin de la V1)** : tableau de bord avec les vrais chiffres, rapports de ventes filtrables + export PDF, paramètres de la boutique (nom, logo, devise, TVA, langue)
- **Sprint 5 (début V2)** : fournisseurs, commandes d'achat et réception (incrémente le stock, met à jour le coût produit, augmente la dette fournisseur)
- **Sprint 6 (V2)** : rôles fins (MANAGER, MAGASINIER en plus d'ADMIN/CAISSIER) avec permissions différenciées sur tous les modules, dépenses générales, vue comptable (recettes/dépenses/pertes/bénéfice net/trésorerie)
- **Sprint 7 (fin de la V2)** : notifications (stock faible/rupture/paiement reçu), export/import Excel du catalogue produits, export Excel des rapports de vente
- **Sprint 8 (V3 — le plus lourd du projet)** : multi-boutique — stock propre à chaque boutique (`Inventory`), employés assignés à une ou plusieurs boutiques, sélecteur de boutique, vue "toutes boutiques" pour l'ADMIN
- **Sprint 9 (V3)** : abonnements SaaS — plans (Gratuit/Starter/Business/Premium), limites vérifiées (boutiques, produits, rôles fins, comptabilité), historique de factures, notification avant expiration
- **Sprint 10 (V3)** : 2FA optionnel par utilisateur (TOTP + QR code), journal d'audit des actions de création/modification/suppression (intercepteur générique, pas d'instrumentation manuelle par endpoint)
- **Sprint 11 (fin de la V3)** : API publique `/api/v1` en lecture seule (produits/ventes/stock) authentifiée par clé API, rate limiting dédié, documentation Swagger séparée, webhooks (`sale.created`, `stock.low`) signés en HMAC-SHA256
- **Sprint 12 (V4 — le plus délicat techniquement)** : PWA installable, caisse fonctionnelle hors-ligne (catalogue en cache IndexedDB, ventes mises en file locale), synchronisation automatique au retour du réseau avec détection de conflits (ex. stock insuffisant redécouvert à la synchro)
- **Sprint 13 (fin de la V4, optionnel)** : API GraphQL en lecture seule (`/graphql`), mêmes ressources et même authentification par clé API que l'API REST publique — alternative pour les intégrations qui le demandent explicitement, sans dupliquer la logique de requête

Hors périmètre : l'intégration réelle du paiement des abonnements (encaissement mobile money) reste à brancher — le Sprint 9 pose la structure (facture créée non payée) sans l'encaisser, l'activation se fait par confirmation manuelle de l'opérateur. L'API publique est en lecture seule pour l'instant (pas d'écriture).

## Structure

```
boutique-saas/
├── backend/    # NestJS + Prisma + PostgreSQL
└── frontend/   # Next.js 15 + Tailwind CSS
```

## Démarrage — Backend

```bash
cd backend
cp .env.example .env        # renseigner DATABASE_URL, JWT_SECRET, SUPABASE_URL et SUPABASE_SERVICE_ROLE_KEY
npm install
```

### ⚠️ Migration du Sprint 8 (multi-boutique) — particulière

Ce sprint retire `Product.stock` (remplacé par `Inventory`) et ajoute des colonnes `storeId` obligatoires sur des tables déjà peuplées. `npx prisma migrate dev` seul ne sait pas gérer ce genre de changement avec des données existantes.

**Si ta base est une base de test/démo (recommandé pour ce projet)**, le plus simple est de tout réinitialiser :
```bash
npx prisma migrate reset      # supprime tout, réapplique les migrations, relance le seed automatiquement
```
Confirme quand c'est demandé. C'est plus rapide et plus fiable qu'une migration de données pour une base qui ne contient que du seed.

**Si tu dois préserver des données réelles**, utilise le script SQL manuel fourni :
```bash
npx prisma migrate dev --create-only --name add_multi_store
# Remplace tout le contenu du fichier migration.sql généré par celui de :
#   backend/prisma/manual-migration-multi-store.sql
npx prisma migrate dev
npx prisma db seed
```

Puis dans tous les cas :
```bash
npm run start:dev           # http://localhost:3001/api
```

### Migration du Sprint 9 (abonnements) — normale

Contrairement au Sprint 8, cette migration n'ajoute que des tables nouvelles (`subscriptions`, `invoices`) et une relation optionnelle sur `Tenant` — pas de colonne obligatoire sur des tables déjà peuplées. Une migration classique suffit :
```bash
npx prisma migrate dev --name add_subscriptions
```

### Migration du Sprint 10 (2FA + journal d'audit) — normale

Là aussi, uniquement des colonnes optionnelles/avec valeur par défaut (`twoFactorSecret`, `twoFactorEnabled`) et une nouvelle table (`audit_logs`) :
```bash
npx prisma migrate dev --name add_2fa_audit_log
```

### Migration du Sprint 11 (API publique + webhooks) — normale

Uniquement deux nouvelles tables (`api_keys`, `webhooks`), aucune colonne obligatoire sur des tables existantes :
```bash
npx prisma migrate dev --name add_api_keys_webhooks
```

La documentation de l'API publique est disponible sur `http://localhost:3001/api/docs` une fois le backend démarré.

### Migration du Sprint 12 (mode hors-ligne) — normale

Un seul changement de schéma : `Sale.clientId` (nullable, unique) pour la déduplication des ventes synchronisées depuis le mode hors-ligne. Migration additive standard :
```bash
npx prisma migrate dev --name add_offline_sync
```

### Sprint 13 (GraphQL) — aucune migration

Ce sprint ne touche pas au schéma Prisma : il expose en lecture seule les mêmes données que l'API REST publique, via `/graphql`. Un fichier `schema.gql` est généré automatiquement à la racine du dossier `backend` au premier démarrage (code-first) — c'est normal, il n'a pas besoin d'être commité (déjà ajouté au `.gitignore`).

### Migration « stock jamais négatif » — normale, mais écrite à la main

Cette migration pose une contrainte `CHECK ("stock" >= 0)` sur la table `inventory`, en filet de sécurité contre la survente (la course elle-même est empêchée par un verrou de ligne dans `SalesService.create`). Prisma ne sait pas exprimer les contraintes `CHECK` dans `schema.prisma` : le fichier SQL est donc écrit directement, et `schema.prisma` reste inchangé.

```bash
npx prisma migrate deploy    # applique la migration telle quelle
```

Si ta base contient déjà des stocks négatifs (séquelle d'une survente passée), la migration les ramène à 0 avant de poser la contrainte — le stock physique ne peut pas être inférieur à zéro, et les mouvements de stock gardent la trace de ce qui s'est produit.


L'upload de logo (`POST /settings/logo`) nécessite un projet Supabase avec un bucket de stockage nommé `logos` (public en lecture) et une clé de service (`SUPABASE_SERVICE_ROLE_KEY`) — sans ces variables, l'upload échoue proprement avec un message d'erreur explicite, le reste de l'application fonctionne normalement.

Comptes de test créés par le seed (mot de passe commun : `Password123!`) :
- ADMIN : `admin@boutique-demo.ml` (accès à toutes les boutiques)
- MANAGER : `manager@boutique-demo.ml` (accès à Bamako + Sikasso → verra le sélecteur de boutique à la connexion)
- CAISSIER : `caissier@boutique-demo.ml` (accès à Bamako uniquement → connexion directe)
- MAGASINIER : `magasinier@boutique-demo.ml` (accès à Sikasso uniquement → connexion directe)

Autres données de démo :
- Deux boutiques (Bamako, Sikasso) avec des stocks différents pour les mêmes produits
- Boutique avec TVA activée à 18% (pour tester l'affichage TVA en caisse)
- Un produit avec un seuil d'alerte à 5 et un stock de 2 à Bamako (visible dans les alertes de `/stock`)
- Un client de démo « Fatoumata Diarra » avec un plafond de crédit de 20 000 FCFA

Lancer les tests :
```bash
npm test                 # tests unitaires — aucune dépendance externe
npm run lint             # ESLint
npm run test:integration # tests d'intégration — nécessitent une base PostgreSQL migrée
```

Les tests d'intégration parlent à une vraie base : ils valident ce qu'un Prisma simulé ne peut pas
prouver — l'isolation entre organisations, le comportement réel des transactions et des verrous
(notamment la protection contre la survente en caisse), et les contraintes posées en base.

```bash
export DATABASE_URL="postgresql://postgres:postgres@localhost:5432/boutique_saas_test?schema=public"
npx prisma migrate deploy
npm run test:integration
```

## Déploiement

Backend sur **Railway**, frontend sur **Vercel**, PostgreSQL managé par Railway.

### 1. Base de données

Dans le projet Railway : **New → Database → PostgreSQL**. Railway expose alors une variable
`DATABASE_URL` que le service backend peut référencer directement.

### 2. Service backend

**New → GitHub Repo**, puis dans *Settings → Source* régler **Root Directory** sur `backend`.
C'est indispensable : sans cela Railway lit la racine du dépôt, n'y trouve pas de `package.json`
et le build échoue immédiatement. Le reste (build, migrations, healthcheck) est décrit dans
`backend/railway.toml` et ne demande aucune configuration manuelle.

Variables à renseigner dans *Variables* :

| Variable | Valeur | Obligatoire |
|---|---|---|
| `DATABASE_URL` | connexion de l'application (voir ci-dessous) | oui |
| `DIRECT_URL` | connexion directe, pour les migrations | seulement derrière un pooler |
| `JWT_SECRET` | `openssl rand -base64 48` | oui |
| `CORS_ORIGINS` | l'URL Vercel du frontend, ex. `https://boutikpro.vercel.app` | oui en pratique |
| `NODE_ENV` | `production` | oui |
| `PLATFORM_ADMIN_SECRET` | `openssl rand -base64 48` | pour activer les plans payants |
| `TWO_FACTOR_ENCRYPTION_KEY` | `openssl rand -base64 48` | recommandé |
| `SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY` | projet Supabase | pour l'upload de logo |

Le build est décrit dans `backend/railway.toml` et n'a pas besoin d'être touché. Deux détails y
sont volontairement contre-intuitifs, et les « corriger » casserait le déploiement : `npm install`
plutôt que `npm ci` (Railway monte un cache dans `node_modules`, que `npm ci` tente de supprimer —
`EBUSY`), et `--include=dev` (Railway impose `NODE_ENV=production`, qui priverait le build de
`nest` et `typescript`). La vérification du lockfile reste assurée par la CI GitHub, qui exécute
`npm ci` sur chaque PR.

#### Si ta base est derrière un pooler (Supabase, PgBouncer…)

C'est le cas le plus fréquent, et il demande **deux** connexions distinctes — sans quoi les
migrations échouent sur `FATAL: (EMAXCONNSESSION) max clients reached in session mode`, et
l'application renvoie des 500 dès qu'un peu de trafic arrive.

| Variable | Port Supabase | Rôle |
|---|---|---|
| `DATABASE_URL` | **6543** (mode transaction) + `?pgbouncer=true&connection_limit=1` | trafic applicatif |
| `DIRECT_URL` | **5432** (mode session) | migrations uniquement |

La raison : le moteur de schéma de Prisma a besoin d'une vraie session PostgreSQL (verrous
consultatifs, transactions longues) que le mode transaction ne sait pas fournir. À l'inverse, le
mode transaction est le seul qui permette de servir beaucoup de requêtes simultanées avec peu de
connexions réelles. Pointer les deux sur le port 5432 fait se disputer les migrations et le
trafic pour les mêmes quelques places.

`DIRECT_URL` est **optionnelle** : non définie, les migrations empruntent simplement `DATABASE_URL`,
ce qui convient à toute base sans pooler. Une variable oubliée ne peut donc pas bloquer un déploiement.

Si les migrations échouent sur `Could not parse schema engine response` ou sur un plantage du moteur
de schéma, la cause est presque toujours une chaîne `DIRECT_URL` invalide — un `[YOUR-PASSWORD]`
laissé tel quel, ou un caractère spécial non encodé (`@` → `%40`, `#` → `%23`). Vérifie-la avec
`psql "<ta-chaine>" -c "select 1"` avant de la coller dans l'hébergeur.

Trois pièges qui coûtent du temps :

- **Le serveur refuse de démarrer** si `JWT_SECRET` manque ou vaut encore la valeur d'exemple du
  dépôt. C'est voulu — il vaut mieux un déploiement qui échoue bruyamment qu'un service qui
  signe ses jetons avec un secret public. Le message de démarrage dit quelle variable corriger.
- **`CORS_ORIGINS` non renseignée** fait retomber l'API sur `http://localhost:3000` : le frontend
  déployé sera bloqué par le navigateur, avec une erreur CORS et aucune trace côté serveur.
- **`NODE_ENV=production`** désactive l'introspection GraphQL. Sans elle, le schéma complet de
  l'API reste exposé publiquement.

Les migrations tournent automatiquement avant chaque bascule (`preDeployCommand`) : un échec
annule le déploiement et laisse la version précédente en ligne.

Le seed n'est pas joué en production. Pour amorcer une vraie boutique, créer le premier compte
via `POST /api/auth/register`, qui crée l'organisation, sa boutique et son administrateur.

### 3. Frontend sur Vercel

Root Directory : `frontend`. Une seule variable :

| Variable | Valeur |
|---|---|
| `NEXT_PUBLIC_API_URL` | l'URL Railway du backend suivie de `/api`, ex. `https://boutikpro-api.up.railway.app/api` |

Cette variable est lue au **build**, pas à l'exécution : la modifier impose de relancer un
déploiement pour qu'elle prenne effet.

### 4. Vérifier

```bash
curl https://<backend>/api/health      # {"status":"ok","database":"ok"}
```

Cette route est aussi celle qu'interroge Railway : elle renvoie `503` si la base est injoignable,
ce qui empêche une version cassée de remplacer une version saine.

## Démarrage — Frontend

```bash
cd frontend
cp .env.local.example .env.local   # NEXT_PUBLIC_API_URL doit pointer vers le backend
npm install
npm run dev                        # http://localhost:3000
```

### Sprint 12 (PWA + hors-ligne) — points d'attention

- Le service worker (`public/sw.js`) ne s'active qu'en HTTPS ou sur `localhost` — normal en développement, mais à garder en tête pour un déploiement (HTTPS obligatoire en production pour que le PWA fonctionne).
- **Le cache local ne se remplit qu'après une première visite de `/caisse` en ligne** avec une boutique active sélectionnée : c'est ce moment qui appelle `GET /sync/bootstrap` et amorce IndexedDB. Sans ce premier passage en ligne, couper le réseau ne montrera pas de catalogue en cache (comportement normal, pas un bug).
- Pour vraiment tester le mode hors-ligne : dans les DevTools du navigateur → onglet **Réseau/Network** → cocher **Offline** (plus fiable que de débrancher le Wi-Fi, et ne coupe pas les DevTools eux-mêmes).
- Les icônes PWA (`public/icons/icon-192.png`, `icon-512.png`) sont des placeholders générés automatiquement (carré vert avec un "B") — à remplacer par un vrai logo avant mise en production.

## Scénario de vérification du sprint

1. Aller sur `/register`, créer une boutique + compte admin
2. Être redirigé vers `/dashboard`
3. Aller sur `/produits`, ajouter un produit (avec/sans code-barres, avec/sans catégorie)
4. Modifier et supprimer (soft delete) ce produit
5. Aller sur `/parametres/employes` (visible seulement pour un ADMIN), ajouter un caissier
6. Se déconnecter, se reconnecter avec le compte caissier créé → vérifier que `/parametres/employes` n'est pas accessible
7. Aller sur `/caisse`, scanner/rechercher un produit, l'ajouter au panier, appliquer une remise
8. Vérifier que la TVA s'affiche (compte de démo : 18%)
9. Encaisser en combinant espèces + Orange Money → vérifier la redirection vers le reçu
10. Vérifier que le stock du produit a été décrémenté sur `/produits`
11. Aller sur `/ventes` → la vente doit apparaître ; l'ouvrir et vérifier le reçu (bouton Imprimer)
12. En tant qu'ADMIN, annuler la vente depuis sa page de détail → vérifier que le stock est remis à jour
13. Aller sur `/stock` → le « Produit en alerte » du seed doit apparaître dans les alertes de stock faible
14. Ajuster manuellement le stock d'un produit (entrée ou sortie) → vérifier qu'il apparaît dans l'historique des mouvements
15. Aller sur `/clients`, ouvrir la fiche « Fatoumata Diarra »
16. Depuis `/caisse`, sélectionner ce client, encaisser une partie en « Crédit » → vérifier que la dette du client augmente sur sa fiche
17. Depuis la fiche client, enregistrer un règlement partiel → vérifier que la dette diminue
18. Tenter une vente à crédit qui dépasserait le plafond du client → doit être refusée
19. Aller sur `/dashboard` → vérifier que les cartes CA/ventes/bénéfice/stock faible et le graphique reflètent les ventes déjà effectuées
20. Aller sur `/rapports`, changer de période (jour/semaine/mois/année/personnalisée) et filtrer par vendeur/produit/catégorie
21. Exporter le rapport en PDF → vérifier que le fichier se télécharge et contient le résumé + le détail des ventes
22. Aller sur `/parametres` (ADMIN uniquement), modifier le nom, la devise, la TVA et la langue → vérifier l'enregistrement
23. Téléverser un logo → vérifier qu'il s'affiche (nécessite un bucket Supabase Storage configuré)
24. `/fournisseurs` → créer un fournisseur
25. `/achats/nouveau` → créer une commande (fournisseur + produits + quantités + coûts), en statut « Commandée »
26. Ouvrir la commande, cliquer « Marquer comme reçue »
27. Vérifier sur `/produits` que le stock a augmenté et que le coût du produit a été mis à jour
28. Vérifier sur `/stock` que le mouvement `RESTOCK` apparaît dans l'historique
29. Vérifier sur la fiche du fournisseur que son solde dû a augmenté du montant total de la commande
30. Enregistrer un règlement partiel au fournisseur → vérifier que son solde diminue
31. Se déconnecter, se connecter avec `caissier@boutique-demo.ml` → vérifier que Tableau de bord, Stock, Achats, Fournisseurs, Rapports, Dépenses, Comptabilité et Paramètres sont invisibles dans la sidebar et inaccessibles par URL directe (redirection automatique)
32. Toujours en caissier → vérifier qu'il peut encaisser en caisse et consulter les clients, mais pas créer de produit ni ajuster le stock
33. Se connecter avec `magasinier@boutique-demo.ml` → vérifier l'inverse : accès à Produits/Stock/Achats/Fournisseurs, mais pas à Caisse ni Clients
34. Se connecter avec `manager@boutique-demo.ml` → vérifier l'accès à tout sauf Dépenses/Comptabilité/Paramètres boutique ; sur `/parametres/employes`, vérifier que le rôle « Administrateur » n'apparaît pas dans la liste des rôles assignables
35. En ADMIN, aller sur `/depenses`, ajouter une dépense (ex : loyer, 50 000 FCFA)
36. Aller sur `/comptabilite` → vérifier que les recettes/dépenses/pertes/bénéfice net/trésorerie reflètent les ventes et dépenses de test effectuées plus haut
37. Ajuster manuellement un produit pour faire passer son stock sous son seuil → vérifier qu'une notification apparaît (badge sur la cloche, puis dans `/notifications`)
38. Enregistrer un règlement client → vérifier qu'une notification « Paiement reçu » apparaît
39. Marquer une notification comme lue individuellement, puis utiliser « Tout marquer comme lu »
40. Sur `/produits`, cliquer « Exporter » → vérifier le téléchargement du fichier Excel
41. Modifier une valeur dans le fichier téléchargé (ex : le stock d'un produit), puis « Importer » ce même fichier → vérifier qu'aucun doublon n'est créé (le produit existant est mis à jour, pas dupliqué) et que le résumé affiché correspond
42. Sur `/rapports`, cliquer « Exporter en Excel » → vérifier le téléchargement et les deux feuilles (Résumé, Ventes)
43. Se connecter avec `manager@boutique-demo.ml` → un sélecteur de boutique doit apparaître (accès à Bamako + Sikasso) ; choisir Bamako
44. Sur `/produits`, vérifier que le stock affiché correspond à celui de Bamako (25 pour « Produit exemple ») — différent de celui de Sikasso (8)
45. Depuis la sidebar, changer de boutique pour Sikasso → vérifier que le stock affiché change bien (8, pas 25)
46. Encaisser une vente à Sikasso → vérifier que le stock de Sikasso diminue et que celui de Bamako reste inchangé
47. Se connecter avec `caissier@boutique-demo.ml` (accès à Bamako uniquement) → vérifier qu'il n'y a **pas** de sélecteur de boutique (connexion directe)
48. Se connecter en ADMIN, ouvrir le sélecteur de boutique → choisir « Toutes les boutiques » → vérifier que `/dashboard` agrège les deux boutiques
49. Toujours en ADMIN, aller sur `/parametres/boutiques` → créer une troisième boutique, y assigner un employé, puis retirer l'assignation
50. Aller sur `/parametres/abonnement` → le plan actuel doit être « Premium » (seul palier incluant toutes les fonctionnalités livrées, dont l'API publique)
51. Rétrograder vers le plan « Gratuit »
52. Tenter de créer une nouvelle boutique (`/parametres/boutiques`) → doit être refusé (limite de 1 boutique sur le plan Gratuit, déjà dépassée avec Bamako + Sikasso)
53. Tenter de créer un employé MANAGER ou MAGASINIER (`/parametres/employes`) → doit être refusé (rôles fins non inclus dans le plan Gratuit)
54. Aller sur `/depenses` ou `/comptabilite` → doit être refusé (fonctionnalité non incluse dans le plan Gratuit)
55. Repasser au plan « Premium » → vérifier que les actions précédentes redeviennent possibles
56. Vérifier qu'une facture non payée est apparue dans l'historique de facturation à chaque changement vers un plan payant
57. (Optionnel, sans attendre un vrai cron) Pour tester la notification d'expiration sans attendre : modifie manuellement `expiresAt` d'une ligne dans la table `subscriptions` pour qu'elle soit dans 3 jours, puis appelle `notifyExpiringSoon()` — par exemple en ajoutant temporairement un endpoint de debug, ou attends l'exécution quotidienne réelle du cron
58. Aller sur `/parametres/securite`, cliquer « Activer le 2FA », scanner le QR code avec Google Authenticator ou Authy, saisir le code affiché
59. Se déconnecter, se reconnecter avec le même compte → une étape de code doit être demandée après le mot de passe, avant d'accéder à l'application
60. Entrer un code incorrect → doit être refusé ; entrer le bon code → connexion réussie
61. Désactiver le 2FA depuis `/parametres/securite` (confirmation par mot de passe) → se reconnecter ne doit plus demander de code
62. En ADMIN, modifier un produit (`/produits/[id]`) → aller sur `/parametres/journal-audit` → une entrée `products.update` doit apparaître avec l'employé, la date et un aperçu des champs modifiés
63. Filtrer le journal par employé, puis par type d'entité (ex : `products`) → vérifier que les résultats se filtrent correctement
64. Vérifier qu'une simple consultation (GET) n'apparaît jamais dans le journal — seules les créations/modifications/suppressions y figurent
65. En ADMIN, aller sur `/parametres/developpeurs` → générer une clé API → copier la clé affichée (elle ne sera plus jamais visible ensuite)
66. Depuis un terminal ou Postman, appeler `GET http://localhost:3001/api/v1/products` avec l'en-tête `X-API-Key: <clé copiée>` → doit retourner le catalogue paginé
67. Révoquer la clé depuis `/parametres/developpeurs`, puis refaire le même appel → doit être refusé (401)
68. Créer un webhook sur l'événement `sale.created` pointant vers une URL de test (ex. https://webhook.site) → copier le secret affiché
69. Encaisser une vente depuis `/caisse` → vérifier que le point de test reçoit bien un appel HTTP POST avec un en-tête `X-Webhook-Signature`
70. (Optionnel) Vérifier la signature reçue : HMAC-SHA256 du corps de la requête avec le secret du webhook doit correspondre à l'en-tête `X-Webhook-Signature`
71. Ouvrir `http://localhost:3001/api/docs` → vérifier que seule l'API publique v1 y est documentée (pas les routes internes de l'application)
72. Envoyer une trentaine de requêtes rapprochées vers `/api/v1/products` avec une clé valide → au-delà de 60 requêtes/minute, une erreur 429 doit apparaître
73. Aller sur `/caisse` **en ligne** au moins une fois (amorce le cache local IndexedDB automatiquement en arrière-plan)
74. Ouvrir les DevTools → onglet Réseau → cocher **Offline** → l'indicateur dans la sidebar doit passer sur "Hors-ligne"
75. Toujours hors-ligne, sur `/caisse` : rechercher un produit (doit venir du cache local), l'ajouter au panier, encaisser → un message "Vente enregistrée hors-ligne" doit apparaître, et le compteur de la sidebar doit passer à 1
76. Décocher Offline dans les DevTools → la synchronisation doit se déclencher automatiquement (sans rien cliquer) → le compteur doit revenir à 0
77. Vérifier sur `/ventes` que la vente hors-ligne apparaît bien, avec le bon montant et le bon produit
78. Provoquer volontairement un conflit : repasser hors-ligne, vendre plus d'unités d'un produit que son stock en cache ne le permet en forçant plusieurs ventes hors-ligne successives du même produit (le cache local décrémente en local mais reste optimiste), puis reconnecter → sur `/caisse/synchronisation`, la vente en trop doit apparaître en **conflit** avec la raison exacte (stock insuffisant), pas silencieusement ignorée ni acceptée à tort
79. Sur cet écran, tester "Abandonner" (la vente disparaît définitivement) et "Réessayer" (repasse en attente, retentée à la prochaine synchro)
80. Vérifier que l'app est installable : dans Chrome, une icône d'installation doit apparaître dans la barre d'adresse (ou proposer "Ajouter à l'écran d'accueil" sur mobile)
81. Ouvrir `http://localhost:3001/api/graphql` dans le navigateur → l'explorateur (Apollo Sandbox) doit s'afficher
82. Sans clé API, exécuter la requête suivante → doit être refusée (401) :
    ```graphql
    query { products(page: 1, pageSize: 5) { items { id name price } total } }
    ```
    Dans Apollo Sandbox, ajouter l'en-tête `X-API-Key` (panneau "Headers" en bas) avec une clé valide générée sur `/parametres/developpeurs`, puis relancer la requête → doit maintenant renvoyer les produits
83. Comparer le résultat avec l'équivalent REST (`GET /api/v1/products?page=1&pageSize=5` avec la même clé) → les mêmes produits doivent apparaître, aux mêmes champs près
84. Tester aussi `sales` et `stock` en GraphQL avec la même clé → cohérent avec leurs équivalents REST

## Important — limite de l'environnement où ce code a été généré

Le code a été écrit dans un environnement **sans accès réseau** : je n'ai pas pu exécuter `npm install`, `prisma migrate` ni `npm test` pour vérifier moi-même la compilation. Le code a été relu attentivement (types, imports, schéma Prisma repris à l'identique, cohérence des routes/DTO), mais il faudra faire tourner les étapes ci-dessus en local pour confirmer que tout compile et que les tests passent. Si une erreur apparaît à l'installation, dis-le moi et je corrige.

## Ce qui a été livré dans ce sprint

**Backend**
- Schéma Prisma (identique à la spec) + migration à générer + seed (1 tenant + 1 admin)
- Module Auth (register/login/logout/me) — JWT, bcrypt, validation Zod, tests Vitest
- Module Users (ADMIN uniquement) — liste, création caissier, activer/désactiver, tests
- Module Categories — liste, création, tests
- Module Products — CRUD, recherche par nom, filtre catégorie, pagination, recherche par code-barres, soft delete, tests
- Isolation stricte par `tenantId` sur toutes les routes protégées

**Frontend**
- `/login`, `/register`
- `/dashboard` (coquille de navigation au Sprint 1 — contenu réel ajouté au Sprint 4)
- `/produits` (liste, recherche, filtre, pagination), `/produits/nouveau`, `/produits/[id]`
- `/parametres/employes` (ADMIN uniquement)
- Sidebar façon Linear, mode clair/sombre

**Sprint 2 — Backend**
- Extension du schéma Prisma : `Tenant.tvaEnabled/tvaRate`, modèles `Sale`, `SaleItem`, `Payment`
- Module Sales : création transactionnelle (vérification stock, calcul sous-total/remise/TVA/total, paiements combinés), liste paginée avec filtre date/vendeur, détail, annulation avec remise en stock (ADMIN), tests Vitest couvrant les cas limites (stock insuffisant, remise excessive, paiement insuffisant, TVA, annulation)

**Sprint 2 — Frontend**
- `/caisse` : recherche produit en direct + scan code-barres (Entrée), panier avec quantités bornées au stock, remise, TVA affichée si activée, paiements multiples (espèces/Orange Money/Moov Money/carte), monnaie à rendre
- `/ventes/[id]` : reçu imprimable (format ticket), annulation (ADMIN)
- `/ventes` : historique paginé avec filtre par date
- Sidebar : entrées Caisse et Ventes activées

**Sprint 3 — Backend**
- Extension du schéma Prisma : `Product.lowStockThreshold`, `Sale.customerId`, `PaymentMethod.CREDIT`, modèles `StockMovement`, `Customer`, `CustomerPayment`
- Module Stock : ajustements manuels (entrée/sortie, avec motif), historique filtrable (produit/type/période), alertes de stock faible, tests Vitest
- Module Sales adapté : journalise un `StockMovement` par ligne vendue, accepte un `customerId` + paiement `CREDIT` (vérifie le plafond de crédit), l'annulation remet le stock (avec mouvement `RESTOCK`) et annule la dette crédit associée
- Module Customers : CRUD, fiche avec solde et historique des ventes, règlement de dette (`POST /customers/:id/payments`), tests Vitest
- Module Products adapté : seuil d'alerte de stock propagé dans la création/modification

**Sprint 3 — Frontend**
- `/stock` : alertes de stock faible, formulaire d'ajustement manuel (entrée/sortie + motif), historique des mouvements
- `/clients`, `/clients/nouveau`, `/clients/[id]` : liste/recherche, création, fiche avec solde, plafond, règlement et historique des achats
- `/caisse` adapté : sélection d'un client optionnelle (recherche par nom/téléphone), mode de paiement « Crédit »
- `/produits/[id]` et `/produits/nouveau` : champ seuil d'alerte de stock
- Sidebar et tableau de bord : entrées Stock et Clients activées

**Sprint 4 — Backend**
- Extension du schéma Prisma : `SaleItem.unitCost` (snapshot du coût pour un bénéfice fiable), `Tenant.logoUrl/language`, `User.theme`
- Module Sales adapté : snapshot de `unitCost` à chaque ligne vendue
- Module Dashboard : `/dashboard/summary` (CA/ventes/bénéfice jour/semaine/mois + alertes stock), `/dashboard/revenue-chart` (30 jours glissants), `/dashboard/top-products`, `/dashboard/recent-activity`, tests Vitest
- Module Reports : `/reports/sales` (filtres période/vendeur/produit/catégorie, calcul du bénéfice hors TVA), `/reports/sales/pdf` (export PDF via `pdfkit`), tests Vitest
- Module Settings (ADMIN uniquement) : `GET/PATCH /settings`, `POST /settings/logo` (upload vers Supabase Storage, validation type/taille), tests Vitest
- `/auth/me` étendu : expose désormais `theme`, `logoUrl`, `language`
- Utilitaire partagé `sales-metrics.ts` (calcul du bénéfice, bornes de dates) réutilisé par Dashboard et Reports

**Sprint 4 — Frontend**
- `/dashboard` rempli : cartes CA/ventes/bénéfice/stock faible (jour/mois), graphique Recharts du CA sur 30 jours, top produits, activité récente
- `/rapports` : sélection de période (jour/semaine/mois/année/personnalisée), filtres vendeur/produit/catégorie, tableau de résultats, export PDF
- `/parametres` (ADMIN uniquement) : nom, upload de logo, devise, activation/taux de TVA, langue
- Sidebar : entrées Rapports et Boutique (paramètres) activées
- `AuthContext` : expose `theme`/`logoUrl`/`language` et une fonction `refreshUser()` pour rafraîchir après modification des paramètres

**Sprint 5 — Backend**
- Extension du schéma Prisma : `Supplier`, `PurchaseOrder`, `PurchaseOrderItem`, `SupplierPayment`, enum `PurchaseOrderStatus`
- Module Suppliers : CRUD, fiche avec commandes + règlements, `POST /:id/payments` (refuse un règlement > dette), tests Vitest
- Module PurchaseOrders : création (vérifie fournisseur/produits), modification (bloquée une fois reçue), `POST /:id/receive` transactionnel (incrémente le stock, met à jour `Product.cost`, journalise un `StockMovement` RESTOCK par ligne, augmente la dette fournisseur, passe le statut à RECEIVED), tests Vitest

**Sprint 5 — Frontend**
- `/fournisseurs`, `/fournisseurs/nouveau`, `/fournisseurs/[id]` : liste/recherche, création, fiche avec solde, règlement et historique des commandes
- `/achats`, `/achats/nouveau`, `/achats/[id]` : liste filtrable par statut, création multi-lignes (pré-remplissage du coût), détail avec bouton « Marquer comme reçue »
- Sidebar : entrées Achats et Fournisseurs activées

**Sprint 6 — Backend**
- Extension du schéma Prisma : enum `Role` étendu à `ADMIN`/`MANAGER`/`CAISSIER`/`MAGASINIER`, modèle `Expense`
- `RolesGuard` (déjà présent depuis le Sprint 1) appliqué à **tous** les contrôleurs existants selon le tableau de permissions du sprint : Products/Categories (lecture ouverte, écriture ADMIN/MANAGER/MAGASINIER), Stock/Suppliers/PurchaseOrders (ADMIN/MANAGER/MAGASINIER), Sales/Customers (vente et lecture ouvertes au CAISSIER, actions sensibles réservées à ADMIN/MANAGER), Dashboard/Reports (ADMIN/MANAGER), Users (étendu à MANAGER, avec une règle métier empêchant un MANAGER de créer un compte ADMIN)
- Tests dédiés du `RolesGuard` (combinaisons rôle/action clés) + tests `UsersService` couvrant la restriction de création
- Module Expenses : CRUD, ADMIN uniquement, tests Vitest
- Module Accounting : `GET /accounting/summary` (recettes, dépenses, pertes valorisées au coût produit, bénéfice net, trésorerie hors ventes à crédit), ADMIN uniquement, tests Vitest
- Seed enrichi : un compte de démo par rôle

**Sprint 6 — Frontend**
- `/depenses` : liste, ajout, filtre par catégorie, suppression (ADMIN uniquement)
- `/comptabilite` : mêmes sélecteurs de période que `/rapports`, 5 cartes de synthèse (ADMIN uniquement)
- Sidebar entièrement adaptée au rôle connecté (chaque entrée déclare ses rôles autorisés)
- `AppShell` généralisé avec `allowedRoles` : bloque aussi l'accès direct par URL (pas seulement l'affichage du lien), avec redirection anti-boucle vers une page toujours accessible
- `/parametres/employes` : sélection du rôle à la création (ADMIN peut créer tous les rôles, MANAGER ne peut pas créer d'ADMIN)
- `/produits` : boutons de création/modification/suppression masqués pour le rôle CAISSIER

**Sprint 7 — Backend**
- Extension du schéma Prisma : enum `NotificationType`, modèle `Notification` (visible par un utilisateur précis ou par tous les admins du tenant si `userId = null`)
- Déclencheurs de notifications : `LOW_STOCK`/`OUT_OF_STOCK` branchés dans `StockService.createAdjustment` et `SalesService.create` (les deux façons dont le stock diminue), `PAYMENT_RECEIVED` branché dans `CustomersService.addPayment` — utilitaire partagé `notifications-helper.ts`
- Module Notifications : liste (non lues en premier, filtre lu/non lu, compte de non-lues), marquage individuel et global, restreint à ADMIN/MANAGER, tests Vitest
- Export/Import Excel Produits (`xlsx`/SheetJS) : `GET /products/export` (catalogue complet), `POST /products/import` (correspondance par code-barres puis par nom, gestion de catégorie, erreurs par ligne sans bloquer tout l'import), tests Vitest
- Export Excel Rapports : `GET /reports/sales/excel` (feuilles Résumé + Ventes), à côté du PDF du Sprint 4

**Sprint 7 — Frontend**
- Cloche de notifications dans la sidebar (badge de non-lues, menu déroulant, rafraîchissement automatique) — visible ADMIN/MANAGER
- `/notifications` : historique complet, filtre lu/non lu, marquage individuel et global
- `/produits` : boutons Exporter (téléchargement direct) et Importer (upload + résumé création/mise à jour/erreurs)
- `/rapports` : bouton "Exporter en Excel" à côté du PDF existant

**Sprint 8 — Backend**
- Extension du schéma Prisma : modèles `Store`, `UserStore`, `Inventory` ; `storeId` ajouté sur `Sale`/`StockMovement`/`PurchaseOrder` ; `Product.stock` retiré (remplacé par `Inventory`)
- Script SQL de migration manuelle (`prisma/manual-migration-multi-store.sql`) — gère le cas des colonnes NOT NULL sur tables déjà peuplées + la copie de l'ancien stock vers `Inventory` avant suppression de la colonne
- Utilitaire partagé `resolveActiveStoreId` : détermine la boutique active d'une requête (auto-sélection si une seule boutique assignée, exigence explicite sinon, ADMIN a accès à toutes les boutiques du tenant, mode "toutes boutiques" pour les vues agrégées ADMIN)
- Module Stores : CRUD, assignation/retrait d'employés, ADMIN uniquement, tests
- Modules Products, Stock, Sales, PurchaseOrders, Dashboard, Reports adaptés à `Inventory`/`storeId`, avec **tests d'isolation explicites** (un même produit a un stock différent dans deux boutiques, une vente dans l'une n'affecte pas l'autre)
- Export/Import Excel produits adapté (stock lu/écrit via l'`Inventory` de la boutique active)
- `POST /auth/login` retourne désormais `stores[]` et `defaultStoreId` (`null` si plusieurs boutiques accessibles → sélecteur requis)
- `register()` crée une boutique par défaut avec le tenant
- Seed enrichi : 2 boutiques (Bamako/Sikasso), stocks différents, assignations variées par rôle

**Sprint 8 — Frontend**
- `lib/api.ts` : injection automatique du `storeId` actif sur chaque requête (aucune page n'a eu besoin d'être modifiée une par une pour ça)
- `AuthContext` : gère `stores`, `activeStoreId` (persisté), sentinel `'ALL'` pour la vue toutes-boutiques (ADMIN), fonction `setActiveStore`
- `/selection-boutique` : sélecteur obligatoire après connexion si plusieurs boutiques accessibles
- `AppShell` : redirige vers le sélecteur si nécessaire, empêche l'utilisation de l'app sans boutique active
- Sidebar : sélecteur de boutique (avec option « Toutes les boutiques » pour ADMIN), rechargement complet au changement pour garantir des données fraîches
- `/parametres/boutiques` : liste, création, assignation/retrait d'employés
- `ProductForm` : le champ stock n'est modifiable qu'à la création (il est désormais géré boutique par boutique via `/stock`)

**Sprint 9 — Backend**
- Extension du schéma Prisma : modèles `Subscription`, `Invoice`, enums `PlanTier`/`SubscriptionStatus`
- `common/plan-limits.ts` : configuration centrale des limites/tarifs par plan (exemples de départ, à ajuster) + helpers `assertWithinResourceLimit`/`assertPlanFeature` réutilisables partout
- `PlanLimitGuard` (limite de ressource : boutiques/produits) appliqué sur `POST /stores` et `POST /products`
- `PlanFeatureGuard` (fonctionnalité incluse ou non) appliqué sur `AccountingController` et `ExpensesController` (comptabilité), et vérifié dans `UsersService` pour la création de comptes MANAGER/MAGASINIER (rôles fins)
- Module Subscription : `GET /subscription`, `POST /subscription/upgrade` (crée une facture non payée pour un plan payant — l'encaissement mobile money réel reste à intégrer), `GET /subscription/invoices`, ADMIN uniquement
- `SubscriptionExpiryService` : tâche planifiée quotidienne (`@nestjs/schedule`) qui notifie les abonnements expirant sous 7 jours (sans doublon sur 24h) et passe au statut `EXPIRED` ceux dont la date est dépassée
- Tests Vitest sur les helpers de limites, le service Subscription et la tâche planifiée
- Seed : abonnement Premium pour la boutique de démo, afin que toutes les fonctionnalités livrées soient explorables (l'API publique des sprints 11 et 13 est réservée à ce palier)

**Sprint 9 — Frontend**
- `/parametres/abonnement` : plan actuel avec statut et date d'expiration, comparatif des 4 plans, changement de plan, historique de facturation (statut payée/en attente)
- Sidebar : entrée « Abonnement » ajoutée aux paramètres
- Les messages de refus par limite de plan (`ForbiddenException` du backend) s'affichent tels quels dans les formulaires concernés (création boutique, création produit, création employé) sans code supplémentaire côté frontend

**Sprint 10 — Backend**
- Extension du schéma Prisma : `User.twoFactorSecret`/`twoFactorEnabled`, modèle `AuditLog`
- Module 2FA : `POST /auth/2fa/setup` (génère secret + QR code via `otplib`/`qrcode`), `POST /auth/2fa/verify` (confirme l'activation), `POST /auth/2fa/disable` (confirmation par mot de passe)
- `POST /auth/login` adapté : si `twoFactorEnabled`, renvoie `{requiresTwoFactor: true}` sans délivrer de token tant que le code n'est pas fourni et vérifié — pas de nouvel endpoint, le même `/auth/login` gère les deux étapes
- `AuditInterceptor` : intercepteur global générique qui déduit l'action (`entityType.verbe`) depuis la route et la méthode HTTP plutôt que d'instrumenter chaque endpoint manuellement ; ignore les routes non pertinentes (auth, notifications), retire les champs sensibles (mots de passe, codes) des métadonnées journalisées, ne bloque jamais la requête métier si la journalisation échoue
- Module AuditLog : `GET /audit-logs` (filtres employé/action/type d'entité/période), ADMIN uniquement, lecture seule
- Tests Vitest sur le 2FA (setup/verify/disable/login), l'intercepteur d'audit (déduction d'action, filtrage des routes, retrait des champs sensibles) et le service AuditLog

**Sprint 10 — Frontend**
- `/login` adapté : étape supplémentaire de saisie du code après un mot de passe correct si le 2FA est activé
- `/parametres/securite` : activer/désactiver le 2FA avec QR code à scanner, confirmation par mot de passe pour désactiver — accessible à tous les rôles (réglage personnel du compte)
- `/parametres/journal-audit` : liste filtrable (employé/type d'entité/action), lecture seule, ADMIN uniquement
- Sidebar : entrées Sécurité (tous rôles) et Journal d'audit (ADMIN) ajoutées aux paramètres

**Sprint 11 — Backend**
- Extension du schéma Prisma : modèles `ApiKey` (clé hachée en SHA-256, jamais stockée en clair) et `Webhook` (URL, événements abonnés, secret de signature)
- `common/api-key.util.ts` : génération de clé (préfixe `bsk_`) + hachage déterministe (SHA-256, pas bcrypt — une clé API est un jeton à haute entropie, pas un mot de passe humain, donc pas besoin de salage, et un hash déterministe permet la recherche directe par `keyHash`)
- Module ApiKeys (`/settings/api-keys`) : génération (clé affichée une seule fois), révocation, ADMIN uniquement
- Module Webhooks (`/settings/webhooks`) : création (secret affiché une seule fois), suppression, ADMIN uniquement
- `common/webhooks-helper.ts` : déclenchement des webhooks (signature HMAC-SHA256 du payload, `Promise.allSettled` pour qu'un webhook en échec n'affecte jamais les autres ni l'action métier), appelé **après** validation de la transaction Prisma déclenchante (jamais depuis l'intérieur — un appel HTTP sortant ne doit pas retenir un verrou de base de données)
- Événements branchés sur les points de déclenchement existants du Sprint 7 (pas de logique dupliquée) : `sale.created` dans `SalesService.create`, `stock.low` dans `SalesService.create` et `StockService.createAdjustment`
- `ApiKeyGuard` : authentifie l'API publique via l'en-tête `X-API-Key`, attache le tenant à la requête, met à jour `lastUsedAt` en tâche de fond
- Module API publique (`/api/v1`) : `GET /products`, `/sales`, `/stock` en lecture seule, paginés, rate limiting dédié (60 req/min via `@nestjs/throttler`, distinct de l'API interne qui n'en a pas)
- Documentation Swagger séparée (`/api/docs`) : ne référence que les routes de l'API publique, pas les routes internes de l'application
- Tests Vitest sur les clés API, les webhooks (gestion + déclenchement + signature HMAC vérifiée), le guard de clé API et l'API publique elle-même

**Sprint 11 — Frontend**
- `/parametres/developpeurs` : génération/révocation de clés API (clé affichée une seule fois avec bouton copier), création/suppression de webhooks (secret affiché une seule fois, sélection des événements par cases à cocher), lien vers la documentation Swagger
- Sidebar : entrée « Développeurs » ajoutée aux paramètres (ADMIN uniquement)

**Sprint 12 — Backend**
- Extension du schéma Prisma : `Sale.clientId` (unique, nullable) pour la déduplication des ventes hors-ligne
- `SalesService`/DTO adaptés pour accepter et stocker un `clientId` optionnel
- Module Sync : `GET /sync/bootstrap` (catalogue produits avec stock de la boutique active, clients, paramètres du tenant — tout ce qu'il faut pour amorcer le cache local) ; `POST /sync/sales` (rejoue chaque vente hors-ligne **via `SalesService.create`**, donc avec la même revalidation complète que la caisse en ligne — le serveur ne fait jamais confiance au stock vu localement par le client)
- Statuts par vente à la synchro : `accepted` (créée), `already_synced` (déduplication propre si le lot est renvoyé deux fois, pas une erreur), `conflict` (avec la raison exacte, ex. stock insuffisant — jamais un rejet silencieux)
- Traitement séquentiel du lot (pas en parallèle) : un conflit sur une vente ne bloque pas les suivantes
- Tests Vitest couvrant explicitement le scénario de stock insuffisant détecté à la synchro

**Sprint 12 — Frontend**
- PWA : `manifest.json`, icônes (192×192, 512×512 — placeholders à remplacer par un vrai logo), service worker écrit à la main (`public/sw.js`) plutôt que via un plugin tiers — cache l'app shell (JS/CSS/pages) pour un chargement hors-ligne, mais ne met **jamais** en cache les appels `/api` (les données métier hors-ligne viennent exclusivement d'IndexedDB, jamais d'un cache HTTP potentiellement périmé silencieusement)
- `lib/offline-db.ts` (Dexie) : cache local des produits/clients, file de ventes en attente avec décrément de stock local optimiste (pour un affichage cohérent entre plusieurs ventes hors-ligne successives sur le même produit, le serveur revérifiant tout de toute façon à la synchro)
- `lib/use-online-status.ts` : détection en ligne/hors-ligne, synchronisation automatique déclenchée dès le retour de connexion (sans action de l'utilisateur)
- Indicateur en ligne/hors-ligne dans la sidebar, avec le nombre de ventes en attente
- `/caisse` adaptée : recherche produit/client et encaissement basculent transparemment sur le cache local IndexedDB quand hors-ligne
- `/caisse/synchronisation` : liste des ventes en attente et en conflit, actions manuelles (réessayer / abandonner) pour chaque conflit

**Sprint 13 — Backend**
- `ApiKeyGuard` (Sprint 11) rendu compatible GraphQL en plus de REST : un seul guard, une seule logique d'authentification par clé API, pour les deux interfaces — pas de duplication
- Types GraphQL code-first (`ProductGqlType`, `SaleGqlType`, `StockLevelGqlType` + leurs variantes paginées) générant automatiquement le schéma (`schema.gql`, non commité)
- `PublicApiResolver` : trois queries (`products`, `sales`, `stock`) qui **délèguent entièrement à `PublicApiService`** (Sprint 11) — même logique de requête que le REST, aucune duplication, juste une interface différente
- Endpoint unique `POST /graphql`, protégé par la même clé API que `/api/v1`
- Tests Vitest sur le guard en contexte GraphQL et sur le resolver (y compris la transformation de la structure imbriquée du stock)

**Sprint 13 — Frontend**
- `/parametres/developpeurs` : lien vers l'explorateur GraphQL ajouté à côté de la documentation REST, avec une note précisant que l'explorateur s'ouvre librement mais que chaque requête exécutée exige la clé API

---

## Fin du projet

Les 13 sprints couvrent l'intégralité du prompt initial. Le projet est fonctionnellement complet : authentification et gestion des employés, caisse et stock, fournisseurs et achats, comptabilité, notifications et exports, multi-boutique, abonnements SaaS, sécurité renforcée (2FA, journal d'audit), API publique REST et GraphQL avec webhooks, et mode hors-ligne pour la caisse.

Comme à chaque sprint, le code n'a pas pu être exécuté dans l'environnement où il a été écrit (pas d'accès réseau) — chaque étape a été vérifiée par relecture attentive, mais seule l'exécution en local (les commandes `npm test` de chaque section ci-dessus, puis les scénarios de vérification numérotés) confirme que tout fonctionne bout en bout.

## Sécurisation des abonnements payants — activation manuelle par confirmation de paiement

Jusqu'ici (Sprint 9), `POST /subscription/upgrade` activait le plan immédiatement, sans aucune vérification qu'un paiement avait réellement eu lieu — n'importe quel tenant ADMIN pouvait s'auto-attribuer un plan payant gratuitement. C'est corrigé :

- `POST /subscription/upgrade` ne change plus jamais le plan actif pour un plan payant : il crée une **facture en attente** (`paidAt: null`), consultable par le tenant sur `/parametres/abonnement`. Le plan actif — et donc les limites appliquées (boutiques, produits, rôles fins, comptabilité) — reste inchangé tant que le paiement n'est pas confirmé.
- Le passage au plan **Gratuit** reste immédiat (aucun paiement à sécuriser).
- Un nouvel endpoint réservé à l'opérateur de la plateforme (toi, pas un tenant) active réellement le plan une fois le paiement vérifié manuellement (ex. après réception d'un transfert Orange Money/Moov Money) :
  ```bash
  curl -X POST https://ton-backend/api/platform/invoices/<invoice-id>/confirm-payment \
    -H "X-Platform-Secret: <la valeur de PLATFORM_ADMIN_SECRET>"
  ```
- Cet endpoint est protégé par `PlatformSecretGuard`, complètement séparé du système d'authentification des tenants (`JwtAuthGuard`/`RolesGuard`) — un tenant ADMIN n'a structurellement aucun moyen d'y accéder, même en connaissant l'URL.

**Configuration requise** : ajoute `PLATFORM_ADMIN_SECRET` à ton `.env` (backend) et sur Railway (Variables), avec une valeur longue et aléatoire — voir `.env.example`. Sans cette variable, l'endpoint refuse systématiquement (fail closed), il ne s'ouvre jamais par défaut.

Pour trouver l'`invoice-id` à confirmer : `GET /subscription/invoices` (en tant que tenant ADMIN) ou directement dans la table `invoices` de la base de données.

**Hors périmètre pour l'instant** : un back-office dédié pour lister/confirmer les paiements en attente sans passer par `curl`/Postman — envisageable si le volume de demandes le justifie un jour.

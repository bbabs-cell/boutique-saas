import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import helmet from 'helmet';
import { AppModule } from './app.module';
import { PublicApiModule } from './public-api/public-api.module';

const DEFAULT_DEV_ORIGIN = 'http://localhost:3000';

/**
 * Origines autorisées à appeler l'API, lues dans CORS_ORIGINS (séparées par des virgules).
 * Sans configuration, on retombe sur le frontend local : c'est ce dont on a besoin en
 * développement, et cela reste fermé en production tant que la variable n'est pas renseignée.
 */
function corsOrigins(): string[] {
  return (process.env.CORS_ORIGINS ?? DEFAULT_DEV_ORIGIN)
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);
}

async function bootstrap() {
  // Typée en application Express : `set('trust proxy')` ci-dessous est une option d'Express,
  // absente de l'interface générique de Nest.
  const app = await NestFactory.create<NestExpressApplication>(AppModule);

  // En production, l'application tourne derrière le répartiteur de l'hébergeur (Railway, et la
  // plupart des plateformes). Sans cette ligne, Express considère que le client est ce
  // répartiteur : `req.ip` désigne alors une adresse de l'infrastructure, pas celle de
  // l'appelant. Conséquence mesurée sur le déploiement réel : la limite de tentatives sur
  // /auth/login ne se déclenchait pratiquement jamais (1 fois sur 40 requêtes en salve), parce
  // que les compteurs se dispersaient sur des adresses internes changeantes au lieu de
  // s'accumuler sur celle de l'attaquant.
  //
  // `1` et non `true` : on ne fait confiance qu'au premier intermédiaire, celui de l'hébergeur.
  // Faire confiance à toute la chaîne laisserait n'importe qui usurper son adresse via un
  // en-tête X-Forwarded-For fabriqué, et contourner la limite qu'on cherche justement à poser.
  app.set('trust proxy', 1);

  // En-têtes de sécurité par défaut (HSTS, nosniff, anti-framing…).
  // La CSP est désactivée volontairement : ce serveur ne renvoie que du JSON, sauf la page
  // Swagger de /api/docs, qui a besoin de scripts en ligne. Une CSP stricte y casserait la
  // documentation sans rien protéger de plus — la défense utile pour une API est côté frontend.
  app.use(helmet({ contentSecurityPolicy: false }));

  // Le navigateur n'accepte de partager les requêtes authentifiées qu'avec les origines
  // listées ici. `origin: true` renvoyait l'origine de l'appelant quelle qu'elle soit, ce qui
  // revenait à n'avoir aucune restriction.
  app.enableCors({ origin: corsOrigins(), credentials: true });

  app.setGlobalPrefix('api');

  // Documentation séparée de l'API publique v1 (authentifiée par clé API), distincte de
  // l'API interne qui sert le frontend — n'expose que les routes de PublicApiModule.
  const publicApiDocument = SwaggerModule.createDocument(
    app,
    new DocumentBuilder()
      .setTitle('BoutikPro — API publique v1')
      .setDescription(
        "API de lecture seule pour les intégrations tierces (comptabilité externe, e-commerce…). " +
          "Authentification par clé API via l'en-tête X-API-Key. Générez une clé depuis " +
          "/parametres/developpeurs dans l'application.",
      )
      .setVersion('1.0')
      .addApiKey({ type: 'apiKey', name: 'X-API-Key', in: 'header' }, 'apiKey')
      .build(),
    { include: [PublicApiModule] },
  );
  SwaggerModule.setup('api/docs', app, publicApiDocument);

  const port = process.env.PORT ? Number(process.env.PORT) : 3001;
  await app.listen(port);
  console.log(`Backend démarré sur http://localhost:${port}/api`);
  console.log(`Documentation de l'API publique : http://localhost:${port}/api/docs`);
}
bootstrap();

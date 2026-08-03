import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';
import { PublicApiModule } from './public-api/public-api.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.enableCors({ origin: true, credentials: true });
  app.setGlobalPrefix('api');

  // Documentation séparée de l'API publique v1 (authentifiée par clé API), distincte de
  // l'API interne qui sert le frontend — n'expose que les routes de PublicApiModule.
  const publicApiDocument = SwaggerModule.createDocument(
    app,
    new DocumentBuilder()
      .setTitle('Boutique SaaS — API publique v1')
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

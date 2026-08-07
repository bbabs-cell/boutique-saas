import { Module } from '@nestjs/common';
import { GraphQLModule as NestGraphQLModule } from '@nestjs/graphql';
import { ApolloDriver, ApolloDriverConfig } from '@nestjs/apollo';
import { join } from 'path';
import { PublicApiModule } from '../public-api/public-api.module';
import { PublicApiResolver } from './public-api.resolver';

@Module({
  imports: [
    PublicApiModule,
    NestGraphQLModule.forRoot<ApolloDriverConfig>({
      driver: ApolloDriver,
      // Code-first : le schéma est généré depuis les classes @ObjectType/@Resolver ci-dessus,
      // pas écrit à la main ni dupliqué depuis les DTO REST — mêmes services, deux interfaces.
      autoSchemaFile: join(process.cwd(), 'schema.gql'),
      sortSchema: true,
      // L'authentification par clé API se fait au niveau resolver (ApiKeyGuard, comme le REST) :
      // on expose simplement la requête HTTP dans le contexte pour que le guard puisse la lire.
      context: ({ req }: { req: unknown }) => ({ req }),
      playground: false,
      // Introspection réservée au développement : elle sert à explorer le schéma depuis Apollo
      // Sandbox. En production, elle ne fait qu'exposer la cartographie complète de l'API à des
      // appelants non authentifiés — les données, elles, restent protégées par ApiKeyGuard.
      // Les intégrateurs disposent de la documentation Swagger et du schéma généré (schema.gql).
      introspection: process.env.NODE_ENV !== 'production',
    }),
  ],
  providers: [PublicApiResolver],
})
export class GraphqlModule {}

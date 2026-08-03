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
      // Apollo Sandbox reste accessible pour explorer le schéma, mais toute exécution de requête
      // passe par le même ApiKeyGuard que l'API REST — la clé API reste requise pour les données.
      introspection: true,
    }),
  ],
  providers: [PublicApiResolver],
})
export class GraphqlModule {}

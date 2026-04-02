import { ApolloServer } from 'apollo-server-koa'
import { getInfoFromSql } from './schema_generate'

export default async (app) => {
  let { typeDefs, resolvers } = await getInfoFromSql()
  if (!G.ApolloServer) {
    G.ApolloServer = new ApolloServer({
      typeDefs,
      resolvers,
      context: ({ ctx }) => ({
        ...ctx,
        ...app.context
      })
    })
  }
  await G.ApolloServer.start();
  G.ApolloServer.applyMiddleware({ app })
}



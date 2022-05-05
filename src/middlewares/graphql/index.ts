import { getInfoFromSql } from './schema_generate'
const { ApolloServer } = require('apollo-server-koa')

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



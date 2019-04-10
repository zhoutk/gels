import { getInfoFromSql } from './schema_generate'
const { ApolloServer } = require('apollo-server-koa')
const { makeExecutableSchema } = require('graphql-tools')

export default async (app) => {
  let { typeDefs, resolvers } = await getInfoFromSql()
  const schema = makeExecutableSchema({
    typeDefs,
    resolvers,
  })
  if (!G.ApolloServer) {
    G.ApolloServer = new ApolloServer({
      schema,
      context: ({ ctx }) => ({
        ...ctx,
        ...app.context
      })
    })
  }
  G.ApolloServer.applyMiddleware({ app })
}



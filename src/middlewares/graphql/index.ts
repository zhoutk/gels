import { getInfoFromSql } from './schema_generate'
const { ApolloServer } = require('apollo-server-koa')
const { makeExecutableSchema } = require('graphql-tools')
import { customDefs } from '../../graphql/reviseResult'

export default async (app) => {
  let { autoTypeDefs, resolvers } = await getInfoFromSql()
  let typeDefs = [customDefs, autoTypeDefs]
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



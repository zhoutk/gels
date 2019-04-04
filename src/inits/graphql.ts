const { ApolloServer, gql } = require('apollo-server-koa')
import * as Router from 'koa-router'
const typeDefs = gql`
  type Query {
    hello: String
  }
`

// Provide resolver functions for your schema fields
const resolvers = {
  Query: {
    hello: () => 'Hello world!',
  },
}

export default class GraphQl {
    async init(app) {
        const server = new ApolloServer({ typeDefs, resolvers })
        server.applyMiddleware({ app })
    }
}
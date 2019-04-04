import BaseDao from '../../db/baseDao'
const {
  gql,
  ApolloServer
} = require('apollo-server-koa')
const {
  find,
  filter
} = require('lodash')

const { makeExecutableSchema } = require('graphql-tools')

export default (app) => {
  if (!G.ApolloServer) {
    G.ApolloServer = new ApolloServer({
      schema,
      context: ({ ctx }) => ({
        ...ctx,
        ...app.context
      })
    })
    G.ApolloServer.applyMiddleware({ app })
  }
  return async (ctx, next) => {
    await next()
  }
}

const typeDefs = gql`
  type Book {
    id: Int!
    title: String
    author: Author
  }

  type Author {
    id: Int!
    name: String
    books: [Book]
  }

  # the schema allows the following query:
  type Query {
    books: [Book]
    author(id: Int!): Author
  }

  # this schema allows the following mutation:

`

const resolvers = {
  Query: {
    books: async (_, args) => {
      let rs = await new BaseDao('book').retrieve(args)
      return rs.data
    },
    author: async (_, { id }) => {
      let rs = await new BaseDao('author').retrieve({id})
      return rs.data[0]
    },
  },
  Author: {
    books: async (author) => {
      let rs = await new BaseDao('book').retrieve({author_id: author.id})
      return rs.data
    },
  },
  Book: {
    author: async (book) => {
      let rs = await new BaseDao('author').retrieve({id: book.author_id})
      return rs.data[0]
    },
  },
}

const schema = makeExecutableSchema({
  typeDefs,
  resolvers,
})

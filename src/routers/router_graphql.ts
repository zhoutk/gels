import * as Router from 'koa-router'
import BaseDao from '../db/baseDao'
let {  GraphQLString, GraphQLObjectType, GraphQLSchema } = require('graphql')
const graphqlHTTP = require('koa-graphql')

let router = new Router()

export default (() => {
    // Maps id to User object
let fakeDatabase = {
    'a': {
      id: 'a',
      name: 'alice',
    },
    'b': {
      id: 'b',
      name: 'bob',
    },
  }
  
  // Define the User type
  let userType = new GraphQLObjectType({
    name: 'User',
    fields: {
      id: { type: GraphQLString },
      name: { type: GraphQLString },
    }
  })
  
  // Define the Query type
  let queryType = new GraphQLObjectType({
    name: 'Query',
    fields: {
      user: {
        type: userType,
        // `args` describes the arguments that the `user` query accepts
        args: {
          id: { type: GraphQLString },
          name: { type: GraphQLString }
        },
        resolve: function (_, {id}) {
          return fakeDatabase[id]
        }
      }
    }
  })
  
  let schema = new GraphQLSchema({query: queryType})
    return router.all('/graphql', graphqlHTTP({
        schema: schema,
        graphiql: true
      }))
      
    // return router.get('/graphql/:command', process)
})() 
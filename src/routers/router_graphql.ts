import * as Router from 'koa-router'
import BaseDao from '../db/baseDao'
let { GraphQLString, GraphQLObjectType, GraphQLSchema, GraphQLList } = require('graphql')
const graphqlHTTP = require('koa-graphql')

let router = new Router()

export default (() => {
    let userType = new GraphQLObjectType({
        name: 'User',
        fields: {
            id: { type: GraphQLString },
            username: { type: GraphQLString },
            password: { type: GraphQLString }
        }
    })

    let queryType = new GraphQLObjectType({
        name: 'Query',
        fields: {
            users: {
                type: new GraphQLList(userType),
                // `args` describes the arguments that the `user` query accepts
                args: {
                    id: { type: GraphQLString },
                    search: { type: GraphQLString },
                    password: { type: GraphQLString },
                    username: { type: GraphQLString }
                },
                resolve: async function (_, args) {
                    let rs = await new BaseDao('users').retrieve(args, Object.keys(userType._fields))
                    return rs.data
                }
            }
        }
    })

    let schema = new GraphQLSchema({ query: queryType })
    return router.all('/graphql', graphqlHTTP({
        schema: schema,
        graphiql: true
    }))

    // return router.get('/graphql/:command', process)
})() 
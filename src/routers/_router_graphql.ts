import * as Router from 'koa-router'
import BaseDao from '../db/baseDao'
import { GraphQLString, GraphQLObjectType, GraphQLSchema, GraphQLList, GraphQLInt } from 'graphql'
const graphqlHTTP = require('koa-graphql')

let router = new Router()

export default (() => {
    let authorType = new GraphQLObjectType({
        name: 'Author',
        fields: {
            id: { type: GraphQLInt},
            name: { type: GraphQLString}
        }
    })

    let bookType = new GraphQLObjectType({
        name: 'Book',
        fields: {
            id: { type: GraphQLInt},
            title: { type: GraphQLString},
            author: { 
                type: authorType,
                resolve: async (book, args) => {
                    let rs = await new BaseDao('author').retrieve({id: book.author_id})
                    return rs.data[0]
                }
            }
        }
    })

    let userType = new GraphQLObjectType({
        name: 'User',
        fields: {
            id: { type: GraphQLString },
            username: { type: GraphQLString },
            password: { type: GraphQLString },
        }
    })

    let queryType = new GraphQLObjectType({
        name: 'Query',
        fields: {
            books: {
                type: new GraphQLList(bookType),
                args: {
                    id: { type: GraphQLString },
                    search: { type: GraphQLString },
                    title: { type: GraphQLString },
                },
                resolve: async function (_, args) {
                    let rs = await new BaseDao('book').retrieve(args)
                    return rs.data
                }
            },
            authors: {
                type: new GraphQLList(authorType),
                // `args` describes the arguments that the `user` query accepts
                args: {
                    id: { type: GraphQLString },
                    search: { type: GraphQLString },
                    name: { type: GraphQLString },
                },
                resolve: async function (_, args) {
                    let rs = await new BaseDao('author').retrieve(args)
                    return rs.data
                }
            },
            // author: {
            //     type: authorType,
            //     args: {
            //         id: { type: GraphQLString },
            //     },
            //     resolve: async function (book) {
            //         let rs = await new BaseDao('author').retrieve({id: book.author_id})
            //         return rs.data[0]
            //     }
            // },
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
                    let rs = await new BaseDao('users').retrieve(args)
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
import * as Router from 'koa-router'
import * as jwt from 'jsonwebtoken'
import BaseDao from '../db/baseDao'
let { graphql, buildSchema } = require('graphql')

let router = new Router()
const config = G.CONFIGS.jwt
let schema = buildSchema(`
    type Query {
    hello: String
    }
`)
export default (() => {
    let process = async (ctx, next) => {
        let { command } = ctx.params
        let root = { hello: () => 'Hello world!' }

        graphql(schema, '{ hello }', root).then((response) => {
            ctx.body = response
            console.log(response)
        })
    }
    return router.get('/graphql/:command', process)
})() 
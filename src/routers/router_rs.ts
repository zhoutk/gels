import * as Router from 'koa-router'
let router = new Router()

export default () => {
    return router.all('/rs', process)
} 

let process = async (ctx, next) => {
    ctx.body = 'rs result.'
}
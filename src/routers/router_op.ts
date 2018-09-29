import * as Router from 'koa-router'
let router = new Router()

export default () => {
    return router.post('/op', process)
} 

let process = async (ctx, next) => {
    ctx.body = 'op result.'
}
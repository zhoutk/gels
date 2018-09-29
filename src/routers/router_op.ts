import * as Router from 'koa-router'
let router = new Router()

export default (() => {
    let process = async (ctx, next) => {
        ctx.body = 'op result.'
    }
    return router.post('/op', process)
})() 

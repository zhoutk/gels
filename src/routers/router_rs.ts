import * as Router from 'koa-router'
let router = new Router()

export default (() => {
    let process = async (ctx, next) => {
        ctx.body = `rs result -- ${JSON.stringify(ctx.params)}`
    }
    return router.all('/rs/:table', process).all('/rs/:table/:id', process)
})() 

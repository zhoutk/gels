import * as Router from 'koa-router'
import BaseDao from '../db/baseDao';
let router = new Router()

const METHODS = {
    GET: 'retrieve',
    POST: 'create',
    PUT: 'update',
    DELETE: 'delete'
}

export default (() => {
    let process = async (ctx, next) => {
        // ctx.body = `rs result -- ${JSON.stringify(ctx.params)}`
        let method: string = ctx.method.toUpperCase()
        let tableName: string = ctx.params.table
        let id: string | number | undefined = ctx.params.id
        try{
            ctx.body = await new BaseDao('member').retrieve(ctx.request.query)
        }catch(e){
            ctx.body = e
        }
    }
    return router.all('/rs/:table', process).all('/rs/:table/:id', process)
})() 

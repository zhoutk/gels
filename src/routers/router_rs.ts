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
        let params = method === 'POST' || method === 'PUT' ? ctx.request.body : ctx.request.query
        if(id != null)
            params.id = id
        let fields = []
        if(params.fields){
            if(Array.isArray(params.fields))
                fields = fields.concat(params.fields)
            else if(typeof params.fields === 'string')
                fields = params.fields.split(',')
            delete params.fields
        }
        try{
            ctx.body = await new BaseDao(tableName)[METHODS[method]](params, fields, ctx.session)
        }catch(err){
            ctx.body = err
        }
    }
    return router.all('/rs/:table', process).all('/rs/:table/:id', process)
})() 
import * as Router from 'koa-router'
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
        if (id != null)
            params.id = id
        let {fields, ...restParams} = params
        if (fields) {
            fields = G.tools.arryParse(fields)
            if (!fields) {
                throw G.koaError(ctx, G.STCODES.PRAMAERR, 'params fields is wrong.')
            }
        }

        let module = loadModule(`../dao/${tableName}`)
        if (!module) {
            module = require('../db/baseDao')
        }
        let db = new module.default(tableName)

        ctx.body = await db[METHODS[method]](restParams, fields, ctx.session)
        // ctx.body = await new BaseDao().execSql("insert into users (username, password, age) values (?,?,?) ", ['alice', 122, 16])          //test execSql create
        // ctx.body = await new BaseDao().execSql("update users set age = ? where id = ? ", [22, 1])          //test execSql update
        // ctx.body = await new BaseDao().querySql("select * from users where age = ? ", [12], params)       //test querySql
    }
    return router.all('/rs/:table', process).all('/rs/:table/:id', process)
})() 

function loadModule(path: string) {
    try {
        return require(path)
    } catch (err) {
        if (err.message.indexOf('Cannot find module') < 0)
            G.logger.error(err.message)
        return null
    }
}

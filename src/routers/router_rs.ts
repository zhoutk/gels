import * as Router from 'koa-router'
import BaseDao from '../db/baseDao'
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

        let module = loadModule(`../dao/${tableName}`), is_module_exist = true
        if (!module) {
            is_module_exist = false
            module = require('../db/baseDao')
        }

        if (method === 'GET' && !tableName.startsWith('v_') && (!is_module_exist || 
            is_module_exist && !Object.getOwnPropertyNames(module.default.prototype).some((al) => al === 'retrieve')) ) {
            let rs = await new BaseDao().querySql(
                'SELECT TABLE_NAME FROM INFORMATION_SCHEMA.VIEWS WHERE TABLE_SCHEMA= ? and TABLE_NAME= ? ',
                [G.CONFIGS.dbconfig.db_name, 'v_' + tableName])
            if (rs.status === 200)
                tableName = 'v_' + tableName
        }

        let rs: any
        try {
            let db = new module.default(tableName)
            rs = await db[METHODS[method]](restParams, fields, ctx.session)
        } catch (err) {
            rs = G.jsResponse(G.STCODES.EXCEPTION, err.message, {stack: err.stack})
        }
        ctx.body = rs
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

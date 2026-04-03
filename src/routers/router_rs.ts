import Router from '@koa/router'
import BaseDao from '../db/baseDao'
import DbInitDao from '../dao/db_init'
import { config, jsResponse, tools } from '../inits/global'
import { STCODES } from '../inits/enums'
import { validateFields, validatePagination } from '../common/validators'
import { isSqliteDialect } from '../db/sqlDialect'
let router = new Router()

const METHODS = {
    GET: 'retrieve',
    POST: 'create',
    PUT: 'update',
    DELETE: 'delete'
}

export default (() => {
    let process = async (ctx: any) => {
        // ctx.body = `rs result -- ${JSON.stringify(ctx.params)}`
        let method = ctx.method.toUpperCase() as keyof typeof METHODS
        if (!Object.prototype.hasOwnProperty.call(METHODS, method)) {
            ctx.body = jsResponse(STCODES.NOTFOUNDERR, 'method is not supported.')
            return
        }
        let tableName: string = ctx.params.table
        let id: string | number | undefined = ctx.params.id
        let params = method === 'POST' || method === 'PUT' ? ctx.request.body : ctx.request.query
        if (id != null)
            params.id = id
        let { fields, ...restParams } = params
        const { page, size } = validatePagination(params.page, params.size)
        if (method === 'GET') {
            restParams.page = page
            restParams.size = size
        }
        if (fields) {
            const validatedFields = validateFields(tableName, fields)
            if (!validatedFields) {
                ctx.body = jsResponse(STCODES.PARAMERR, 'params fields is wrong.')
                return
            }
            fields = validatedFields
        }

        let module: any
        let is_module_exist = true
        if (tableName === 'db_init') {
            module = { default: DbInitDao }
        } else {
            module = await loadModule(`../dao/${tableName}`)
            if (!module) {
                is_module_exist = false
                module = await loadModule('../db/baseDao')
            }
        }

        if (method === 'GET' && !tableName.startsWith('v_') && (!is_module_exist || 
            is_module_exist && !Object.getOwnPropertyNames(module.default.prototype).some((al) => al === 'retrieve')) ) {
            let rs = await new BaseDao().querySql(
                isSqliteDialect()
                    ? 'SELECT name AS TABLE_NAME FROM sqlite_master WHERE type = ? and name = ? '
                    : 'SELECT TABLE_NAME FROM INFORMATION_SCHEMA.VIEWS WHERE TABLE_SCHEMA= ? and TABLE_NAME= ? ',
                isSqliteDialect() ? ['view', 'v_' + tableName] : [config.dbconfig.db_name, 'v_' + tableName])
            if (rs.status === 200)
                tableName = 'v_' + tableName
        }

        const db = new module.default(tableName)
        ctx.body = await db[METHODS[method]](restParams, fields, ctx.session)
        // ctx.body = await new BaseDao().execSql("insert into users (username, password, age) values (?,?,?) ", ['alice', 122, 16])          //test execSql create
        // ctx.body = await new BaseDao().execSql("update users set age = ? where id = ? ", [22, 1])          //test execSql update
        // ctx.body = await new BaseDao().querySql("select * from users where age = ? ", [12], params)       //test querySql
    }
    return router.all('/rs/:table', process).all('/rs/:table/:id', process)
})() 

async function loadModule(path: string) {
    try {
        return await import(path)
    } catch (err) {
        if ((err as Error).message.indexOf('Cannot find module') < 0)
            console.error((err as Error).message)
        return null
    }
}

let dialect: string = global.CONFIGS.db_dialect
let Dao = require(`./${dialect}Dao`).default
import MysqlDao from './mysqlDao'
import TransElement from '../common/transElement'

export default class BaseDao {
    table: string
    static dao: MysqlDao            //编辑时，设定为相应的数据驱动类型，获得智能提示，运行时为动态引入，类型为any
    constructor(table?: string) {
        this.table = table || ''
        if (!BaseDao.dao)
            BaseDao.dao = new Dao()
    }
    async retrieve(params = {}, fields = [], session = {userid: ''}): Promise<any> {
        let rs = await BaseDao.dao.select(this.table, params, fields) 
        if (rs.status === global.STCODES.SUCCESS && (!rs.data || rs.data.length === 0))
            return global.jsReponse( global.STCODES.QUERYEMPTY, 'data query empty.', rs)
        else
            return rs
    }
    async create(params = {}, fields = [], session = {userid: ''}): Promise<any> {
        let keys = Object.keys(params)
        if (keys.length === 0 || params['id'] !== undefined && keys.length <= 1)
            return global.jsReponse(global.STCODES.PRAMAERR, 'params is error.')
        else {
            let rs = await BaseDao.dao.insert(this.table, params)
            return global.jsReponse(global.STCODES.SUCCESS, 'data insert success.', {affectedRows: rs.affectedRows, id: rs.insertId})
        }
    }
    async update(params, fields = [], session = {userid: ''}): Promise<any> {
        params = params || {}
        let keys = Object.keys(params)
        if (params['id'] === undefined || keys.length <= 1)
            return global.jsReponse(global.STCODES.PRAMAERR, 'params is error.')
        else {
            const { id, ...restParams } = params
            let rs = await BaseDao.dao.update(this.table, restParams, id)
            return global.jsReponse(global.STCODES.SUCCESS, 'data update success.', {affectedRows: rs.affectedRows, id})
        }
    }
    async delete(params = {}, fields = [], session = {userid: ''}): Promise<any> {
        if (params['id'] === undefined)
            return global.jsReponse(global.STCODES.PRAMAERR, 'params is error.')
        else {
            let id = params['id']
            let rs = await BaseDao.dao.delete(this.table, id)
            return global.jsReponse(global.STCODES.SUCCESS, 'data delete success.', {affectedRows: rs.affectedRows, id})
        }
    }
    async querySql(sql: string, values = [], params = {}, fields = []): Promise<any> {
        let rs = await BaseDao.dao.querySql (sql, values, params, fields) 
        if (rs.length === 0)
            return global.jsReponse( global.STCODES.QUERYEMPTY, 'data query empty.', rs)
        else
            return global.jsReponse( global.STCODES.SUCCESS, 'data query success.', rs)
    }
    async execSql(sql: string, values = []): Promise<any> {
        let rs = await BaseDao.dao.execSql(sql, values)
        let {affectedRows} = rs
        return global.jsReponse(global.STCODES.SUCCESS, 'data exec success.', {affectedRows})
    }
    async insertBatch(tablename: string, elements = []): Promise<any> {
        let rs = await BaseDao.dao.insertBatch(tablename, elements)
        let {affectedRows} = rs
        return global.jsReponse(global.STCODES.SUCCESS, 'data batch success.', {affectedRows})
    }
    async transGo(elements: Array<TransElement>, isAsync = true): Promise<any> {
        let rs
        try {
            rs = await BaseDao.dao.transGo(elements, isAsync)
        } catch (err) {
            err.message = `data batch fail: ${err.message}`
            return err
        }
        let {affectedRows} = rs
        return global.jsReponse(global.STCODES.SUCCESS, 'data batch success.', {affectedRows})
    }
}
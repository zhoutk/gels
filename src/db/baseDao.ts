let dialect: string = G.CONFIGS.db_dialect
let Dao = require(`./${dialect}Dao`).default
import TransElement from '../common/transElement'
import IDao from './idao'

export default class BaseDao {
    table: string
    static dao: IDao            
    constructor(table?: string) {
        this.table = table || ''
        if (!BaseDao.dao)
            BaseDao.dao = new Dao()
    }
    async retrieve(params = {}, fields = [], session = { userid: '' }): Promise<any> {
        let rs
        try {
            rs = await BaseDao.dao.select(this.table, params, fields)
        } catch (err) {
            err.message = `data query fail: ${err.message}`
            return err
        }
        if (rs.status === G.STCODES.SUCCESS && (!rs.data || rs.data.length === 0))
            return G.jsResponse(G.STCODES.QUERYEMPTY, 'data query empty.', rs)
        else
            return rs
    }
    async create(params = {}, fields = [], session = {userid: ''}): Promise<any> {
        let keys = Object.keys(params)
        if (keys.length === 0 || params['id'] !== undefined && keys.length <= 1)
            return G.jsResponse(G.STCODES.PRAMAERR, 'params is error.')
        else {
            let rs
            try {
                rs = await BaseDao.dao.insert(this.table, params)
            } catch (err) {
                err.message = `data insert fail: ${err.message}`
                return err
            }
            let {affectedRows} = rs
            return G.jsResponse(G.STCODES.SUCCESS, 'data insert success.', {affectedRows, id: rs.insertId})
        }
    }
    async update(params, fields = [], session = { userid: '' }): Promise<any> {
        params = params || {}
        let keys = Object.keys(params)
        if (params['id'] === undefined || keys.length <= 1)
            return G.jsResponse(G.STCODES.PRAMAERR, 'params is error.')
        else {
            const { id, ...restParams } = params
            let rs
            try {
                rs = await BaseDao.dao.update(this.table, restParams, id)
            } catch (err) {
                err.message = `data update fail: ${err.message}`
                return err
            }
            let { affectedRows } = rs
            return G.jsResponse(G.STCODES.SUCCESS, 'data update success.', { affectedRows, id })
        }
    }
    async delete(params = {}, fields = [], session = {userid: ''}): Promise<any> {
        if (params['id'] === undefined)
            return G.jsResponse(G.STCODES.PRAMAERR, 'params is error.')
        else {
            let id = params['id']
            let rs
            try {
                rs = await BaseDao.dao.delete(this.table, id)
            } catch (err) {
                err.message = `data delete fail: ${err.message}`
                return err
            }
            let {affectedRows} = rs
            return G.jsResponse(G.STCODES.SUCCESS, 'data delete success.', { affectedRows, id })
        }
    }
    async querySql(sql: string, values = [], params = {}, fields = []): Promise<any> {
        let rs
        try {
            rs = await BaseDao.dao.querySql (sql, values, params, fields) 
        } catch (err) {
            err.message = `data querySql fail: ${err.message}`
            return err
        }
        if (rs.length === 0)
            return G.jsResponse( G.STCODES.QUERYEMPTY, 'data querySql empty.', rs)
        else
            return G.jsResponse( G.STCODES.SUCCESS, 'data querySql success.', rs)
    }
    async execSql(sql: string, values = []): Promise<any> {
        let rs
        try {
            rs = await BaseDao.dao.execSql(sql, values)
        } catch (err) {
            err.message = `data execSql fail: ${err.message}`
            return err
        }
        let {affectedRows} = rs
        return G.jsResponse(G.STCODES.SUCCESS, 'data execSql success.', {affectedRows})
    }
    async insertBatch(tablename: string, elements = []): Promise<any> {
        let rs
        try {
            rs = await BaseDao.dao.insertBatch(tablename, elements)
        } catch (err) {
            err.message = `data batch fail: ${err.message}`
            return err
        }
        let {affectedRows} = rs
        return G.jsResponse(G.STCODES.SUCCESS, 'data batch success.', {affectedRows})
    }
    async transGo(elements: Array<TransElement>, isAsync = true): Promise<any> {
        let rs
        try {
            rs = await BaseDao.dao.transGo(elements, isAsync)
        } catch (err) {
            err.message = `data trans fail: ${err.message}`
            return err
        }
        let {affectedRows} = rs
        return G.jsResponse(G.STCODES.SUCCESS, 'data trans success.', {affectedRows})
    }
}
import TransElement from '../common/transElement'
import IDao from './idao'
import * as moment from 'moment'

export default class BaseDao {
    table: string
    static dao: IDao
    constructor(table?: string) {
        this.table = table || ''
    }
    static async initDao(): Promise<void> {
        if (!BaseDao.dao) {
            const dialect = G.CONFIGS.db_dialect
            try {
                const mod = await import(`./${dialect}Dao`)
                const DaoCtor = (mod)?.default ?? mod
                BaseDao.dao = new DaoCtor()
            } catch (e) {
                let msg: string
                if (e && typeof (e as any).message === 'string') msg = (e as any).message
                else if (typeof e === 'string') msg = e
                else {
                    try { msg = JSON.stringify(e) } catch { msg = Object.prototype.toString.call(e as any) }
                }
                if (G.logger && typeof G.logger.error === 'function') {
                    G.logger.error(`initDao fail: ${msg}`)
                }
                throw e
            }
        }
    }
    async retrieve(params = {}, fields = [], _session = { userid: '' }): Promise<any> {
        await BaseDao.initDao()
        void _session
        let rs
        try {
            rs = await BaseDao.dao.select(this.table, params, fields)
        } catch (err) {
            (err as Error).message = `data query fail: ${(err as Error).message}`
            return err
        }
        if (rs.status === G.STCODES.SUCCESS && (!rs.data || rs.data.length === 0))
            return G.jsResponse(G.STCODES.QUERYEMPTY, 'data query empty.', rs)
        else
            return processDatum(rs)
    }
    async create(params = {}, _fields = [], _session = { userid: '' }): Promise<any> {
        await BaseDao.initDao()
        void _fields
        void _session
        let keys = Object.keys(params as Record<string, unknown>)
        if (keys.length === 0 || params['id'] !== undefined && keys.length <= 1)
            return G.jsResponse(G.STCODES.PARAMERR, 'params is error.')
        else {
            let rs, id = params['id']
            try {
                if (!id) {
                    if (!G.DataTables[this.table])
                        return G.jsResponse(G.STCODES.DBNEEDRESTARTERR, 'database tables had modify, you should restart server.')
                    if (!G.DataTables[this.table]['id'])
                        return G.jsResponse(G.STCODES.DBNEEDIDERR, 'database tables need id field.')
                    let idType = G.DataTables[this.table]['id']['COLUMN_TYPE']
                    let leftBracket = idType.indexOf('(')
                    if (leftBracket > 3 && idType.substring(leftBracket - 3, leftBracket) !== 'int') {
                        id = G.tools.uuid()
                    }
                } 
                rs = await BaseDao.dao.insert(this.table, Object.assign(params, id ? { id } : {}))
            } catch (err) {
                (err as Error).message = `data insert fail: ${(err as Error).message}`
                return err
            }
            let { affectedRows } = rs
            return G.jsResponse(G.STCODES.SUCCESS, 'data insert success.', { affectedRows, id: id || rs.insertId })
        }
    }
    async update(params, _fields = [], _session = { userid: '' }): Promise<any> {
        await BaseDao.initDao()
        void _fields
        void _session
        params = params || {}
        let keys = Object.keys(params as Record<string, unknown>)
        if (params['id'] === undefined || keys.length <= 1)
            return G.jsResponse(G.STCODES.PARAMERR, 'params is error.')
        else {
            const { id, ...restParams } = params
            let rs
            try {
                rs = await BaseDao.dao.update(this.table, restParams, id)
            } catch (err) {
                (err as Error).message = `data update fail: ${(err as Error).message}`
                return err
            }
            let { affectedRows } = rs
            return G.jsResponse(G.STCODES.SUCCESS, 'data update success.', { affectedRows, id })
        }
    }
    async delete(params = {}, _fields = [], _session = { userid: '' }): Promise<any> {
        await BaseDao.initDao()
        void _fields
        void _session
        if ((params as Record<string, unknown>)['id'] === undefined)
            return G.jsResponse(G.STCODES.PARAMERR, 'params is error.')
        else {
            let id = (params as Record<string, unknown>)['id']
            let rs
            try {
                rs = await BaseDao.dao.delete(this.table, id as string | number)
            } catch (err) {
                (err as Error).message = `data delete fail: ${(err as Error).message}`
                return err
            }
            let { affectedRows } = rs
            return G.jsResponse(G.STCODES.SUCCESS, 'data delete success.', { affectedRows, id })
        }
    }
    async querySql(sql: string, values = [], params = {}, fields = []): Promise<any> {
        await BaseDao.initDao()
        let rs
        try {
            rs = await BaseDao.dao.querySql(sql, values, params, fields)
        } catch (err) {
            (err as Error).message = `data querySql fail: ${(err as Error).message}`
            return err
        }
        if (rs.status === G.STCODES.SUCCESS && (!rs.data || rs.data.length === 0))
            return G.jsResponse(G.STCODES.QUERYEMPTY, 'data query empty.', rs)
        else
            return processDatum(rs)
    }
    async execSql(sql: string, values = []): Promise<any> {
        await BaseDao.initDao()
        let rs
        try {
            rs = await BaseDao.dao.execSql(sql, values)
        } catch (err) {
            (err as Error).message = `data execSql fail: ${(err as Error).message}`
            return err
        }
        let { affectedRows } = rs
        return G.jsResponse(G.STCODES.SUCCESS, 'data execSql success.', { affectedRows })
    }
    async insertBatch(tablename: string, elements = []): Promise<any> {
        await BaseDao.initDao()
        let rs
        try {
            rs = await BaseDao.dao.insertBatch(tablename, elements)
        } catch (err) {
            (err as Error).message = `data batch fail: ${(err as Error).message}`
            return err
        }
        let { affectedRows } = rs
        return G.jsResponse(G.STCODES.SUCCESS, 'data batch success.', { affectedRows })
    }
    async transGo(elements: Array<TransElement>, isAsync = true): Promise<any> {
        await BaseDao.initDao()
        let rs
        try {
            rs = await BaseDao.dao.transGo(elements, isAsync)
        } catch (err) {
            (err as Error).message = `data trans fail: ${(err as Error).message}`
            return err
        }
        let { affectedRows } = rs
        return G.jsResponse(G.STCODES.SUCCESS, 'data trans success.', { affectedRows })
    }
}
function processDatum(rs: { data?: Array<Record<string, unknown>> } & Record<string, unknown>) {
    if (!rs || !Array.isArray(rs.data)) return rs
    rs.data.forEach(element => {
        const vs = Object.entries(element)
        for (const [key, value] of vs) {
            if (G.L.endsWith(key, '_time') && value) {
                ;(element as any)[key] = moment(value as any).format('YYYY-MM-DD hh:mm:ss')
            } else if (G.L.endsWith(key, '_json')) {
                if (value == null) {
                    ;(element as any)[key] = null
                } else if (typeof value === 'string') {
                    if (value.trim().length === 0) {
                        ;(element as any)[key] = null
                    }
                } else if (typeof Buffer !== 'undefined' && (Buffer as any).isBuffer && (Buffer as any).isBuffer(value)) {
                    const s = (value as Buffer).toString()
                    if (s.trim().length === 0) {
                        ;(element as any)[key] = null
                    }
                }
            }
        }
    })
    return rs
}
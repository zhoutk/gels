import * as lodash from 'lodash'
import TransElement from '../common/transElement'
import IDao from './idao'
import { config, jsResponse, logger, tools } from '../inits/global'
import { STCODES } from '../inits/enums'
import { isJsonFileDialect, isSqliteDialect, quoteSqliteIdentifier } from './sqlDialect'

const DIALECT_MODULE_MAP: Record<string, string> = {
    'sqlite3-file': 'sqlite3',
    'json-file': 'jsonFile',
}

function pad2(value: number): string {
    return String(value).padStart(2, '0')
}

function formatDateTime(value: unknown): string | null {
    const date = value instanceof Date ? value : new Date(value as any)
    if (Number.isNaN(date.getTime())) return null
    return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())} ${pad2(date.getHours())}:${pad2(date.getMinutes())}:${pad2(date.getSeconds())}`
}

export default class BaseDao {
    table: string
    static dao: IDao
    constructor(table?: string) {
        this.table = table || ''
    }
    static async initDao(): Promise<void> {
        if (!BaseDao.dao) {
            const dialect = config.db_dialect
            const importName = dialect ? (DIALECT_MODULE_MAP[String(dialect)] ?? dialect) : dialect
            try {
                const mod = await import(`./${importName}Dao`)
                const DaoCtor = (mod)?.default ?? mod
                BaseDao.dao = new DaoCtor()
            } catch (e) {
                let msg: string
                if (e && typeof (e as any).message === 'string') msg = (e as any).message
                else if (typeof e === 'string') msg = e
                else {
                    try { msg = JSON.stringify(e) } catch { msg = Object.prototype.toString.call(e as any) }
                }
                if (logger && typeof logger.error === 'function') {
                    logger.error(`initDao fail: ${msg}`)
                }
                throw e
            }
        }
    }
    async retrieve(params: Record<string, unknown> = {}, fields: string[] = [], _session: { userid: string } = { userid: '' }): Promise<any> {
        await BaseDao.initDao()
        void _session
        let rs
        try {
            rs = await BaseDao.dao.select(this.table, params, fields)
        } catch (err) {
            (err as Error).message = `data query fail: ${(err as Error).message}`
            return err
        }
        if (rs.status === STCODES.SUCCESS && (!rs.data || rs.data.length === 0))
            return jsResponse(STCODES.QUERYEMPTY, 'data query empty.', rs)
        else
            return processDatum(rs)
    }
    async create(params: Record<string, unknown> = {}, _fields: string[] = [], _session: { userid: string } = { userid: '' }): Promise<any> {
        await BaseDao.initDao()
        void _fields
        void _session
        const inputParams = params || {}
        const keys = Object.keys(inputParams as Record<string, unknown>)
        if (keys.length === 0)
            return jsResponse(STCODES.PARAMERR, 'params is error.')
        const providedId = inputParams['id'] as string | number | undefined
        const payload = { ...inputParams }
        let insertParams: Record<string, unknown> = payload
        let generatedId = providedId as string | number | undefined
        let shouldGenerateId = false

        if (providedId === undefined) {
            try {
                shouldGenerateId = isJsonFileDialect() ? true : await needsGeneratedId(this.table)
            } catch {
                shouldGenerateId = true
            }
            if (shouldGenerateId) {
                generatedId = tools.uuid()
                insertParams = { ...payload, id: generatedId }
            }
        }

        let rs
        try {
            if (providedId !== undefined || insertParams['id'] !== undefined) {
                rs = await BaseDao.dao.insert(this.table, insertParams)
            } else {
                try {
                    rs = await BaseDao.dao.insert(this.table, payload)
                } catch (err) {
                    if (!err || typeof err !== 'object' || shouldGenerateId) {
                        throw err
                    }
                    const code = (err as any).code
                    const message = `${String((err as any)?.message ?? '')} ${String((err as any)?.sqlMessage ?? '')}`
                    const needGeneratedId = code === 'ER_NO_DEFAULT_FOR_FIELD' || code === 'ER_BAD_NULL_ERROR' || code === 'SQLITE_CONSTRAINT' || /(?:field|column)\s+[`"']?id[`"']?/i.test(message) || /not null constraint failed.*\bid\b/i.test(message)
                    if (!needGeneratedId) {
                        throw err
                    }
                    generatedId = tools.uuid()
                    rs = await BaseDao.dao.insert(this.table, { ...payload, id: generatedId })
                    const { affectedRows } = rs
                    return jsResponse(STCODES.SUCCESS, 'data insert success.', { affectedRows, id: generatedId })
                }
            }
        } catch (err) {
            (err as Error).message = `data insert fail: ${(err as Error).message}`
            return err
        }

        const { affectedRows } = rs
        return jsResponse(STCODES.SUCCESS, 'data insert success.', { affectedRows, id: providedId || generatedId || rs.insertId })
    }
    async update(params: Record<string, unknown> = {}, _fields: string[] = [], _session: { userid: string } = { userid: '' }): Promise<any> {
        await BaseDao.initDao()
        void _fields
        void _session
        params = params || {}
        let keys = Object.keys(params as Record<string, unknown>)
        if (params['id'] === undefined || keys.length <= 1)
            return jsResponse(STCODES.PARAMERR, 'params is error.')
        else {
            const id = params['id'] as string | number
            const { id: _id, ...restParams } = params
            let rs
            try {
                rs = await BaseDao.dao.update(this.table, restParams, id)
            } catch (err) {
                (err as Error).message = `data update fail: ${(err as Error).message}`
                return err
            }
            let { affectedRows } = rs
            return jsResponse(STCODES.SUCCESS, 'data update success.', { affectedRows, id: _id })
        }
    }
    async delete(params: Record<string, unknown> = {}, _fields: string[] = [], _session: { userid: string } = { userid: '' }): Promise<any> {
        await BaseDao.initDao()
        void _fields
        void _session
        if ((params as Record<string, unknown>)['id'] === undefined)
            return jsResponse(STCODES.PARAMERR, 'params is error.')
        else {
            let id = (params as Record<string, unknown>)['id'] as string | number
            let rs
            try {
                rs = await BaseDao.dao.delete(this.table, id)
            } catch (err) {
                (err as Error).message = `data delete fail: ${(err as Error).message}`
                return err
            }
            let { affectedRows } = rs
            return jsResponse(STCODES.SUCCESS, 'data delete success.', { affectedRows, id })
        }
    }
    async querySql(sql: string, values: unknown[] = [], params: Record<string, unknown> = {}, fields: string[] = []): Promise<any> {
        await BaseDao.initDao()
        let rs
        try {
            rs = await BaseDao.dao.querySql(sql, values, params, fields)
        } catch (err) {
            (err as Error).message = `data querySql fail: ${(err as Error).message}`
            return err
        }
        if (rs.status === STCODES.SUCCESS && (!rs.data || rs.data.length === 0))
            return jsResponse(STCODES.QUERYEMPTY, 'data query empty.', rs)
        else
            return processDatum(rs)
    }
    async execSql(sql: string, values: unknown[] = []): Promise<any> {
        await BaseDao.initDao()
        let rs
        try {
            rs = await BaseDao.dao.execSql(sql, values)
        } catch (err) {
            (err as Error).message = `data execSql fail: ${(err as Error).message}`
            return err
        }
        let { affectedRows } = rs
        return jsResponse(STCODES.SUCCESS, 'data execSql success.', { affectedRows })
    }
    async insertBatch(tablename: string, elements: Array<Record<string, unknown>> = []): Promise<any> {
        await BaseDao.initDao()
        let rs
        try {
            rs = await BaseDao.dao.insertBatch(tablename, elements)
        } catch (err) {
            (err as Error).message = `data batch fail: ${(err as Error).message}`
            return err
        }
        let { affectedRows } = rs
        return jsResponse(STCODES.SUCCESS, 'data batch success.', { affectedRows })
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
        return jsResponse(STCODES.SUCCESS, 'data trans success.', { affectedRows })
    }
    static async closeDao(): Promise<void> {
        if (BaseDao.dao && typeof BaseDao.dao.close === 'function') {
            await BaseDao.dao.close()
        }
    }
}

async function needsGeneratedId(table: string): Promise<boolean> {
    if (isJsonFileDialect()) return true
    if (isSqliteDialect()) {
        const schemaRs = await BaseDao.dao.querySql(
            `PRAGMA table_info(${quoteSqliteIdentifier(table)})`,
            [],
            {},
            []
        ) as any
        const rows = Array.isArray(schemaRs?.data) ? schemaRs.data : []
        const idColumn = rows.find((row: Record<string, unknown>) => String(row.name ?? '').toLowerCase() === 'id') as Record<string, unknown> | undefined
        if (!idColumn) return true
        const columnType = String(idColumn.type ?? '').toLowerCase()
        const pk = Number(idColumn.pk ?? 0)
        return !(pk === 1 && columnType.includes('int'))
    }

    const schemaRs = await BaseDao.dao.querySql(
        'SELECT EXTRA FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ? AND COLUMN_NAME = ?',
        [config.dbconfig.db_name, table, 'id'],
        {},
        []
    ) as any
    const idExtra = String(schemaRs?.data?.[0]?.EXTRA ?? '').toLowerCase()
    return !idExtra.includes('auto_increment')
}
function processDatum(rs: { data?: Array<Record<string, unknown>> } & Record<string, unknown>) {
    if (!rs || !Array.isArray(rs.data)) return rs
    rs.data.forEach(element => {
        const vs = Object.entries(element)
        for (const [key, value] of vs) {
            if (lodash.endsWith(key, '_time') && value) {
                const formatted = formatDateTime(value)
                if (formatted) {
                    ;(element as any)[key] = formatted
                }
            } else if (lodash.endsWith(key, '_json')) {
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
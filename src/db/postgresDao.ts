import * as lodash from 'lodash'
import { Pool, PoolClient, QueryResult } from 'pg'
import IDao from './idao'
import TransElement from '../common/transElement'
import { config, jsResponse, logger, runtime, tools } from '../inits/global'
import { STCODES } from '../inits/enums'
import { quotePostgresIdentifier } from './sqlDialect'

const QUERYSTATISKEYS = ['count', 'sum']
const QUERYEXTRAKEYS = ['lks', 'ins', 'ors']
const QUERYUNEQOPERS = ['>,', '>=,', '<,', '<=,', '<>,', '=,']

function toSqlPrimitiveString(value: unknown): string | null {
    if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') return String(value)
    return null
}

const pool = new Pool({
    host: config.dbconfig.db_host,
    port: Number(config.dbconfig.db_port) || 5432,
    database: config.dbconfig.db_name,
    user: config.dbconfig.db_user,
    password: config.dbconfig.db_pass,
    max: Number(config.dbconfig.db_conn) || 5,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 30000,
})

function quoteField(name: string): string {
    if (name === '*') return '*'
    return quotePostgresIdentifier(name)
}

function normalizeRunResult(result: QueryResult<any> | { rowCount?: number; rows?: Array<Record<string, unknown>> } = {}) {
    const rows = Array.isArray((result as any).rows) ? (result as any).rows : []
    return {
        affectedRows: Number((result as any).rowCount ?? 0),
        insertId: rows.length > 0 ? (rows[0]?.id ?? 0) : 0,
    }
}

function isSelectStatement(sql: string): boolean {
    const normalized = sql.trim().toLowerCase()
    return normalized.startsWith('select') || normalized.startsWith('with') || normalized.startsWith('show') || normalized.startsWith('explain')
}

function rewriteMysqlPlaceholders(sql: string, values: unknown[]): { sql: string; values: unknown[] } {
    let index = 0
    const nextValues: unknown[] = []
    const rewrittenSql = sql.replace(/\?\?|\?/g, (placeholder) => {
        const current = values[index++]
        if (placeholder === '??') {
            return quotePostgresIdentifier(String(current))
        }
        nextValues.push(current)
        return `$${nextValues.length}`
    })
    return { sql: rewrittenSql, values: nextValues }
}

function parseMaybeList(value: unknown): unknown[] | null {
    if (Array.isArray(value)) return value
    if (typeof value !== 'string') return null
    if (!value.startsWith('[') && value.indexOf(',') < 0) return null
    return runtime.tools.arryParse(value)
}

function isNil(value: unknown): boolean {
    return value === null || value === undefined
}

function toComparableNumber(value: unknown): number | null {
    if (typeof value === 'number' && Number.isFinite(value)) return value
    if (typeof value === 'string' && value.trim().length > 0) {
        const parsed = Number(value)
        if (Number.isFinite(parsed)) return parsed
    }
    return null
}

function valuesEqual(left: unknown, right: unknown): boolean {
    if (isNil(left) && isNil(right)) return true
    if (isNil(left) || isNil(right)) return false
    const leftNumber = toComparableNumber(left)
    const rightNumber = toComparableNumber(right)
    if (leftNumber !== null && rightNumber !== null) {
        return leftNumber === rightNumber
    }
    return String(left) === String(right)
}

function containsValue(left: unknown, right: unknown): boolean {
    if (isNil(left) || isNil(right)) return false
    return String(left).includes(String(right))
}

function compareByOperator(left: unknown, operator: string, right: unknown): boolean {
    const leftNumber = toComparableNumber(left)
    const rightNumber = toComparableNumber(right)
    const leftValue = leftNumber ?? String(left ?? '')
    const rightValue = rightNumber ?? String(right ?? '')

    switch (operator) {
        case '>,':
            return leftNumber !== null && rightNumber !== null ? leftNumber > rightNumber : String(leftValue) > String(rightValue)
        case '>=,':
            return leftNumber !== null && rightNumber !== null ? leftNumber >= rightNumber : String(leftValue) >= String(rightValue)
        case '<,':
            return leftNumber !== null && rightNumber !== null ? leftNumber < rightNumber : String(leftValue) < String(rightValue)
        case '<=,':
            return leftNumber !== null && rightNumber !== null ? leftNumber <= rightNumber : String(leftValue) <= String(rightValue)
        case '<>,':
            return !valuesEqual(left, right)
        case '=,':
            return valuesEqual(left, right)
        default:
            return false
    }
}

function buildWhereClause(params: Record<string, unknown> | unknown[], values: unknown[]): { where: string; values: unknown[] } {
    params = params || {}
    let where = ''
    const andJoinStr = ' and '

    let { sort, search, fuzzy, page: _page, size: _size, sum, count, group, ...restParams } = params as Record<string, unknown>
    let page: number | undefined = _page as any
    let size: number | undefined = _size as any
    let { lks, ins, ors } = restParams as any
    let queryKeys: Record<string, unknown> = { ors, count, lks, ins, sum }
    const isFuzzySearch = search !== undefined || fuzzy !== undefined
    page = page || 0
    size = size || runtime.PAGESIZE

    const keys: string[] = Object.keys(restParams)
    for (let i = 0; i < keys.length; i++) {
        const key = keys[i]
        let value: any = (params as Record<string, any>)[key]
        if (QUERYEXTRAKEYS.indexOf(key) < 0) {
            const isArr = parseMaybeList(value)
            if (isArr) value = isArr
        }
        if (where !== '') where += andJoinStr

        if (QUERYEXTRAKEYS.indexOf(key) >= 0) {
            let whereExtra = ''
            let err: string | null = null
            const ele = queryKeys[key] = parseMaybeList(queryKeys[key])
            if (!ele || ele.length < 2 || ((key === 'ors' || key === 'lks') && ele.length % 2 === 1)) {
                err = `Format of ${key} is wrong.`
            } else {
                if (key === 'ins') {
                    const c = ele.shift()
                    const cText = toSqlPrimitiveString(c)
                    if (cText === null) {
                        return { where: '', values: [] }
                    }
                    const placeholders = ele.map(() => '?').join(',')
                    whereExtra += `${quoteField(cText)} in ( ${placeholders} ) `
                    values.push(...ele)
                } else if (key === 'lks' || key === 'ors') {
                    whereExtra = ' ( '
                    for (let j = 0; j < ele.length; j += 2) {
                        if (j > 0) whereExtra += ' or '
                        const field = toSqlPrimitiveString(ele[j])
                        if (field === null) {
                            return { where: '', values: [] }
                        }
                        const val = ele[j + 1]
                        if (val == null) {
                            whereExtra += `${quoteField(field)} is null `
                        } else {
                            const valueText = toSqlPrimitiveString(val)
                            if (valueText === null) {
                                return { where: '', values: [] }
                            }
                                if (key === 'lks') {
                                    whereExtra += `CAST(${quoteField(field)} AS text) like ? `
                                } else {
                                    whereExtra += `${quoteField(field)} = ? `
                                }
                            values.push(key === 'lks' ? `%${valueText}%` : valueText)
                        }
                    }
                    whereExtra += ' ) '
                }
            }
            if (err) {
                where += ''
            } else {
                where += whereExtra
            }
        } else {
            if (value === 'null') {
                where += `${quoteField(keys[i])} is null `
            } else if ((Array.isArray(value) && (value.length === 2 || value.length === 4)) &&
                QUERYUNEQOPERS.some((element) => {
                    if (Array.isArray(value)) {
                        return value.join().startsWith(element)
                    } else if (typeof value === 'string') {
                        return value.startsWith(element)
                    }
                    return false
                })
            ) {
                if (Array.isArray(value)) value = value.join()
                const vls = (value as string).split(',')
                if (vls.length === 2) {
                    where += `${quoteField(keys[i])}${vls[0]} ? `
                    values.push(vls[1])
                } else if (vls.length === 4) {
                    where += `${quoteField(keys[i])}${vls[0]} ? and ${quoteField(keys[i])}${vls[2]} ? `
                    values.push(vls[1])
                    values.push(vls[3])
                } else {
                    if (where.endsWith(andJoinStr)) where = where.substring(0, where.length - andJoinStr.length)
                }
            } else if (isFuzzySearch) {
                where += `CAST(${quoteField(keys[i])} AS text) like ?`
                values.push(`%${String(value)}%`)
            } else {
                where += `${quoteField(keys[i])} = ? `
                values.push(value)
            }
        }
    }

    let extra = ''
    for (let i = 0; i < QUERYSTATISKEYS.length; i++) {
        const element = QUERYSTATISKEYS[i]
        if (queryKeys[element]) {
            const ele = queryKeys[element] = parseMaybeList(queryKeys[element])
            if (!ele || ele.length === 0 || ele.length % 2 === 1) {
                return { where: '', values: [] }
            }
            for (let j = 0; j < ele.length; j += 2) {
                const rawName = toSqlPrimitiveString(ele[j])
                const rawAlias = toSqlPrimitiveString(ele[j + 1])
                if (rawName === null || rawAlias === null) {
                    return { where: '', values: [] }
                }
                // For postgres, avoid quoting numeric literals or '*' inside aggregate functions
                const statField = (rawName === '*' || /^[0-9]+$/.test(rawName)) ? rawName : quoteField(rawName)
                extra += `,${element}(${statField}) as ${quotePostgresIdentifier(rawAlias)} `
            }
        }
    }

    return { where, values }
}

function buildInsertStatement(tablename: string, params: Record<string, unknown>): { sql: string; values: unknown[] } {
    const keys = Object.keys(params)
    const columns = keys.map(quoteField).join(', ')
    const placeholders = keys.map(() => '?').join(', ')
    return {
        sql: `INSERT INTO ${quotePostgresIdentifier(tablename)} (${columns}) VALUES (${placeholders}) RETURNING ${quotePostgresIdentifier('id')}`,
        values: keys.map((key) => params[key]),
    }
}

function buildUpdateStatement(tablename: string, params: Record<string, unknown>, id: string | number): { sql: string; values: unknown[] } {
    const keys = Object.keys(params)
    const sets = keys.map((key) => `${quoteField(key)} = ?`).join(', ')
    return {
        sql: `UPDATE ${quotePostgresIdentifier(tablename)} SET ${sets} WHERE ${quotePostgresIdentifier('id')} = ?`,
        values: keys.map((key) => params[key]).concat([id]),
    }
}

function buildDeleteStatement(tablename: string, id: string | number): { sql: string; values: unknown[] } {
    return {
        sql: `DELETE FROM ${quotePostgresIdentifier(tablename)} WHERE ${quotePostgresIdentifier('id')} = ?`,
        values: [id],
    }
}

function buildBatchStatement(tablename: string, elements: Array<Record<string, unknown>>): { sql: string; values: unknown[] } {
    if (elements.length === 0) {
        return {
            sql: 'SELECT 1',
            values: [],
        }
    }
    const keys = Object.keys(elements[0])
    const columns = keys.map(quoteField).join(', ')
    const rowPlaceholders = `(${keys.map(() => '?').join(', ')})`
    const values: unknown[] = []
    for (const element of elements) {
        for (const key of keys) {
            values.push(element[key])
        }
    }
    let sql = `INSERT INTO ${quotePostgresIdentifier(tablename)} (${columns}) VALUES ${elements.map(() => rowPlaceholders).join(', ')}`
    if (keys.includes('id')) {
        const updateClause = keys
            .filter((key) => key !== 'id')
            .map((key) => `${quoteField(key)} = EXCLUDED.${quoteField(key)}`)
            .join(', ')
        if (updateClause.length > 0) {
            sql += ` ON CONFLICT(${quoteField('id')}) DO UPDATE SET ${updateClause}`
        } else {
            sql += ` ON CONFLICT(${quoteField('id')}) DO NOTHING`
        }
    }
    sql += ` RETURNING ${quotePostgresIdentifier('id')}`
    return { sql, values }
}

async function queryRows(sql: string, values: unknown[] = []): Promise<any[]> {
    const rewritten = rewriteMysqlPlaceholders(sql, values)
    const result = await pool.query(rewritten.sql, rewritten.values)
    return result.rows || []
}

async function runStatement(sql: string, values: unknown[] = []): Promise<any> {
    const rewritten = rewriteMysqlPlaceholders(sql, values)
    const result = await pool.query(rewritten.sql, rewritten.values)
    return normalizeRunResult(result)
}

async function executeTransaction(sqls: Array<{ text: string; values: unknown[] }>): Promise<any> {
    const client: PoolClient = await pool.connect()
    try {
        await client.query('BEGIN')
        const resp: Array<any> = []
        for (const sqlParam of sqls) {
            const rewritten = rewriteMysqlPlaceholders(sqlParam.text, sqlParam.values)
            const result = await client.query(rewritten.sql, rewritten.values)
            resp.push(result)
        }
        await client.query('COMMIT')
        return jsResponse(STCODES.SUCCESS, 'trans run success', { resp, affectedRows: sqls.length })
    } catch (err) {
        try {
            await client.query('ROLLBACK')
        } catch {
            // ignore rollback failure and surface the original error
        }
        throw err
    } finally {
        client.release()
    }
}

export default class PostgresDao implements IDao {
    static logFlag = config.DbLogClose ? false : true

    select(tablename: string, params: Record<string, unknown> = {}, fields?: string[]): Promise<unknown> {
        fields = fields || []
        return this.query(tablename, params, fields, '', [])
    }

    insert(tablename: string, params: Record<string, unknown> = {}): Promise<unknown> {
        const statement = buildInsertStatement(tablename, params)
        return runStatement(statement.sql, statement.values)
    }

    update(tablename: string, params: Record<string, unknown> = {}, id: string | number): Promise<unknown> {
        const statement = buildUpdateStatement(tablename, params, id)
        return runStatement(statement.sql, statement.values)
    }

    delete(tablename: string, id: string | number): Promise<unknown> {
        const statement = buildDeleteStatement(tablename, id)
        return runStatement(statement.sql, statement.values)
    }

    querySql(sql: string, values: unknown[], params: Record<string, unknown> = {}, fields?: string[]): Promise<unknown> {
        fields = fields || []
        params = params || {}
        return this.query('QuerySqlSelect', params, fields, sql, values)
    }

    execSql(sql: string, values: unknown[]): Promise<unknown> {
        return runStatement(sql, values)
    }

    insertBatch(tablename: string, elements: Array<Record<string, unknown>>): Promise<any> {
        const statement = buildBatchStatement(tablename, elements)
        return runStatement(statement.sql, statement.values)
    }

    transGo(elements: Array<TransElement>, isAsync: boolean = true): Promise<any> {
        void isAsync
        const sqls: Array<{ text: string; values: unknown[] }> = []
        elements.forEach((ele) => {
            if (ele.sql !== undefined) {
                sqls.push({ text: ele.sql, values: Array.isArray(ele.params) ? ele.params : [] })
                return
            }

            if (ele.method === 'Insert' && !Array.isArray(ele.params)) {
                const statement = buildInsertStatement(ele.table, ele.params as Record<string, unknown>)
                sqls.push({ text: statement.sql, values: statement.values })
            } else if (ele.method === 'Update' && !Array.isArray(ele.params) && ele.id !== undefined) {
                const statement = buildUpdateStatement(ele.table, ele.params as Record<string, unknown>, ele.id)
                sqls.push({ text: statement.sql, values: statement.values })
            } else if (ele.method === 'Delete' && ele.id !== undefined) {
                const statement = buildDeleteStatement(ele.table, ele.id)
                sqls.push({ text: statement.sql, values: statement.values })
            } else if (ele.method === 'Batch' && Array.isArray(ele.params)) {
                const statement = buildBatchStatement(ele.table, ele.params as Array<Record<string, unknown>>)
                sqls.push({ text: statement.sql, values: statement.values })
            }
        })
        return executeTransaction(sqls)
    }

    close(): Promise<void> {
        return pool.end()
    }

    private async query(tablename: string, params: Record<string, unknown> | unknown[], fields: string[] = [], sql = '', values: unknown[] = []): Promise<any> {
        params = params || {}
        let { sort, search, fuzzy, page: _page, size: _size, sum, count, group, ...restParams } = params as Record<string, unknown>
        let page: number | undefined = _page as any
        let size: number | undefined = _size as any
        let { lks, ins, ors } = restParams as any
        let queryKeys: Record<string, unknown> = { ors, count, lks, ins, sum }
        const isFuzzySearch = search !== undefined || fuzzy !== undefined
        page = page || 0
        size = size || runtime.PAGESIZE

        const whereBuild = buildWhereClause(params, values)
        const where = whereBuild.where
        values = whereBuild.values

        let extra = ''
        for (let i = 0; i < QUERYSTATISKEYS.length; i++) {
            const element = QUERYSTATISKEYS[i]
            if (queryKeys[element]) {
                const ele = queryKeys[element] = parseMaybeList(queryKeys[element])
                if (!ele || ele.length === 0 || ele.length % 2 === 1) {
                    return Promise.resolve(jsResponse(STCODES.PARAMERR, `Format of ${element} is wrong.`))
                }
                for (let j = 0; j < ele.length; j += 2) {
                    const rawName = toSqlPrimitiveString(ele[j])
                    const rawAlias = toSqlPrimitiveString(ele[j + 1])
                    if (rawName === null || rawAlias === null) {
                        return Promise.resolve(jsResponse(STCODES.PARAMERR, `Format of ${element} is wrong.`))
                    }
                    const statField = (rawName === '*' || /^[0-9]+$/.test(rawName)) ? rawName : quoteField(rawName)
                    extra += `,${element}(${statField}) as ${quotePostgresIdentifier(rawAlias)} `
                }
            }
        }

        if (tablename === 'QuerySqlSelect') {
            sql = sql + (where === '' ? '' : (' and ' + where))
        } else {
            // If grouping, select the group key and aggregated expressions only (Postgres requires grouped columns)
            if (group !== undefined) {
                const groupText = toSqlPrimitiveString(group)
                if (groupText === null) return Promise.reject(jsResponse(STCODES.PARAMERR, 'Invalid group value.'))
                sql = `SELECT ${quoteField(groupText)}${extra} FROM ${quotePostgresIdentifier(tablename)} `
                if (where !== '') sql += ' WHERE ' + where
                sql += ` GROUP BY ${quoteField(groupText)}`
            } else {
                // If there are aggregate selections (extra), select aggregates only for Postgres
                const aggPart = extra.trim().length > 0 ? extra.replace(/^,/, '').trim() : ''
                if (aggPart.length > 0) {
                    sql = `SELECT ${aggPart} FROM ${quotePostgresIdentifier(tablename)} `
                    if (where !== '') sql += ' WHERE ' + where
                } else {
                    sql = `SELECT ${fields.length > 0 ? fields.map(quoteField).join(',') : '*'} FROM ${quotePostgresIdentifier(tablename)} `
                    if (where !== '') sql += ' WHERE ' + where
                }
            }
        }

        if (sort !== undefined) {
            const sortText = toSqlPrimitiveString(sort)
            if (sortText === null) return Promise.reject(jsResponse(STCODES.PARAMERR, 'Invalid sort value.'))
            sql += ` ORDER BY ${sortText}`
        }

        if (page > 0) {
            page--
            const sqlQuery = `${sql} LIMIT ${String(size)} OFFSET ${String(page * size)}`
            const index = sql.toLocaleLowerCase().lastIndexOf(' from ')
            const end = sql.toLocaleLowerCase().lastIndexOf(' order by')
            const sqlCount = `SELECT count(1) as count ${sql.substring(index, end > 0 ? end : sql.length)}`
            if (PostgresDao.logFlag && logger && typeof logger.debug === 'function') {
                logger.debug(`_Sql_ : ${sqlQuery} _Values_ : ${JSON.stringify(values)}`)
                logger.debug(`_SqlCount_ : ${sqlCount} _Values_ : ${JSON.stringify(values)}`)
            }
            let resp: any
            try {
                resp = await Promise.all([queryRows(sqlQuery, values), queryRows(sqlCount, values)])
            } catch (err) {
                if (logger && typeof logger.error === 'function') logger.error(String((err as any)?.message ?? err))
                return Promise.resolve(jsResponse(STCODES.DBOPERATEERR, (err as any)?.message ?? String(err)))
            }
            let ct = 0
            if (group) {
                ct = (resp[1] as any).length
            } else if ((resp[1] as any).length > 0) {
                ct = Number((resp[1] as any)[0].count ?? 0)
            }
            const outPage = jsResponse(STCODES.SUCCESS, 'data query success.', {
                data: resp[0],
                pages: Math.ceil(ct / size),
                records: ct,
            })
            if (PostgresDao.logFlag && logger && typeof logger.debug === 'function') {
                try { logger.debug(`_Resp_ : ${JSON.stringify(outPage)}`) } catch { }
            }
            return outPage
        }

        if (PostgresDao.logFlag && logger && typeof logger.debug === 'function') {
            logger.debug(`_Sql_ : ${sql} _Values_ : ${JSON.stringify(values)}`)
        }
        let rs: any
        try {
            rs = await queryRows(sql, values)
        } catch (err) {
            if (logger && typeof logger.error === 'function') logger.error(String((err as any)?.message ?? err))
            return Promise.resolve(jsResponse(STCODES.DBOPERATEERR, (err as any)?.message ?? String(err)))
        }
        const out = jsResponse(STCODES.SUCCESS, 'data query success.', {
            data: rs,
            pages: (rs as any).length > 0 ? 1 : 0,
            records: (rs as any).length,
        })
        if (PostgresDao.logFlag && logger && typeof logger.debug === 'function') {
            try { logger.debug(`_Resp_ : ${JSON.stringify(out)}`) } catch { }
        }
        return out
    }
}
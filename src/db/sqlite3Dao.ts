import * as fs from 'fs'
import * as path from 'path'
import sqlite3 = require('sqlite3')
import IDao from './idao'
import TransElement from '../common/transElement'
import { config, jsResponse, logger, runtime } from '../inits/global'
import { STCODES } from '../inits/enums'
import { quoteSqliteIdentifier } from './sqlDialect'

const SQLITE = sqlite3.verbose()

function resolveDatabasePath(): string {
    const dbName = String(config.dbconfig.db_name || ':memory:').trim()
    if (dbName === '' || dbName === ':memory:' || dbName.startsWith('file:')) {
        return dbName === '' ? ':memory:' : dbName
    }
    const absolutePath = path.isAbsolute(dbName) ? dbName : path.resolve(process.cwd(), dbName)
    fs.mkdirSync(path.dirname(absolutePath), { recursive: true })
    return absolutePath
}

function isSelectStatement(sql: string): boolean {
    const normalized = sql.trim().toLowerCase()
    return normalized.startsWith('select') || normalized.startsWith('with') || normalized.startsWith('pragma') || normalized.startsWith('explain')
}

function toSqlPrimitiveString(value: unknown): string | null {
    if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') return String(value)
    return null
}

function parseMaybeList(value: unknown): unknown[] | null {
    if (Array.isArray(value)) return value
    if (typeof value !== 'string') return null
    if (!value.startsWith('[') && value.indexOf(',') < 0) return null
    return runtime.tools.arryParse(value)
}

function quoteField(name: string): string {
    if (name === '*') return '*'
    return quoteSqliteIdentifier(name)
}

function normalizeRunResult(result: { changes?: number; lastID?: number } = {}) {
    return {
        affectedRows: Number(result.changes ?? 0),
        insertId: Number(result.lastID ?? 0),
    }
}

function getRunResult(sqliteResult: any) {
    if (!sqliteResult || typeof sqliteResult !== 'object') {
        return normalizeRunResult()
    }
    return normalizeRunResult(sqliteResult)
}

const db = new SQLITE.Database(resolveDatabasePath(), SQLITE.OPEN_READWRITE | SQLITE.OPEN_CREATE, (err) => {
    if (err && logger && typeof logger.error === 'function') {
        logger.error(`sqlite open fail: ${String((err as any)?.message ?? err)}`)
    }
})

function runSql(sql: string, values: unknown[] = []): Promise<any> {
    return new Promise((resolve, reject) => {
        db.run(sql, values, function (err) {
            if (err) {
                reject(jsResponse(STCODES.DBOPERATEERR, (err as any)?.message ?? String(err)))
                if (logger && typeof logger.error === 'function') logger.error(`${String((err as any)?.message ?? err)} _Sql_ : ${sql} _Values_ : ${JSON.stringify(values)}`)
                return
            }
            resolve(getRunResult(this))
        })
    })
}

function allSql(sql: string, values: unknown[] = []): Promise<any[]> {
    return new Promise((resolve, reject) => {
        db.all(sql, values, (err, rows) => {
            if (err) {
                reject(jsResponse(STCODES.DBOPERATEERR, (err as any)?.message ?? String(err)))
                if (logger && typeof logger.error === 'function') logger.error(`${String((err as any)?.message ?? err)} _Sql_ : ${sql} _Values_ : ${JSON.stringify(values)}`)
                return
            }
            resolve(rows || [])
        })
    })
}

function queryOnSelect(sql: string, values: unknown[] = []): Promise<any> {
    if (isSelectStatement(sql)) {
        return allSql(sql, values)
    }
    return runSql(sql, values)
}

function rewriteMysqlPlaceholders(sql: string, values: unknown[]): { sql: string; values: unknown[] } {
    let index = 0
    const nextValues: unknown[] = []
    const rewrittenSql = sql.replace(/\?\?|\?/g, (placeholder) => {
        const current = values[index++]
        if (placeholder === '??') {
            return quoteSqliteIdentifier(String(current))
        }
        nextValues.push(current)
        return '?'
    })
    return { sql: rewrittenSql, values: nextValues }
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
        if (['lks', 'ins', 'ors'].indexOf(key) < 0) {
            const isArr = parseMaybeList(value)
            if (isArr) value = isArr
        }
        if (where !== '') where += andJoinStr

        if (['lks', 'ins', 'ors'].indexOf(key) >= 0) {
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
                            whereExtra += `${quoteField(field)} ${key === 'lks' ? 'like' : '='} ? `
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
                ['>,', '>=,', '<,', '<=,', '<>,', '=,'].some((element) => {
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
                where += `${quoteField(keys[i])} like ?`
                values.push(`%${String(value)}%`)
            } else {
                where += `${quoteField(keys[i])} = ? `
                values.push(value)
            }
        }
    }

    let extra = ''
    for (let i = 0; i < ['count', 'sum'].length; i++) {
        const element = ['count', 'sum'][i]
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
                extra += `,${element}(${quoteField(rawName)}) as ${quoteSqliteIdentifier(rawAlias)} `
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
        sql: `INSERT INTO ${quoteSqliteIdentifier(tablename)} (${columns}) VALUES (${placeholders})`,
        values: keys.map((key) => params[key]),
    }
}

function buildUpdateStatement(tablename: string, params: Record<string, unknown>, id: string | number): { sql: string; values: unknown[] } {
    const keys = Object.keys(params)
    const sets = keys.map((key) => `${quoteField(key)} = ?`).join(', ')
    return {
        sql: `UPDATE ${quoteSqliteIdentifier(tablename)} SET ${sets} WHERE ${quoteField('id')} = ?`,
        values: keys.map((key) => params[key]).concat([id]),
    }
}

function buildDeleteStatement(tablename: string, id: string | number): { sql: string; values: unknown[] } {
    return {
        sql: `DELETE FROM ${quoteSqliteIdentifier(tablename)} WHERE ${quoteField('id')} = ?`,
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
    let sql = `INSERT INTO ${quoteSqliteIdentifier(tablename)} (${columns}) VALUES ${elements.map(() => rowPlaceholders).join(', ')}`
    if (keys.includes('id')) {
        const updateClause = keys
            .filter((key) => key !== 'id')
            .map((key) => `${quoteField(key)} = excluded.${quoteField(key)}`)
            .join(', ')
        if (updateClause.length > 0) {
            sql += ` ON CONFLICT(${quoteField('id')}) DO UPDATE SET ${updateClause}`
        }
    }
    return { sql, values }
}

async function executeTransaction(sqls: Array<{ text: string; values: unknown[] }>): Promise<any> {
    await runSql('BEGIN TRANSACTION', [])
    try {
        for (const sqlParam of sqls) {
            await queryOnSelect(sqlParam.text, sqlParam.values)
        }
        await runSql('COMMIT', [])
        return normalizeRunResult({ changes: sqls.length })
    } catch (err) {
        try {
            await runSql('ROLLBACK', [])
        } catch {
            // ignore rollback failure and surface the original error
        }
        throw err
    }
}

export default class Sqlite3Dao implements IDao {
    static logFlag = config.DbLogClose ? false : true

    select(tablename: string, params: Record<string, unknown> = {}, fields?: string[]): Promise<unknown> {
        fields = fields || []
        return this.query(tablename, params, fields, '', [])
    }

    insert(tablename: string, params: Record<string, unknown> = {}): Promise<unknown> {
        const statement = buildInsertStatement(tablename, params)
        return runSql(statement.sql, statement.values)
    }

    update(tablename: string, params: Record<string, unknown> = {}, id: string | number): Promise<unknown> {
        const statement = buildUpdateStatement(tablename, params, id)
        return runSql(statement.sql, statement.values)
    }

    delete(tablename: string, id: string | number): Promise<unknown> {
        const statement = buildDeleteStatement(tablename, id)
        return runSql(statement.sql, statement.values)
    }

    querySql(sql: string, values: unknown[], params: Record<string, unknown> = {}, fields?: string[]): Promise<unknown> {
        fields = fields || []
        params = params || {}
        return this.query('QuerySqlSelect', params, fields, sql, values)
    }

    execSql(sql: string, values: unknown[]): Promise<unknown> {
        const rewritten = rewriteMysqlPlaceholders(sql, values)
        return runSql(rewritten.sql, rewritten.values)
    }

    insertBatch(tablename: string, elements: Array<Record<string, unknown>>): Promise<any> {
        const statement = buildBatchStatement(tablename, elements)
        return runSql(statement.sql, statement.values)
    }

    transGo(elements: Array<TransElement>, isAsync: boolean = true): Promise<any> {
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
        return new Promise((resolve, reject) => {
            db.close((err) => {
                if (err) {
                    reject(err)
                    return
                }
                resolve()
            })
        })
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
        for (let i = 0; i < ['count', 'sum'].length; i++) {
            const element = ['count', 'sum'][i]
            if (queryKeys[element]) {
                const ele = (global as any).G?.tools?.arryParse ? (global as any).G.tools.arryParse(queryKeys[element]) : null
                if (!ele || ele.length === 0 || ele.length % 2 === 1) {
                    return Promise.resolve(jsResponse(STCODES.PARAMERR, `Format of ${element} is wrong.`))
                }
                for (let j = 0; j < ele.length; j += 2) {
                    const rawName = toSqlPrimitiveString(ele[j])
                    const rawAlias = toSqlPrimitiveString(ele[j + 1])
                    if (rawName === null || rawAlias === null) {
                        return Promise.resolve(jsResponse(STCODES.PARAMERR, `Format of ${element} is wrong.`))
                    }
                    extra += `,${element}(${quoteField(rawName)}) as ${quoteSqliteIdentifier(rawAlias)} `
                }
            }
        }

        if (tablename === 'QuerySqlSelect') {
            sql = sql + (where === '' ? '' : (' and ' + where))
        } else {
            sql = `SELECT ${fields.length > 0 ? fields.map(quoteField).join(',') : '*'}${extra} FROM ${quoteSqliteIdentifier(tablename)} `
            if (where !== '') sql += ' WHERE ' + where
        }

        if (group !== undefined) {
            const groupText = toSqlPrimitiveString(group)
            if (groupText === null) return Promise.reject(jsResponse(STCODES.PARAMERR, 'Invalid group value.'))
            sql += ` GROUP BY ${groupText}`
        }

        if (sort !== undefined) {
            const sortText = toSqlPrimitiveString(sort)
            if (sortText === null) return Promise.reject(jsResponse(STCODES.PARAMERR, 'Invalid sort value.'))
            sql += ` ORDER BY ${sortText}`
        }

        if (page > 0) {
            page--
            const sqlQuery = `${sql} LIMIT ${String(page * size)},${String(size)}`
            const index = sql.toLocaleLowerCase().lastIndexOf(' from ')
            const end = sql.toLocaleLowerCase().lastIndexOf(' order by')
            const sqlCount = `SELECT count(1) as count ${sql.substring(index, end > 0 ? end : sql.length)}`
            const resp = await Promise.all([queryOnSelect(sqlQuery, values), queryOnSelect(sqlCount, values)])
            let ct = 0
            if (group) {
                ct = (resp[1] as any).length
            } else if ((resp[1] as any).length > 0) {
                ct = (resp[1] as any)[0].count
            }
            return jsResponse(STCODES.SUCCESS, 'data query success.', {
                data: resp[0],
                pages: Math.ceil(ct / size),
                records: ct,
            })
        }

        const rs = await queryOnSelect(sql, values)
        return jsResponse(STCODES.SUCCESS, 'data query success.', {
            data: rs,
            pages: (rs as any).length > 0 ? 1 : 0,
            records: (rs as any).length,
        })
    }
}
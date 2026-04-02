import * as lodash from 'lodash'
import IDao from './idao'
import { createPool, PoolOptions } from 'mysql2'
import TransElement from '../common/transElement'
import { config, jsResponse, logger, runtime, tools } from '../inits/global'
import { STCODES } from '../inits/enums'

const OPMETHODS: Record<string, string> = {
    Insert : 'INSERT INTO ?? SET ?',
    Update : 'UPDATE ?? SET ? WHERE ?',
    Delete : 'DELETE FROM ?? WHERE ?',
    Batch  : 'INSERT INTO ?? (??) VALUES ',
}

const QUERYSTATISKEYS = ['count', 'sum']
const QUERYEXTRAKEYS = ['lks', 'ins', 'ors']
const QUERYUNEQOPERS = ['>,', '>=,', '<,', '<=,', '<>,', '=,']

function toSqlPrimitiveString(value: unknown): string | null {
    if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') return String(value)
    return null
}

let options: PoolOptions = {
    'host': config.dbconfig.db_host,
    'port': config.dbconfig.db_port,
    'database': config.dbconfig.db_name,
    'user': config.dbconfig.db_user,
    'password': config.dbconfig.db_pass,
    'charset': config.dbconfig.db_char,
    'connectionLimit': config.dbconfig.db_conn,
    'connectTimeout' : 30000,
    'supportBigNumbers': true,
    'bigNumberStrings': true
}

let pool = createPool(options)

export default class MysqlDao implements IDao {
    static logFlag = config.DbLogClose ? false : true

    select(tablename: string, params: Record<string, unknown> = {}, fields?: string[]): Promise<unknown> {
        fields = fields || []
        return this.query(tablename, params, fields, '', [])
    }
    insert(tablename: string, params: Record<string, unknown> = {}): Promise<unknown> {
        return this.execQuery(OPMETHODS['Insert'], [tablename, params])
    }
    update(tablename: string, params: Record<string, unknown> = {}, id: string|number): Promise<unknown> {
        return this.execQuery(OPMETHODS['Update'], [tablename, params, {id}])
    }
    delete(tablename: string, id: string|number): Promise<unknown> {
        return this.execQuery(OPMETHODS['Delete'], [tablename, {id}])
    }
    querySql(sql: string, values: unknown[], params: Record<string, unknown> = {}, fields?: string[]): Promise<unknown> {
        fields = fields || []
        params = params || {}
        return this.query('QuerySqlSelect', params, fields, sql, values)
    }
    execSql(sql: string, values: unknown[]): Promise<unknown> {
        return this.execQuery(sql, values)
    }
    insertBatch(tablename: string, elements: Array<Record<string, unknown>>): Promise<any> {
        let sql: string = OPMETHODS['Batch']
        let updateStr = ''
        let values: unknown[] = [tablename]
        let valKeys: string[] = []

        for (let i = 0; i < elements.length; i++) {
            if (i === 0) {
                valKeys = Object.keys(elements[i])
                values.push(valKeys)
            }
            let valueStr = []
            for (let j = 0; j < valKeys.length; j++) {
                valueStr.push(elements[i][valKeys[j]])
                if (i === 0)
                    updateStr += valKeys[j] + ' = values(' + valKeys[j] + '),'
            }
            values.push(valueStr)
            sql += ' (?),'
        }
        sql = sql.substring(0, sql.length - 1)
        sql += ' ON DUPLICATE KEY UPDATE '
        sql += updateStr.substring(0, updateStr.length - 1)

        return this.execQuery(sql, values)
    }
    transGo(elements: Array<TransElement>, isAsync: boolean = true): Promise<any> {
        let sqls: Array<{ text: string; values: unknown[] }> = []
        elements.forEach((ele) => {
            let values: unknown[] = [ele.table]
            const params = ele.params
            const keys = Array.isArray(params) ? [] : Object.keys(params)

            if (Array.isArray(params)) {
                values = values.concat(params)
            } else if (keys.length > 0) {
                values.push(params)
            }

            if (ele.id !== undefined)
                values.push({id: ele.id})

            let sql = {text: '', values}
            if (ele.sql !== undefined) {
                sql.text = ele.sql
            } else {
                sql.text = OPMETHODS[ele.method]
            }

            sqls.push(sql)
        })
        return this.execTrans (sqls, isAsync)
    }
    private execTrans(sqls: Array<any>, isAsync: boolean): Promise<any> {
        return new Promise((resolve, reject) => {
            pool.getConnection((err, conn) => {
                if (err) {
                    reject(jsResponse(STCODES.DBCONNECTERR, (err as any)?.message ?? String(err)))
                    logger.error(String((err as any)?.message ?? err))
                    return
                }

                if (MysqlDao.logFlag && logger && typeof logger.debug === 'function') {
                    logger.debug(`Beginning ${isAsync ? 'Async' : 'Sync'} trans, ${String(sqls.length)} operations are going to do.`)
                }

                conn.beginTransaction((err) => {
                    if (err) {
                        reject(jsResponse(STCODES.DBOPERATEERR, (err as any)?.message ?? String(err)))
                        return
                    }

                    const doOne = (sqlParam: { text: string; values: object | Array<any> }): Promise<any> => {
                        return new Promise((resolveOne, rejectOne) => {
                            const sql = sqlParam.text
                            const values = sqlParam.values
                            conn.query(sql, values as any, (queryErr, result) => {
                                if (queryErr) {
                                    conn.rollback(() => {
                                        logger.error(`${isAsync ? 'Async' : 'Sync'} trans run fail, _Sql_ : ${String(sqlParam.text)}, _Values_ : ${JSON.stringify(sqlParam.values)}, _Err_ : ${String((queryErr as any)?.message ?? queryErr)}`)
                                        rejectOne(jsResponse(STCODES.DBOPERATEERR, (queryErr as any)?.message ?? String(queryErr)))
                                    })
                                    return
                                }

                                if (MysqlDao.logFlag && logger && typeof logger.debug === 'function') {
                                    logger.debug(`${isAsync ? 'Async' : 'Sync'} trans run success, _Sql_ : ${String(sqlParam.text)}, _Values_ : ${JSON.stringify(sqlParam.values)}`)
                                }
                                resolveOne(jsResponse(STCODES.SUCCESS, 'trans run success', result))
                            })
                        })
                    }

                    const goTrans = (sqlArr: Array<any>) => {
                        if (sqlArr.length > 0) {
                            doOne(sqlArr.shift()).then(() => {
                                goTrans(sqlArr)
                            }).catch((transErr) => {
                                reject(jsResponse(STCODES.DBOPERATEERR, (transErr as any)?.message ?? String(transErr)))
                            })
                        } else {
                            conn.commit((commitErr) => {
                                if (commitErr) {
                                    conn.rollback(() => {
                                        conn.release()
                                    })
                                    if (MysqlDao.logFlag && logger && typeof logger.debug === 'function') {
                                        logger.debug(`Sync trans run fail, ${String((commitErr as any)?.message ?? commitErr)}`)
                                    }
                                    reject(jsResponse(STCODES.DBOPERATEERR, (commitErr as any)?.message ?? String(commitErr)))
                                } else {
                                    conn.release()
                                    if (MysqlDao.logFlag && logger && typeof logger.debug === 'function') {
                                        logger.debug(`Ending Sync trans, ${String(sqls.length)} operations have been done.`)
                                    }
                                    resolve(jsResponse(STCODES.SUCCESS, 'Sync trans run succes.', { affectedRows: sqls.length }))
                                }
                            })
                        }
                    }

                    if (isAsync) {
                        const funcArr: Array<Promise<any>> = []
                        sqls.forEach((sqlParam: { text: string; values: object | Array<any> }) => { funcArr.push(doOne(sqlParam)) })
                        Promise.all(funcArr).then((resp) => {
                            conn.commit((commitErr) => {
                                if (commitErr) {
                                    conn.rollback(() => {
                                        conn.release()
                                    })
                                    if (logger && typeof logger.error === 'function') logger.error(`Async trans run fail, ${String((commitErr as any)?.message ?? commitErr)}`)
                                    reject(jsResponse(STCODES.DBOPERATEERR, (commitErr as any)?.message ?? String(commitErr)))
                                } else {
                                    conn.release()
                                    if (MysqlDao.logFlag && logger && typeof logger.debug === 'function') {
                                        logger.debug(`Ending Async trans, ${String(funcArr.length)} operations have been done.`)
                                    }
                                    resolve(jsResponse(STCODES.SUCCESS, 'trans run succes.', { resp, affectedRows: resp.length }))
                                }
                            })
                        }).catch((asyncErr) => {
                            conn.rollback(() => {
                                conn.release()
                            })
                            reject(jsResponse(STCODES.DBOPERATEERR, (asyncErr as any)?.message ?? String(asyncErr)))
                        })
                    } else {
                        const sqlArr = lodash.cloneDeep(sqls)
                        goTrans(sqlArr)
                    }
                })
            })
        })
    }

    private async query(tablename: string, params: Record<string, unknown> | unknown[], fields: string[] = [], sql = '', values: unknown[] = []): Promise<any> {
        params = params || {}
        let where: string = ''
        const AndJoinStr = ' and '

        let { sort, search, page: _page, size: _size, sum, count, group, ...restParams } = params as Record<string, unknown>
        let page: number | undefined = _page as any
        let size: number | undefined = _size as any
        let { lks, ins, ors } = restParams as any
        let queryKeys: Record<string, unknown> = { ors, count, lks, ins, sum }
        page = page || 0
        size = size || runtime.PAGESIZE

        const keys: string[] = Object.keys(restParams)
        for (let i = 0; i < keys.length; i++) {
            const key = keys[i]
            let value: any = (params as Record<string, any>)[key]
            if (QUERYEXTRAKEYS.indexOf(key) < 0) {
                const is_val_arr = tools.arryParse(value)
                if (is_val_arr) value = is_val_arr
            }
            if (where !== '') where += AndJoinStr

            if (QUERYEXTRAKEYS.indexOf(key) >= 0) {
                let whereExtra = ''
                let err: string | null = null
                const ele = queryKeys[key] = tools.arryParse(queryKeys[key])
                if (!ele || ele.length < 2 || ((key === 'ors' || key === 'lks') && ele.length % 2 === 1)) {
                    err = `Format of ${key} is wrong.`
                } else {
                    if (key === 'ins') {
                        const c = ele.shift()
                        const cText = toSqlPrimitiveString(c)
                        if (cText === null) {
                            return Promise.reject(jsResponse(STCODES.PARAMERR, `Format of ${key} is wrong.`))
                        }
                        whereExtra += `${cText} in ( ? ) `
                        values.push(ele)
                    } else if (key === 'lks' || key === 'ors') {
                        whereExtra = ' ( '
                        for (let j = 0; j < ele.length; j += 2) {
                            if (j > 0) whereExtra += ' or '
                            const field = toSqlPrimitiveString(ele[j])
                            if (field === null) {
                                return Promise.reject(jsResponse(STCODES.PARAMERR, `Format of ${key} is wrong.`))
                            }
                            const val = ele[j + 1]
                            if (val == null) {
                                whereExtra += `${field} is null `
                            } else {
                                const valueText = toSqlPrimitiveString(val)
                                if (valueText === null) {
                                    return Promise.reject(jsResponse(STCODES.PARAMERR, `Format of ${key} is wrong.`))
                                }
                                whereExtra += `${field} ${key === 'lks' ? 'like' : '='} ? `
                                values.push(key === 'lks' ? `%${valueText}%` : valueText)
                            }
                        }
                        whereExtra += ' ) '
                    }
                }
                if (err) return Promise.reject(jsResponse(STCODES.PARAMERR, err))
                where += whereExtra
            } else {
                if (value === 'null') {
                    where += keys[i] + ' is null '
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
                        where += keys[i] + vls[0] + ' ? '
                        values.push(vls[1])
                    } else if (vls.length === 4) {
                        where += keys[i] + vls[0] + ' ? and ' + keys[i] + vls[2] + ' ? '
                        values.push(vls[1])
                        values.push(vls[3])
                    } else {
                        if (where.endsWith(AndJoinStr)) where = where.substring(0, where.length - AndJoinStr.length)
                    }
                } else if (search !== undefined) {
                    const escaped = (pool as any).escape(String(value))
                    const replaced = escaped.replace(/', '/g, `%' and ${String(key)} like '%`)
                    const v = replaced.substring(1, replaced.length - 1)
                    where += `${String(key)} like '%${String(v)}%'`
                } else {
                    where += keys[i] + ' = ? '
                    values.push(value)
                }
            }
        }

        let extra = ''
        for (let i = 0; i < QUERYSTATISKEYS.length; i++) {
            const element = QUERYSTATISKEYS[i]
            if (queryKeys[element]) {
                const ele = queryKeys[element] = tools.arryParse(queryKeys[element])
                if (!ele || ele.length === 0 || ele.length % 2 === 1) {
                    return Promise.resolve(jsResponse(STCODES.PARAMERR, `Format of ${element} is wrong.`))
                }
                for (let j = 0; j < ele.length; j += 2) {
                    const rawName = toSqlPrimitiveString(ele[j])
                    const rawAlias = toSqlPrimitiveString(ele[j + 1])
                    if (rawName === null || rawAlias === null) {
                        return Promise.resolve(jsResponse(STCODES.PARAMERR, `Format of ${element} is wrong.`))
                    }
                    extra += `,${element}(${rawName}) as ${rawAlias} `
                }
            }
        }

        if (tablename === 'QuerySqlSelect') {
            sql = sql + (where === '' ? '' : (' and ' + where))
        } else {
            sql = `SELECT ${fields.length > 0 ? fields.join() : '*'}${extra} FROM ${tablename} `
            if (where !== '') sql += ' WHERE ' + where
        }

        if (group !== undefined) {
            const groupText = toSqlPrimitiveString(group)
            if (groupText === null) return Promise.reject(jsResponse(STCODES.PARAMERR, 'Invalid group value.'))
            const valueEscaped = (pool as any).escape(groupText)
            const groupStr = ` GROUP BY ${valueEscaped.substring(1, valueEscaped.length - 1)}`
            sql += groupStr
        }

        if (sort !== undefined) {
            const sortText = toSqlPrimitiveString(sort)
            if (sortText === null) return Promise.reject(jsResponse(STCODES.PARAMERR, 'Invalid sort value.'))
            const valueEscaped = (pool as any).escape(sortText)
            const sortStr = ` ORDER BY ${valueEscaped.substring(1, valueEscaped.length - 1)}`
            sql += sortStr
        }

        if (page > 0) {
            page--
            const sqlQuery = `${sql} LIMIT ${String(page * size)},${String(size)}`
            const index = sql.toLocaleLowerCase().lastIndexOf(' from ')
            const end = sql.toLocaleLowerCase().lastIndexOf(' order by')
            const sqlCount = `SELECT count(1) as count ${sql.substring(index, end > 0 ? end : sql.length)}`
            const resp = await Promise.all([this.execQuery(sqlQuery, values), this.execQuery(sqlCount, values)])
            let ct = 0
            if (group) {
                ct = resp[1].length
            } else if (resp[1].length > 0) {
                ct = resp[1][0].count
            }
            return jsResponse(STCODES.SUCCESS, 'data query success.', {
                data: resp[0],
                pages: Math.ceil(ct / size),
                records: ct,
            })
        }

        const rs = await this.execQuery(sql, values)
        return jsResponse(STCODES.SUCCESS, 'data query success.', {
            data: rs,
            pages: (rs as any).length > 0 ? 1 : 0,
            records: (rs as any).length,
        })
    }

    private execQuery(sql: string, values: any): Promise<any> {
        return new Promise((resolve, reject) => {
            pool.getConnection(function (err, connection) {
                if (err) {
                    reject(jsResponse(STCODES.DBOPERATEERR, (err as any)?.message ?? String(err)))
                    logger.error(String((err as any)?.message ?? err))
                    return
                }

                connection.query(sql, values, function (queryErr, result) {
                    connection.release()
                    const v = values ? ` _Values_ :${JSON.stringify(values)}` : ''
                    if (queryErr) {
                        reject(jsResponse(STCODES.DBOPERATEERR, (queryErr as any)?.message ?? String(queryErr)))
                        if (logger && typeof logger.error === 'function') logger.error(`${String((queryErr as any)?.message ?? queryErr)} _Sql_ : ${sql}${v}`)
                    } else {
                        resolve(result)
                        if (MysqlDao.logFlag && logger && typeof logger.debug === 'function') {
                            logger.debug(` _Sql_ : ${sql}${v}`)
                        }
                    }
                })
            })
        })
    }
}
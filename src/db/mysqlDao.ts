import IDao from './idao'
import { createPool, PoolOptions } from 'mysql2'
import TransElement from '../common/transElement'

const OPMETHODS = {
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
    'host': G.CONFIGS.dbconfig.db_host,
    'port': G.CONFIGS.dbconfig.db_port,
    'database': G.CONFIGS.dbconfig.db_name,
    'user': G.CONFIGS.dbconfig.db_user,
    'password': G.CONFIGS.dbconfig.db_pass,
    'charset': G.CONFIGS.dbconfig.db_char,
    'connectionLimit': G.CONFIGS.dbconfig.db_conn,
    'connectTimeout' : 30000,
    'supportBigNumbers': true,
    'bigNumberStrings': true
}

let pool = createPool(options)

export default class MysqlDao implements IDao {
    static logFlag = G.CONFIGS.DbLogClose ? false : true

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
    insertBatch(tablename: string, elements: Array<Record<string, unknown>>): Promise<unknown> {
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
    private execTrans (sqls: Array<any>, isAsync: boolean): Promise<any> {
        return new Promise((resolve, reject) => {
            pool.getConnection((err, conn) => {
                if (err) {
                    reject(G.jsResponse(G.STCODES.DBCONNECTERR, (err as any)?.message ?? String(err)))
                    G.logger.error(String((err as any)?.message ?? err))
                } else {
                    if (MysqlDao.logFlag && G.logger && typeof G.logger.debug === 'function') {
                        G.logger.debug(`Beginning ${isAsync ? 'Async' : 'Sync'} trans, ${String(sqls.length)} operations are going to do.`)
                    }
                    conn.beginTransaction((err) => {
                        if (err) {
                            reject(G.jsResponse(G.STCODES.DBOPERATEERR, (err as any)?.message ?? String(err)))
                        } else {
                            if (isAsync) {                  //异步执行
                                  const funcArr: Array<Promise<any>> = []
                                sqls.forEach((sqlParam: { text: string; values: object | Array<any> }) => { funcArr.push(doOne(sqlParam)) })
                                    Promise.all(funcArr).then((resp) => {
                                        conn.commit((err) => {
                                            if (err) {
                                                conn.rollback(() => {
                                                    conn.release()
                                                })
                                                if (G.logger && typeof G.logger.error === 'function') G.logger.error(`Async trans run fail, ${String((err as any)?.message ?? err)}`)
                                                reject(G.jsResponse(G.STCODES.DBOPERATEERR, (err as any)?.message ?? String(err)))
                                            } else {
                                                conn.release()
                                                if (MysqlDao.logFlag && G.logger && typeof G.logger.debug === 'function') {
                                                    G.logger.debug(`Ending Async trans, ${String(funcArr.length)} operations have been done.`)
                                                }
                                                resolve(G.jsResponse(G.STCODES.SUCCESS, 'trans run succes.', { resp, affectedRows: resp.length }))
                                            }
                                        })
                                    }).catch((err) => {
                                        conn.rollback(() => {
                                            conn.release()
                                        })
                                        reject(G.jsResponse(G.STCODES.DBOPERATEERR, (err)?.message ?? String(err)))
                                    })
                            } else {                        //同步执行
                                let sqlArr = G.L.cloneDeep(sqls)
                                goTrans(sqlArr)
                            }

                            function doOne(sqlParam: { text: string; values: object | Array<any> }): Promise<any> {
                                return new Promise((resolve, reject) => {
                                    let sql = sqlParam.text
                                    let values = sqlParam.values
                                    conn.query(sql, values, (err, result) => {
                                        if (err) {
                                            conn.rollback(() => {
                                                G.logger.error(`${isAsync ? 'Async' : 'Sync'} trans run fail, _Sql_ : ${String(sqlParam.text)}, _Values_ : ${JSON.stringify(sqlParam.values)}, _Err_ : ${String((err as any)?.message ?? err)}`)
                                                return reject(G.jsResponse(G.STCODES.DBOPERATEERR, (err as any)?.message ?? String(err)))
                                            })
                                        } else {
                                            if (MysqlDao.logFlag && G.logger && typeof G.logger.debug === 'function') {
                                                G.logger.debug(`${isAsync ? 'Async' : 'Sync'} trans run success, _Sql_ : ${String(sqlParam.text)}, _Values_ : ${JSON.stringify(sqlParam.values)}`)
                                            }
                                            return resolve(G.jsResponse(G.STCODES.SUCCESS, 'trans run success', result))
                                        }
                                    })
                                })
                            }

                            function goTrans(sqlArr: Array<any>) {
                                if (sqlArr.length > 0) {
                                    doOne(sqlArr.shift()).then(() => {
                                        goTrans(sqlArr)                 //以此方式，传递上一执行结果給下一执行操作
                                    }).catch((err) => {
                                        reject(G.jsResponse(G.STCODES.DBOPERATEERR, (err)?.message ?? String(err)))
                                    })
                                } else {
                                    conn.commit((err) => {
                                        if (err) {
                                            conn.rollback(() => {
                                                conn.release()
                                            })
                                            if (MysqlDao.logFlag && G.logger && typeof G.logger.debug === 'function') {
                                                G.logger.debug(`Sync trans run fail, ${String((err as any)?.message ?? err)}`)
                                            }
                                            reject(G.jsResponse(G.STCODES.DBOPERATEERR, (err as any)?.message ?? String(err)))
                                        } else {
                                            conn.release()
                                            if (MysqlDao.logFlag && G.logger && typeof G.logger.debug === 'function') {
                                                G.logger.debug(`Ending Sync trans, ${String(sqls.length)} operations have been done.`)
                                            }
                                            resolve(G.jsResponse(G.STCODES.SUCCESS, 'Sync trans run succes.', { affectedRows: sqls.length }))
                                        }
                                    })
                                }
                            }
                        }
                    })
                }
            })
        })
    }
    private async query(tablename: string, params: Record<string, unknown> | unknown[], fields: string[] = [], sql = '', values: unknown[] = []): Promise<unknown> {
        params = params || {}
        let where: string = ''
        const AndJoinStr = ' and '
        
        let {sort, search, page: _page, size: _size, sum, count, group, ...restParams} = params as Record<string, unknown>
        let page: number | undefined = _page as any
        let size: number | undefined = _size as any
        let {lks, ins, ors} = restParams as any
        let queryKeys = {ors, count, lks, ins, sum}
        page = (page) || 0
        size = (size) || G.PAGESIZE

        let keys: string[] = Object.keys(restParams)
        for (let i = 0; i < keys.length; i++) {
            const key = keys[i]
            let value: any = (params as Record<string, any>)[key]
            if (QUERYEXTRAKEYS.indexOf(key) < 0) {
                let is_val_arr = G.tools.arryParse(value)
                if (is_val_arr)
                    value = is_val_arr
            }
            if (where !== '') {
                where += AndJoinStr
            }

            if (QUERYEXTRAKEYS.indexOf(key) >= 0) {
                let whereExtra = ''
                let err: string | null = null
                const ele = queryKeys[key] = G.tools.arryParse(queryKeys[key])
                if (!ele || ele.length < 2 || ((key === 'ors' || key === 'lks') && ele.length % 2 === 1)) {
                    err = `Format of ${key} is wrong.`
                } else {
                    if (key === 'ins') {
                        const c = ele.shift()
                        const cText = toSqlPrimitiveString(c)
                        if (cText === null) {
                            return Promise.reject(G.jsResponse(G.STCODES.PARAMERR, `Format of ${key} is wrong.`))
                        }
                        whereExtra += `${cText} in ( ? ) `
                        values.push(ele)
                    } else if (key === 'lks' || key === 'ors') {
                        whereExtra = ' ( '
                        for (let j = 0; j < ele.length; j += 2) {
                            if (j > 0) whereExtra += ' or '
                            const field = toSqlPrimitiveString(ele[j])
                            if (field === null) {
                                return Promise.reject(G.jsResponse(G.STCODES.PARAMERR, `Format of ${key} is wrong.`))
                            }
                            const val = ele[j + 1]
                            if (val == null) {
                                whereExtra += `${field} is null `
                            } else {
                                const valueText = toSqlPrimitiveString(val)
                                if (valueText === null) {
                                    return Promise.reject(G.jsResponse(G.STCODES.PARAMERR, `Format of ${key} is wrong.`))
                                }
                                whereExtra += `${field} ${key === 'lks' ? 'like' : '='} ? `
                                values.push(key === 'lks' ? `%${valueText}%` : valueText)
                            }
                        }
                        whereExtra += ' ) '
                    }
                }
                if (err) return Promise.reject(G.jsResponse(G.STCODES.PARAMERR, err))
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
                                } else
                                    return false
                            })
                        ) {
                        if (Array.isArray(value)) {
                            value = value.join()
                        }
                        const vls = (value as string).split(',')
                        if (vls.length === 2) {
                            where += keys[i] + vls[0] + ' ? '
                            values.push(vls[1])
                        } else if (vls.length === 4) {
                            where += keys[i] + vls[0] + ' ? and ' + keys[i] + vls[2] + ' ? '
                            values.push(vls[1])
                            values.push(vls[3])
                        } else {
                            if (where.endsWith(AndJoinStr))
                                where = where.substring(0, where.length - AndJoinStr.length)
                        }
                    } else if (search !== undefined) {
                        const escaped = pool.escape(String(value))
                        const replaced = escaped.replace(/', '/g, `%' and ${String(key)} like '%`)
                        const v = replaced.substring(1, replaced.length - 1)
                        where += `${String(key)} like '%${String(v)}%'`
                    } else {
                        where += keys[i] + ' = ? '
                        values.push(value)
                    }
                
            }
        }

        let extra: string = ''
        for (let i = 0; i < QUERYSTATISKEYS.length; i++) {
            let element = QUERYSTATISKEYS[i]
            if (queryKeys[element]) {
                let ele = queryKeys[element] = G.tools.arryParse(queryKeys[element])
                if (!ele || ele.length === 0 || ele.length % 2 === 1)
                    return Promise.resolve(G.jsResponse(G.STCODES.PARAMERR, `Format of ${element} is wrong.`))
                for (let i = 0; i < ele.length; i += 2) {
                    const rawName = toSqlPrimitiveString(ele[i])
                    const rawAlias = toSqlPrimitiveString(ele[i + 1])
                    if (rawName === null || rawAlias === null) {
                        return Promise.resolve(G.jsResponse(G.STCODES.PARAMERR, `Format of ${element} is wrong.`))
                    }
                    extra += `,${element}(${rawName}) as ${rawAlias} `
                }
            }
        }
        
        if (tablename === 'QuerySqlSelect')
            sql = sql + (where === '' ? '' : (' and ' + where))
        else {
            sql = `SELECT ${fields.length > 0 ? fields.join() : '*'}${extra} FROM ${tablename} `
            if (where !== '') {
                sql += ' WHERE ' + where
            }
        }

        if (group !== undefined) {
            const groupText = toSqlPrimitiveString(group)
            if (groupText === null) return Promise.reject(G.jsResponse(G.STCODES.PARAMERR, 'Invalid group value.'))
            const valueEscaped = pool.escape(groupText)
            const groupStr = ` GROUP BY ${valueEscaped.substring(1, valueEscaped.length - 1)}`
            sql += groupStr
        }
        
        if (sort !== undefined) {
            const sortText = toSqlPrimitiveString(sort)
            if (sortText === null) return Promise.reject(G.jsResponse(G.STCODES.PARAMERR, 'Invalid sort value.'))
            const valueEscaped = pool.escape(sortText)
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
            return G.jsResponse(G.STCODES.SUCCESS, 'data query success.', {
                data: resp[0],
                pages: Math.ceil(ct / size),
                records: ct,
            })
        } else {
            const rs = await this.execQuery(sql, values)
            return G.jsResponse(G.STCODES.SUCCESS, 'data query success.', {
                data: rs,
                pages: (rs).length > 0 ? 1 : 0,
                records: (rs).length,
            })
        }

    }
    private execQuery(sql: string, values: any): Promise<any> {
        return new Promise((resolve, reject) => {
            pool.getConnection(function(err, connection) {
                        if (err) {
                    reject(G.jsResponse(G.STCODES.DBOPERATEERR, (err as any)?.message ?? String(err)))
                    G.logger.error(String((err as any)?.message ?? err))
                } else {
                    connection.query(sql, values, function(err, result) {
                        connection.release()
                        const v = values ? ` _Values_ :${JSON.stringify(values)}` : ''
                        if (err) {
                            reject(G.jsResponse(G.STCODES.DBOPERATEERR, (err as any)?.message ?? String(err)))
                            if (G.logger && typeof G.logger.error === 'function') G.logger.error(`${String((err as any)?.message ?? err)} _Sql_ : ${sql}${v}`)
                        } else {
                            resolve(result)
                            if (MysqlDao.logFlag && G.logger && typeof G.logger.debug === 'function') {
                                G.logger.debug(` _Sql_ : ${sql}${v}`)
                            }
                        }
                    })
                }
            })
        })
    }
}
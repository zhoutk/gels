import IDao from './idao'
import { createPool, PoolOptions } from 'mysql2';

const OPMETHODS = {
    Insert : 'INSERT INTO ?? SET ?',
    Update : 'UPDATE ?? SET ? WHERE ?',
    Delete : 'DELETE FROM ?? WHERE ?'
}

const QUERYSTATISKEYS = ['count', 'sum']
const QUERYEXTRAKEYS = ['lks', 'ins', 'ors']
const QUERYUNEQOPERS = ['>,', '>=,', '<,', '<=,', '<>,', '=,']

var options:PoolOptions = {
    'host': global.CONFIGS.dbconfig.db_host,
    'port': global.CONFIGS.dbconfig.db_port,
    'database': global.CONFIGS.dbconfig.db_name,
    'user': global.CONFIGS.dbconfig.db_user,
    'password': global.CONFIGS.dbconfig.db_pass,
    'charset': global.CONFIGS.dbconfig.db_char,
    'connectionLimit': global.CONFIGS.dbconfig.db_conn,
    'connectTimeout' : 30000,
    'supportBigNumbers': true,
    'bigNumberStrings': true
}

var pool = createPool(options);

export default class MysqlDao implements IDao{
    select(tablename: string, params = {}, fields?: Array<string>):Promise<any>{
        fields = fields || []
        return this.query(tablename, params, fields, '', []);
    }
    insert(tablename:string, params = {}):Promise<any>{
        return this.execQuery(OPMETHODS['Insert'], [tablename, params]);
    }
    update(tablename:string, params = {}, id:string|number):Promise<any>{
        return this.execQuery(OPMETHODS['Update'], [tablename, params, {id}]);
    }
    delete(tablename:string, id:string|number):Promise<any>{
        return this.execQuery(OPMETHODS['Delete'], [tablename, {id}]);
    }
    querySql(sql: string, values:[], params:object, fields?:Array<string>):Promise<any>{
        fields = fields || []
        params = params || []
        return this.query('QuerySqlSelect', params, fields, sql, values);
    }
    execSql(sql: string, values:[]): Promise<any>{
        return this.execQuery(sql, values);
    }
    private async query(tablename:string, params, fields = [], sql = '', values = []):Promise<any>{
        params = params || {}
        let where:string = ''
        
        let {sort, search, page, size, sum, count, group, ...restParams} = params
        let {lks, ins, ors} = restParams
        let queryKeys = {ors, count, lks, ins, sum}
        page = page || 0
        size = size || global.PAGESIZE

        let keys:string[] = Object.keys(restParams)
        for(let i = 0; i < keys.length; i++){
            let key = keys[i]
            let value = params[key]
            if(where !== ''){
                where += ' and '
            }

            if (QUERYEXTRAKEYS.indexOf(key) >= 0) {
                const { err, whereExtra } = ((key) => {
                    let whereExtra = '', err = null
                    if (queryKeys[key]) {
                        let ele = queryKeys[key] = global.tools.arryParse(queryKeys[key])
                        if (!ele || ele.length < 2 || key === 'ors' && ele.length % 2 === 1)
                            err = `Format of ${key} is wrong.`
                        else {
                            if(key === 'ins'){
                                let c = ele.shift()
                                whereExtra += c + " in ( ? ) "
                                values.push(ele);
                            }else if(key === 'lks'){
                                let val = ele.shift()
                                whereExtra = ' ( '
                                for (let j = 0; j < ele.length; j++) {
                                    if(j > 0)
                                        whereExtra += ' or '
                                    whereExtra += ele[j] + " like ? "
                                    values.push(`%${val}%`)
                                }
                                whereExtra += ' ) '
                            }else if(key === 'ors'){
                                whereExtra += ' ( '
                                for (let j = 0; j < ele.length; j+=2) {
                                    if(ele[j+1] == null){
                                        whereExtra += ele[j] + " is null ";
                                    }else{
                                        whereExtra += ele[j] + " = ? "
                                        values.push(ele[j+1])
                                    }
                                    if (j < ele.length - 2) {
                                        whereExtra += ' or '
                                    }
                                }
                                whereExtra += ' ) '
                            }
                        }
                    }
                    return { err, whereExtra }
                })(key)
                if (err)
                    return Promise.reject(global.jsReponse(301, err))
                else
                    where += whereExtra
            }else{
                if(search !== undefined && value !== 'null'){
                    where += keys[i] + " like ? "
                    values.push(`%${value}%`)
                }else{
                    if(value === 'null'){
                        where += keys[i] + ' is null '
                    } else {
                        where += keys[i] + " = ? "
                        values.push(value)
                    }
                }
            }
        }

        let extra:string = ''
        for(let i = 0; i < QUERYSTATISKEYS.length; i++){
            let element = QUERYSTATISKEYS[i]
            if (queryKeys[element]) {
                let ele = queryKeys[element] = global.tools.arryParse(queryKeys[element])
                if (!ele || ele.length === 0 || ele.length % 2 === 1)
                    return Promise.resolve(global.jsReponse(301, `Format of ${element} is wrong.`))
                for (let i = 0; i < ele.length; i += 2) {
                    extra += `,${element}(${ele[i]}) as ${ele[i + 1]} `;
                }
            }
        }
        
        if (tablename === 'QuerySqlSelect')
            sql = sql + (where == '' ? '' : (' and ' + where));
        else {
            sql = `SELECT ${fields.length > 0 ? fields.join() : '*'}${extra} FROM ${tablename} `
            if (where != "") {
                sql += " WHERE " + where
            }
        }
        
        if (sort !== undefined) {
            let value = pool.escape(sort);
            sort = " ORDER BY " + value.substring(1, value.length - 1)
            sql += sort
        }

        if (page > 0) {
            page--
            let sqlQuery = sql + ' LIMIT ' + page * size + ',' + size
            let index = sql.toLocaleLowerCase().lastIndexOf(' from ')
            let end = sql.toLocaleLowerCase().lastIndexOf(' order by')
            let sqlCount = 'SELECT count(1) as count ' + sql.substring(index, end > 0 ? end : sql.length)
            const resp = await Promise.all([this.execQuery(sqlQuery, values), this.execQuery(sqlCount, values)]);
            let ct = 0;
            if (resp[1].length > 0) {
                ct = resp[1][0].count;
            }
            // if (group) {
            //     ct = resp[1].length;
            // }
            return global.jsReponse(200, 'data query success.', {
                data: resp[0],
                pages: Math.ceil(ct / size),
                records: ct,
            });
        } else {
            const rs = await this.execQuery(sql, values);
            return global.jsReponse(200, 'data query success.', {
                data: rs,
                pages: rs.length > 0 ? 1 : 0,
                records: rs.length,
            });
        }

    }
    private execQuery(sql:string, values:any):Promise<any>{
        return new Promise(function(fulfill, reject) {

            pool.getConnection(function(err, connection) {
                if (err) {
                    reject(global.jsReponse(204, err.message))
                    global.logger.error(err.message)
                } else {
                    connection.query(sql, values, function(err, result) {
                        connection.release();
                        let v = values ? ' _Values_ :' + JSON.stringify(values) : ''
                        if (err) {
                            reject(global.jsReponse(204, err.message));
                            global.logger.error(err.message + ' Sql is : ' + sql + v)
                        } else {
                            fulfill(result)
                            global.logger.debug( ' _Sql_ : ' + sql + v)
                        }
                    });
                }
            });
    
        });
    }
}
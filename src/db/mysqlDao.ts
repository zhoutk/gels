import IDao from './idao'
import { createPool, PoolOptions } from 'mysql2';

const OPMETHODS = {
    Insert : 'INSERT INTO ?? SET ?',
    Update : 'UPDATE ?? SET ? WHERE ?',
    Delete : 'DELETE FROM ?? WHERE ?'
}

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
    private query(tablename:string, params, fields = [], sql = '', values = []):Promise<any>{
        params = params || {}
        let where:string = ''
        
        let {sort, search, page, size, ors, count, lks, ins, sum, group, ...restParams} = params
        page = page || 0
        size = size || global.PAGESIZE

        let keys:string[] = Object.keys(restParams)
        for(let i = 0; i < keys.length; i++){
            let value = params[keys[i]]
            if(where !== ''){
                where += ' and '
            }

            if(search !== undefined){
                where += keys[i] + " like ? "
                values.push(`%${value}%`)
            }else{
                where += keys[i] + " = ? "
                values.push(value)
            }
        }

        let extra:string = ''
        if(count !== undefined){
            count = global.tools.arryParse(count)
            if (!count || count.length === 0 || count.length % 2 === 1)
                return Promise.resolve(global.jsReponse(301, 'Format of count is wrong.'))
            for (let i = 0; i < count.length; i += 2) {
                extra += `,count(${count[i]}) as ${count[i + 1]} `;
            }
        }

        if(sum !== undefined){
            sum = global.tools.arryParse(sum)
            if (!sum || sum.length === 0 || sum.length % 2 === 1)
                return Promise.resolve(global.jsReponse(301, 'Format of sum is wrong.'))
            for (let i = 0; i < sum.length; i += 2) {
                extra += `,sum(${sum[i]}) as ${sum[i + 1]} `;
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
            return Promise.all([this.execQuery(sqlQuery, values), this.execQuery(sqlCount, values)]).then((resp) => {
                let ct = 0;
                if (resp[1].length > 0) {
                    ct = resp[1][0].count;
                }
                // if (group) {
                //     ct = resp[1].length;
                // }
                return global.jsReponse(200, 'data query success.', 
                    {
                        data: resp[0], 
                        pages: Math.ceil(ct / size),
                        records: ct,
                    }
                )
            })
        } else {
            return this.execQuery(sql, values).then((rs)=>{
                return global.jsReponse(200, 'data query success.', 
                    {
                        data: rs, 
                        pages: rs.length > 0 ? 1 : 0, 
                        records: rs.length,
                    }
                )
            })
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
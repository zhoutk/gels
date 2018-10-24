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
    select(tablename: string, params = {}, fields?: Array<string>): Promise<any>{
        fields = fields || []
        return this.query(tablename, params, fields, '', []);
    }
    insert(tablename:string, values:[]):Promise<any>{
        return this.execQuery(OPMETHODS['Insert'], [tablename, values]);
    }
    update(tablename:string, values:[], id:string|number):Promise<any>{
        return this.execQuery(OPMETHODS['Update'], [tablename, values, {id}]);
    }
    delete(tablename:string, id:string|number):Promise<any>{
        return this.execQuery(OPMETHODS['Delete'], [tablename, {id}]);
    }
    querySql(sql: string, values:[], params:object, fields?:Array<string>): Promise<any>{
        fields = fields || []
        params = params || []
        return this.query('QuerySqlSelect', params, fields, sql, values);
    }
    execSql(sql: string, values:[]): Promise<any>{
        return this.execQuery(sql, values);
    }
    private query(tablename:string, params, fields = [], sql = '', values = []): Promise<any>{
        params = params || {}
        let where:string = ''
        
        let {sort, ...restParams} = params

        let keys:string[] = Object.keys(restParams)
        for(let i = 0; i < keys.length; i++){
            let value = params[keys[i]]
            if(where !== ''){
                where += ' and '
            }

            where += keys[i] + " = ? ";
            values.push(value)
        }
        
        if (tablename === 'QuerySqlSelect')
            sql = sql + (where == '' ? '' : (' and ' + where));
        else {
            sql = `SELECT ${fields.length > 0 ? fields.join() : '*'} FROM ${tablename} `;
            if (where != "") {
                sql += " WHERE " + where;
            }
        }
        
        if (sort !== undefined) {
            let value = pool.escape(sort);
            sort = " ORDER BY " + value.substring(1, value.length - 1);
            sql += sort;
        }

        return this.execQuery(sql, values)
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
                            global.logger.error(err.message + ' Sql is : ' + sql + v);
                        } else {
                            fulfill(result)
                            global.logger.debug( ' _Sql_ : ' + sql + v);
                        }
                    });
                }
            });
    
        });
    }
}
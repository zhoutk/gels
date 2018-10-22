import IDao from './idao'
import { createPool, createConnection } from 'mysql2';

var options = {
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
    select(tablename: string, params: object, fields?: Array<string>): Promise<any>{
        return this.execQuery(`select * from ${tablename} where username = ? `, [params['username']]);
    }
    execQuery(sql:string, values:any):Promise<any>{
        return new Promise(function(fulfill, reject) {

            pool.getConnection(function(err, connection) {
                if (err) {
                    reject({code:204,err:err.message})
                    global.logger.error(err.message)
                } else {
                    connection.query(sql, values, function(err, result) {
                        connection.release();
                        let v = values ? ' _Values_ :' + JSON.stringify(values) : ''
                        if (err) {
                            reject({code:204,err:err.message});
                            global.logger.error(err.message + ' Sql is : ' + sql + v);
                        } else {
                            fulfill(sql.toLocaleUpperCase().startsWith('SELECT') ? result : Object.assign({code:200},result));
                            global.logger.debug( ' _Sql_ : ' + sql + v);
                        }
                    });
                }
            });
    
        });
    }
}
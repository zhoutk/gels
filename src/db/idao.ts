import TransElement from '../common/transElement'

export default interface IDao {
    select(tablename: string, params: object, fields?: Array<string>): Promise<any>;
    insert(tablename: string, params: object): Promise<any>;
    update(tablename: string, params: object, id: string|number): Promise<any>;
    delete(tablename: string, id: string|number): Promise<any>;
    querySql(sql: string, values: Array<any>, params: object, fields?: Array<string>): Promise<any>;
    execSql(sql: string, values: Array<any>): Promise<any>;
    insertBatch(tablename: string, elements: Array<any>): Promise<any>;
    transGo(elements: Array<TransElement>, isAsync?: boolean): Promise<any>;
}
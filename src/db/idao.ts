export default interface IDao {
    select(tablename:string, params:object, fields?:Array<string>):Promise<any>;
    insert(tablename:string, values:[]):Promise<any>;
    update(tablename:string, values:[], id:string|number):Promise<any>;
    delete(tablename:string, id:string|number):Promise<any>;
    querySql(sql: string, values:[], params:object, fields?:Array<string>): Promise<any>;
    execSql(sql: string, values:[]): Promise<any>;
}
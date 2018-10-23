export default interface IDao {
    select(tablename:string, params:object, fields?:Array<string>):Promise<any>;
    insert(tablename:string, values:[]):Promise<any>;
    update(tablename:string, values:[], id:string|number):Promise<any>;
    delete(tablename:string, values:[], id:string|number):Promise<any>;
    // execQuery(sql: string, values: any): Promise<any>;
}
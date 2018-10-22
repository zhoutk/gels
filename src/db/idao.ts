export default interface IDao {
    select(tablename: string, params: object, fields?: Array<string>): Promise<any>;
    // execQuery(sql: string, values: any): Promise<any>;
}
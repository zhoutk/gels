import TransElement from '../common/transElement'

export default interface IDao {
    select(tablename: string, params: Record<string, unknown>, fields?: string[]): Promise<any>;
    insert(tablename: string, params: Record<string, unknown>): Promise<any>;
    update(tablename: string, params: Record<string, unknown>, id: string|number): Promise<any>;
    delete(tablename: string, id: string|number): Promise<any>;
    querySql(sql: string, values: unknown[], params: Record<string, unknown>, fields?: string[]): Promise<any>;
    execSql(sql: string, values: unknown[]): Promise<any>;
    insertBatch(tablename: string, elements: Array<Record<string, unknown>>): Promise<any>;
    transGo(elements: Array<TransElement>, isAsync?: boolean): Promise<any>;
    close?(): Promise<void>;
}
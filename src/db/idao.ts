import TransElement from '../common/transElement'

export default interface IDao {
    select(tablename: string, params: Record<string, unknown>, fields?: string[]): Promise<unknown>;
    insert(tablename: string, params: Record<string, unknown>): Promise<unknown>;
    update(tablename: string, params: Record<string, unknown>, id: string|number): Promise<unknown>;
    delete(tablename: string, id: string|number): Promise<unknown>;
    querySql(sql: string, values: unknown[], params: Record<string, unknown>, fields?: string[]): Promise<unknown>;
    execSql(sql: string, values: unknown[]): Promise<unknown>;
    insertBatch(tablename: string, elements: Array<Record<string, unknown>>): Promise<unknown>;
    transGo(elements: Array<TransElement>, isAsync?: boolean): Promise<unknown>;
}
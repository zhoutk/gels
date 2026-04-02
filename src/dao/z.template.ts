import BaseDao from '../db/baseDao'

export default class Users extends BaseDao {
    constructor(table: string) {
        super(table)
    }
    async retrieve(_params: Record<string, unknown> = {}, _fields: string[] = [], _session: { userid?: string } = { userid: '' }): Promise<unknown> {
        void _params
        void _fields
        void _session
        const res = await new BaseDao('users').retrieve({ id: 1 })
        return res as unknown
    }
}
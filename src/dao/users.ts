import BaseDao from '../db/baseDao'

export default class Users extends BaseDao {
    constructor(table: string) {
        super(table)
    }
    async retrieve(params = {}, fields = [], session = { userid: '' }): Promise<any> {
        return await new BaseDao('users').retrieve({id: 1})
    }
}
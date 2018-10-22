let dialect:string = global.CONFIGS.db_dialect
import MysqlDao from './mysqlDao'
// let Dao = require(`./${dialect}Dao`);

export default class BaseDao{
    table: string
    dao: MysqlDao
    constructor(table?: string){
        this.table = table || '';
        this.dao = new MysqlDao()
    }
    async retrieve(params = {}, fields =[], session = {userid: ''}){
        try {
            let rs = await this.dao.select(this.table, params, fields);
            return rs;
        } catch (err) {
            return Promise.reject(global.jsReponse(204, err.message));
        }
    }
}
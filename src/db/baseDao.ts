let dialect:string = global.CONFIGS.db_dialect
// import Dao from './mysqlDao'
let Dao = require(`./${dialect}Dao`).default;

type DaoType = typeof Dao

export default class BaseDao{
    table: string
    static dao: DaoType
    constructor(table?: string){
        this.table = table || '';
        if(!BaseDao.dao)
            BaseDao.dao = new Dao()
    }
    async retrieve(params = {}, fields = [], session = {userid: ''}){
        try {
            let rs = await BaseDao.dao.select(this.table, params, fields);
            return rs;
        } catch (err) {
            return Promise.reject(global.jsReponse(204, err.message));
        }
    }
    async create(params = {}, fields =[], session = {userid: ''}){
        return {params, fields}
    }
}
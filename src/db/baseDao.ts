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
            if(rs.length === 0)
                return global.jsReponse( 602, 'data query empty.', rs)
            else
                return global.jsReponse( 200, 'data query success.', rs)
        } catch (err) {
            return Promise.reject(err);
        }
    }
    async create(params = {}, fields =[], session = {userid: ''}){
        let keys = Object.keys(params)
        if(keys.length === 0)
            return global.jsReponse(301, 'params is error.')
        else{
            let rs = await BaseDao.dao.insert(this.table, params)
            return global.jsReponse(200, 'data insert success.', {createRows: rs.affectedRows, lastId: rs.insertId})
        }
    }
}
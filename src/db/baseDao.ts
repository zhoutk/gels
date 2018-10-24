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
    async retrieve(params = {}, fields = [], session = {userid: ''}):Promise<any>{
        let rs = await BaseDao.dao.select(this.table, params, fields);
        if(!rs.data || rs.data.length === 0)
            return global.jsReponse( 602, 'data query empty.', rs)
        else
            return rs
    }
    async create(params = {}, fields =[], session = {userid: ''}):Promise<any>{
        let keys = Object.keys(params)
        if(keys.length === 0 || params['id'] !== undefined && keys.length <= 1)
            return global.jsReponse(301, 'params is error.')
        else{
            let rs = await BaseDao.dao.insert(this.table, params)
            return global.jsReponse(200, 'data insert success.', {affectedRows: rs.affectedRows, id: rs.insertId})
        }
    }
    async update(params, fields =[], session = {userid: ''}):Promise<any>{
        params = params || {}
        let keys = Object.keys(params)
        if(params['id'] === undefined || keys.length <= 1)
            return global.jsReponse(301, 'params is error.')
        else{
            const { id, ...restParams } = params
            let rs = await BaseDao.dao.update(this.table, restParams, id)
            return global.jsReponse(200, 'data update success.', {affectedRows: rs.affectedRows, id})
        }
    }
    async delete(params = {}, fields =[], session = {userid: ''}):Promise<any>{
        if(params['id'] === undefined)
            return global.jsReponse(301, 'params is error.')
        else{
            let id = params['id']
            let rs = await BaseDao.dao.delete(this.table, id)
            return global.jsReponse(200, 'data delete success.', {affectedRows: rs.affectedRows, id})
        }
    }
    async querySql(sql: string, values = [], params = {}, fields = []):Promise<any>{
        let rs = await BaseDao.dao.querySql (sql, values, params, fields);
        if(rs.length === 0)
            return global.jsReponse( 602, 'data query empty.', rs)
        else
            return global.jsReponse( 200, 'data query success.', rs)
    }
    async execSql(sql: string, values = []):Promise<any>{
        let rs = await BaseDao.dao.execSql(sql, values)
        let {affectedRows} = rs
        return global.jsReponse(200, 'data exec success.', {affectedRows})
    }
}
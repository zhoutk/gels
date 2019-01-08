import IDao from './idao'
import { MongoClient, ObjectId } from 'mongodb'

const url = `mongodb://${G.CONFIGS.dbconfig.db_user}:${G.CONFIGS.dbconfig.db_pass}@${G.CONFIGS.dbconfig.db_host}:${G.CONFIGS.dbconfig.db_port}`
const dbName = G.CONFIGS.dbconfig.db_name

export default class MongoDao implements IDao {
    select(tablename: string, params: any, fields?: string[]): Promise<any> {
        let { id, sort, search, page, size, ...ps } = params
        if (id !== undefined)
            Object.assign(ps, {_id: new ObjectId(id)}) 
        if (sort !== undefined) {
            let tmp = sort.split(',')
            sort = {}
            for (let i = 0; i < tmp.length; i++) {
                let ss = tmp[i].split(' ')
                sort[ss[0]] = ss.length > 1 ? ( ss[1].toLowerCase() === 'desc' ? -1 : 1 ) : 1
            }
        }
        
        return new Promise((resolve, reject) => {
            MongoClient.connect(url, { useNewUrlParser: true }, (err, client) => { 
                if (err)
                    reject(G.jsResponse(G.STCODES.DATABASECOERR, err.message))
                else {
                    const db = client.db(dbName)
                    const collection = db.collection(tablename)
                    collection.find(ps).sort(sort).toArray(function (err, docs) {
                        if (err)
                            reject(G.jsResponse(G.STCODES.DATABASEOPERR, err.message))
                        else
                            resolve(G.jsResponse(G.STCODES.SUCCESS, 'query success.', docs))
                    })
                    client.close()
                }
            })
        })
    }    
    insert(tablename: string, params: object): Promise<any> {
        params = params || {}
        return this.execOperate('insert', tablename, params)
    }
    update(tablename: string, params: object, id: string): Promise<any> {
        params = params || {}
        return this.execOperate('update', tablename, params, id)
    }
    delete(tablename: string, id: string): Promise<any> {
        let params = {}
        return this.execOperate('delete', tablename, params, id)
    }
    private execOperate(method: string, tablename: string, params?: any, id?: string): Promise<any> {
        params = params || {}
        return new Promise((resolve, reject) => {
            MongoClient.connect(url, { useNewUrlParser: true }, (err, client) => {
                if (err) {
                    reject(G.jsResponse(G.STCODES.DATABASECOERR, err.message))
                    G.logger.error(err.message)
                } else {
                    const db = client.db(dbName)
                    let ps1 = {}, ps2 = {}
                    if (method === 'insert') {
                        Object.assign(ps1, params)
                    } else {
                        Object.assign(ps1, {_id: new ObjectId(id)})
                        if (method === 'update')
                            Object.assign(ps2, {$set: params})
                    }
                    db.collection(tablename)[`${method}One`](ps1, ps2, function (err, r) {
                        if (err) {
                            reject(G.jsResponse(G.STCODES.DATABASEOPERR, err.message))
                            G.logger.error(err.message)
                        } else {
                            resolve(G.jsResponse(G.STCODES.SUCCESS, 'create success.', {
                                affectedRows: r.result.n,
                                insertId: r.insertedId || ps1['_id']
                            }))
                            G.logger.debug(`delete object, it's id: ${id} success.`)
                            client.close()
                        }
                    })
                }
            })
        })
    }
    querySql(sql: string, values: any[], params: object, fields?: string[]): Promise<any> {
        throw new Error('Method not implemented.')
    }
    execSql(sql: string, values: any[]): Promise<any> {
        throw new Error('Method not implemented.')
    }
    insertBatch(tablename: string, elements: any[]): Promise<any> {
        throw new Error('Method not implemented.')
    }
    transGo(elements: any, isAsync?: boolean): Promise<any> {
        throw new Error('Method not implemented.')
    }

}
import IDao from './idao'
import { MongoClient, ObjectId } from 'mongodb'

const url = `mongodb://${G.CONFIGS.dbconfig.db_user}:${G.CONFIGS.dbconfig.db_pass}@${G.CONFIGS.dbconfig.db_host}:${G.CONFIGS.dbconfig.db_port}`
const dbName = G.CONFIGS.dbconfig.db_name

export default class MongoDao implements IDao {
    select(tablename: string, params: any, fields?: string[]): Promise<any> {
        let { id, ...ps } = params
        if (id !== undefined)
            Object.assign(ps, {_id: new ObjectId(id)}) 
        return new Promise((resolve, reject) => {
            MongoClient.connect(url, { useNewUrlParser: true }, (err, client) => { 
                const db = client.db(dbName)
                const collection = db.collection(tablename)
                collection.find(ps).toArray(function (err, docs) {
                    resolve(G.jsResponse(G.STCODES.SUCCESS, 'query success.', docs))
                })
                client.close()
            })
        })
    }    
    insert(tablename: string, params: object): Promise<any> {
        return new Promise((resolve, reject) => {
            MongoClient.connect(url, { useNewUrlParser: true }, (err, client) => {
                if (err) {
                    reject(G.jsResponse(G.STCODES.DATABASECOERR, err.message))
                    G.logger.error(err.message)
                } else {
                    const db = client.db(dbName)
                    db.collection(tablename).insertMany([].concat(params), function (err, r) {
                        if (err) {
                            reject(G.jsResponse(G.STCODES.DATABASEOPERR, err.message))
                            G.logger.error(err.message)
                        } else {
                            let ids = []
                            Object.values(r.insertedIds).forEach((a) => ids.push(a.toString()))
                            resolve(G.jsResponse(G.STCODES.SUCCESS, 'create success.', {
                                affectedRows: r.result.n, 
                                insertId: ids.join()
                            }))
                            G.logger.debug(`insert object ${JSON.stringify(params)} success.`)
                            client.close()
                        }
                    })
                }
            })
        })
    }
    update(tablename: string, params: object, id: string | number): Promise<any> {
        return new Promise((resolve, reject) => {
            MongoClient.connect(url, { useNewUrlParser: true }, (err, client) => {
                if (err) {
                    reject(G.jsResponse(G.STCODES.DATABASECOERR, err.message))
                    G.logger.error(err.message)
                } else {
                    const db = client.db(dbName)
                    db.collection(tablename).updateOne({_id: new ObjectId(id)}, {$set: params}, function (err, r) {
                        if (err) {
                            reject(G.jsResponse(G.STCODES.DATABASEOPERR, err.message))
                            G.logger.error(err.message)
                        } else {
                            resolve(G.jsResponse(G.STCODES.SUCCESS, 'create success.', {
                                affectedRows: r.result.n
                            }))
                            G.logger.debug(`update object ${JSON.stringify(params)} success.`)
                            client.close()
                        }
                    })
                }
            })
        })
    }
    delete(tablename: string, id: string | number): Promise<any> {
        return new Promise((resolve, reject) => {
            MongoClient.connect(url, { useNewUrlParser: true }, (err, client) => {
                if (err) {
                    reject(G.jsResponse(G.STCODES.DATABASECOERR, err.message))
                    G.logger.error(err.message)
                } else {
                    const db = client.db(dbName)
                    db.collection(tablename).deleteOne({_id: new ObjectId(id)}, function (err, r) {
                        if (err) {
                            reject(G.jsResponse(G.STCODES.DATABASEOPERR, err.message))
                            G.logger.error(err.message)
                        } else {
                            resolve(G.jsResponse(G.STCODES.SUCCESS, 'create success.', {
                                affectedRows: r.result.n
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
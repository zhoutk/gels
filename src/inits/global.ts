import * as lodash from 'lodash'
import * as Bluebird from 'bluebird'
import tasks from './tasks'
import GlobUtils from '../common/globUtils'
import CONFIGS from '../config/configs'
import STCODES from './enums'

export default {
    async init() {
        const env = process.env.NODE_ENV || 'dev'            //dev - 开发; prod - 生产； test - 测试;
        let gVar = {
            PAGESIZE: 10,
            STCODES,
            ROOT_PATH: `${process.cwd()}${env === 'prod' ? '' : '/dist'}`,
            NODE_ENV: env,    
            L: lodash,
            jsResponse(status: Number, message = '', data?: any) {
                if (Array.isArray(data))
                    return { status, message, data }
                else 
                    return Object.assign({}, data, { status, message })
            },
            tools: new GlobUtils(),
            CONFIGS,
            koaError(ctx: any, status: number, message: string, data = []) {
                ctx.ErrCode = status
                return new KoaErr({ message, status })
            }
        }
        Object.assign(gVar, await tasks.run())
        Object.assign(global, {G: gVar}, {Promise: Bluebird})

    }
}

class KoaErr extends Error {
    public status: Number
    constructor({ message = 'Error', status = G.STCODES.EXCEPTION } = {}, ...args) {
        super()
        this.message = message
        this.status = status
        if (args.length > 0) {
            Object.assign(this, args[0])
        }
    }
}
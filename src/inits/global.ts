import * as lodash from 'lodash'
import * as Bluebird from 'bluebird'
import tasks from './tasks'
import GlobUtils from '../common/globUtils'
import CONFIGS from '../config/configs'

export default {
    async init() {
        const env = process.env.NODE_ENV || 'dev'            //dev - 开发; prod - 生产； test - 测试;
        Object.assign(global, {
            PAGESIZE: 10,
            ROOT_PATH: `${process.cwd()}${env === 'prod' ? '' : '/dist'}`,
            NODE_ENV: env,    
            Promise: Bluebird,
            __: lodash,
            jsReponse(status: Number, message = '', data?: any) {
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
        })
        Object.assign(global,
            await tasks.run()
        )
    }
}

class KoaErr extends Error {
    public status: Number
    constructor({ message = 'Error', status = 500 } = {}, ...args) {
        super()
        this.message = message
        this.status = status
        if (args.length > 0) {
            Object.assign(this, args[0])
        }
    }
}
import * as lodash from 'lodash'
import * as Bluebird from 'bluebird'
import GlobUtils from '../common/globUtils'
import CONFIGS from '../config/configs'
import STCODES from './enums'
import { configure, getLogger} from 'log4js'
import logCfg from '../config/log4js'

const env = process.env.NODE_ENV || 'dev'            //dev - 开发; prod - 生产； test - 测试;
let GlobVar = {
    PAGESIZE: 10,
    STCODES,
    ROOT_PATH: `${process.cwd()}${env === 'prod' ? '' : '/dist'}`,
    NODE_ENV: env,
    L: lodash,
    logger: (() => {
        configure(logCfg)
        return getLogger('default')
    })(),
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

async function globInit() {
    Object.assign(global, { G: GlobVar }, { Promise: Bluebird })
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

export { globInit, GlobVar }
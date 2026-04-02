import * as lodash from 'lodash'
import { mkdirSync } from 'fs'
import GlobUtils from '../common/globUtils'
import CONFIGS from '../config/configs'
import {STCODES} from './enums'
import {STMESSAGES} from './enums'
import { configure, getLogger} from 'log4js'
import logCfg from '../config/log4js'

const env = process.env.NODE_ENV || 'dev'            //dev - 开发; prod - 生产； test - 测试;
export const config = CONFIGS
export const rootPath = `${process.cwd()}${env === 'dev' ? '' : '/dist'}`
export const logger = (() => {
    configure(logCfg)
    return getLogger('default')
})()
export const tools = new GlobUtils()

export function jsResponse(status: number, message = '', data?: any) {
    const statusKey = String(status) as keyof typeof STMESSAGES
    if (Array.isArray(data))
        return { status, message: message === '' ? (STMESSAGES[statusKey] || '') : message, data }
    return Object.assign({}, data, { status, message: message === '' ? (STMESSAGES[statusKey] || '') : message })
}

let GlobVar = {
    DataTables: Object.create(null),
    PAGESIZE: 10,
    STCODES,
    ROOT_PATH: rootPath,
    NODE_ENV: env,
    L: lodash,
    logger,
    jsResponse,
    tools,
    CONFIGS: config,
    koaError(ctx: any, status: number, message: string, data: unknown[] = []) {
        void data
        ctx.ErrCode = status
        return new KoaErr({ message, status })
    }
}

export const runtime = GlobVar

function globInit() {
    mkdirSync('logs', { recursive: true })
    Object.assign(global, { G: GlobVar })
}

class KoaErr extends Error {
    public status: number
    constructor({ message = 'Error', status = STCODES.EXCEPTIONERR } = {}, ...args: unknown[]) {
        super()
        this.message = message
        this.status = status
        if (args.length > 0) {
            Object.assign(this, args[0])
        }
    }
}

export { globInit, GlobVar }
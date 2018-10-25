import { Logger } from 'log4js'
import GlobUtils from './common/globUtils'
import * as lodash from 'lodash'
import CONFIGS from './config/configs'
import STCODES from './inits/enums'

type LODASH = typeof lodash
type CFG = typeof CONFIGS
type ST = typeof STCODES

declare global {    
    namespace NodeJS {        
        interface Global {
            PAGESIZE: 10,
            STCODES: ST,
            logger: Logger,
            NODE_ENV: string,
            ROOT_PATH: string,
            tools: GlobUtils,
            __: LODASH,
            jsReponse: (status: number, message: string, data?: any) => { status: number, message: string, data: any },
            koaError: (ctx: any, status: number, message: string) => any,
            CONFIGS: CFG,
        }
    }
}
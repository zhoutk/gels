import { Logger } from 'log4js'
import GlobUtils from './common/globUtils'
import * as lodash from 'lodash'

type LODASH = typeof lodash

declare global {    
    namespace NodeJS {        
        interface Global {
            logger: Logger,
            NODE_ENV: string,
            ROOT_PATH: string,
            globUtils: GlobUtils,
            __: LODASH,
        }
    }
}
import { Logger } from 'log4js'
import GlobUtils from './common/globUtils'

declare global {    
    namespace NodeJS {        
        interface Global {
            logger: Logger,
            NODE_ENV: string,
            ROOT_PATH: string,
            globUtils: GlobUtils,
        }
    }
}
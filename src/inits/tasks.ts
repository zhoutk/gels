import { configure, getLogger } from 'log4js'
import logConfig from '../config/log4js'

export default {
    async run() {
        return {
            logger: await this.logger()
        }
    },
    async logger() {
        configure(logConfig)
        return getLogger('default')
    }
}
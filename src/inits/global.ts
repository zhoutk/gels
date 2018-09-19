import lodash from 'lodash'
import Bluebird from 'bluebird'
import globUtils from '../common/globUtils'
import tasks from './tasks'

export default {
    async init() {
        Object.assign(global, {
            ROOT_PATH: process.cwd(),
            NODE_ENV: process.env.NODE_ENV || 'dev',    //dev - 开发; prod - 生产； test - 测试;
            Promise: Bluebird,
            __: lodash,
            globUtils,
        })
        Object.assign(global,
            await tasks.run()
        )
    }
}
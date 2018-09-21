import * as lodash from 'lodash'
import * as Bluebird from 'bluebird'
import tasks from './tasks'
import GlobUtils from '../common/globUtils'

export default {
    async init() {
        Object.assign(global, {
            ROOT_PATH: process.cwd(),
            NODE_ENV: process.env.NODE_ENV || 'dev',    //dev - 开发; prod - 生产； test - 测试;
            Promise: Bluebird,
            __: lodash,
            globUtils: new GlobUtils(),
        })
        Object.assign(global,
            await tasks.run()
        )
    }
}
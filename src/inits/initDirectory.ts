import * as fs from 'fs'
import * as mkdirp from 'mkdirp'
export default {
    async init(app) {
        const initDirs = global.CONFIGS.inits.directory.dirs
        for (let dir of initDirs) {
            const exists = fs.existsSync(dir)
            if (!exists) {
                mkdirp.sync(dir)
                global.logger.debug(`make directory ${dir} `)
            }
        }
    }
}
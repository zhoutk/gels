import * as fs from 'fs'
import * as mkdirp from 'mkdirp'
export default {
    async init(app) {
        const initDirs = global.CONFIGS.inits.directory.dirs
        for (let dir of initDirs) {
            let dirPath = `${global.ROOT_PATH}/${dir}`
            const exists = fs.existsSync(dirPath)
            if (!exists) {
                mkdirp.sync(dirPath)
                global.logger.debug(`make directory ${dirPath} `)
            }
        }
    }
}
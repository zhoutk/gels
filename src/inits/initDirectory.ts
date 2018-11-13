import * as fs from 'fs'
import * as mkdirp from 'mkdirp'
export default {
    async init(app) {
        const initDirs = G.CONFIGS.inits.directory.dirs
        for (let dir of initDirs) {
            let dirPath = `${G.ROOT_PATH}/${dir}`
            const exists = fs.existsSync(dirPath)
            if (!exists) {
                mkdirp.sync(dirPath)
                G.logger.debug(`make directory ${dirPath} `)
            }
        }
    }
}
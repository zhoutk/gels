import * as fs from 'fs'
import * as mkdirp from 'mkdirp'
import { config, logger, rootPath } from './global'
export default {
    init(app: any) {
        void app
        const initDirs = config.inits.directory.dirs
        for (let dir of initDirs) {
            let dirPath = `${rootPath}/${dir}`
            const exists = fs.existsSync(dirPath)
            if (!exists) {
                mkdirp.sync(dirPath)
                logger.debug(`make directory ${dirPath} `)
            }
        }
    }
}
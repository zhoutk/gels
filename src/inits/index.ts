/* eslint-disable @typescript-eslint/no-require-imports */
//初始化在app定义好后运行，以init开的头文件都会被处理，传输参数app并要求返回一个带有init方法的对象。
let requireDir = require('require-dir')
import { config } from './global'
export default class Startup {
    async init(app: any) {
        const inits: Array<{ init(app: any): Promise<void> | void }> = []
        let dirData = requireDir(__dirname)
        const initsCfg = config.inits as Record<string, { run?: boolean }>
        for (const [name, item] of Object.entries(dirData as Record<string, any>)) {
            let initOp = name.length > 4 && name.substring(4).toLowerCase()
            if (initOp && initsCfg[initOp] && initsCfg[initOp].run && 
                    name.match(/^init/) && item && item.default && item.default.init) {
                inits.push(item.default)
            }
        }
        for (const item of inits) {
            await item.init(app)
        }
    }
}
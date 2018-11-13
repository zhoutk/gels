//初始化在app定义好后运行，以init开的头文件都会被处理，传输参数app并要求返回一个带有init方法的对象。
let requireDir = require('require-dir')
export default class Startup {
    async init(app) {
        const inits = []
        let dirData = requireDir(__dirname)
        G.L.each(dirData, (item, name) => {
            let initOp = name.length > 4 && name.substr(4).toLowerCase()
            if (initOp && G.CONFIGS.inits[initOp] && G.CONFIGS.inits[initOp].run && 
                    name.match(/^init/) && item && item.default && item.default.init) {
                inits.push(item.default)
            }
        })
        for (let item of inits) {
            await item.init(app)
        }
    }
}
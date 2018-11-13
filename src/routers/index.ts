//以router开的头文件都会被处理，并要求返回一个带有init方法的对象。
let requireDir = require('require-dir')
export default class Routers {
    async init(app) {
        const inits = []
        let dirData = requireDir(__dirname)
        G.L.each(dirData, (item, name) => {
            let initOp = name.length > 7 && name.substr(7).toLowerCase()
            if (initOp && name.match(/^router/) && item && item.default) {
                inits.push(item.default)
            }
        })
        for (let item of inits) {
            app.use(item.routes()).use(item.allowedMethods())
        }
    }
}
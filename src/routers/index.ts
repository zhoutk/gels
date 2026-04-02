// Use CommonJS require to avoid ES module interop issues with `require-dir`
const requireDir = require('require-dir')
export default (() => {
    const inits: Array<{ routes(): any; allowedMethods(): any }> = []
    let dirData = requireDir(__dirname)
    for (const [name, item] of Object.entries(dirData as Record<string, any>)) {
        let initOp = name.length > 7 && name.substring(7).toLowerCase()
        if (initOp && name.match(/^router/) && item && item.default) {
            inits.push(item.default)
        }
    }
    const middles: any[] = []
    for (const item of inits) {
        middles.push(item.routes())
        middles.push(item.allowedMethods())
    }
    return middles
})()
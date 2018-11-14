let requireDir = require('require-dir')
export default (() => {
    const inits = []
    let dirData = requireDir(__dirname)
    G.L.each(dirData, (item, name) => {
        let initOp = name.length > 7 && name.substr(7).toLowerCase()
        if (initOp && name.match(/^router/) && item && item.default) {
            inits.push(item.default)
        }
    })
    let middles = []
    for (let item of inits) {
        middles.push(item.routes())
        middles.push(item.allowedMethods())
    }
    return middles
})()
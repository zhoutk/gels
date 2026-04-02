export default () => {
    // Use require to handle CommonJS/ESM interop at runtime
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const pkg: any = require('koa-helmet')
    const fn = (pkg && pkg.default) ? pkg.default : pkg
    return fn()
}
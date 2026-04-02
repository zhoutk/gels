export default () => {
    // Use require to handle CommonJS/ESM interop at runtime
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const pkg: any = require('koa2-cors')
    const cors = (pkg && pkg.default) ? pkg.default : pkg
    const { config } = require('../inits/global')
    return cors({
        origin: (ctx: any) => {
            const requestOrigin = ctx.get('Origin') || ''
            if (!requestOrigin) return ''
            if (config.cors.allowOrigins.includes('*') || config.cors.allowOrigins.includes(requestOrigin)) {
                return requestOrigin
            }
            return ''
        },
        allowMethods: config.cors.allowMethods,
        allowHeaders: config.cors.allowHeaders,
        credentials: config.cors.credentials,
    })
}
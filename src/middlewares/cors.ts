import * as corsPkg from 'koa2-cors'
import { config } from '../inits/global'

export default () => {
    const cors = ((corsPkg as any).default ?? corsPkg) as (options: any) => any
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
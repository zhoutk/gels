import color = require('cli-color')
import { logger, tools } from '../inits/global'
/**
 * http日志
 */
export default () => {
    return async (ctx: any, next: any) => {
        if (tools.isDev()) {
            const start = Date.now()
            await next()
            const diff = Date.now() - start
            const msgs = [
                (ctx.method === 'POST' ? color.green(color.bgYellowBright(`${ctx.method}`)) : color.bgBlue(`${ctx.method}`)),
                color.cyan(`${ctx.url}`),
                (ctx.status >= 400 ? color.redBright : color.greenBright)(`[${ctx.status}]`),
                '-',
                color.yellow(`${diff}ms`),
                'params',
                color.green(`${JSON.stringify(ctx.method === 'POST' || ctx.method === 'PUT' ? ctx.request.body : ctx.request.query)}`)
            ]
            logger.debug(msgs.join(' '))
        } else {
            await next()
        }
    }

}
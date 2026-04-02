import { jsResponse, tools } from '../inits/global'
import { STCODES } from '../inits/enums'
export default () => {
    return async (ctx: any, next: any) => {
        try {
            await next()
        } catch (err) {
            const data = tools.isDev() ? { stack: (err as Error).stack } : undefined
            ctx.body = jsResponse(ctx.ErrCode || STCODES.EXCEPTIONERR, (err as Error).message, data)
        }
    }
}
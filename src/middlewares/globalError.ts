export default () => {
    return async (ctx, next) => {
        try {
            await next()
        } catch (err) {
            const data = G.tools.isDev() ? { stack: (err as Error).stack } : undefined
            ctx.body = G.jsResponse(ctx.ErrCode || G.STCODES.EXCEPTIONERR, (err as Error).message, data)
        }
    }
}
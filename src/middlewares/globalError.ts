export default () => {
    return async (ctx, next) => {
        try {
            await next()
        } catch (err) {
            ctx.body = G.jsResponse(ctx.ErrCode, err.message, { stack: err.stack })
        }
    }
}
export default () => {
    return async (ctx, next) => {
        try {
            await next()
        } catch (err) {
            ctx.body = G.jsReponse(ctx.ErrCode, err.message, { stack: err.stack })
        }
    }
}
export default () => {
    return async (ctx, next) => {
        try {
            await next()
        } catch (err) {
            ctx.body = global.jsReponse(ctx.ErrCode, err.message, { stack: err.stack })
        }
    }
}
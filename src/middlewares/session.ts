import * as jwt from 'jsonwebtoken'

const config = global.CONFIGS.jwt
const AUTHURL = ['rs']

export default () => {
    return async (ctx, next) => {
        const { header: { token } } = ctx
        let urlStrs = ctx && ctx.url && ctx.url.split('/')

        if (token) {
            try {
                const decoded = jwt.verify(token, config.secret)
                ctx.session = decoded
                await next()
            } catch (err) {
                if (ctx.method === 'GET') {
                    return await next()
                }
                if (err.name === 'TokenExpiredError') {
                    ctx.body = global.jsReponse(global.STCODES.JWTAUTHERR, 'Token Expired.')
                } else if (err.name === 'JsonWebTokenError') {
                    ctx.body = global.jsReponse(global.STCODES.JWTAUTHERR, 'Invalid Token.')
                } else {
                    ctx.body = global.jsReponse(global.STCODES.JWTAUTHERR, err.message)
                }
            }
        } else {
            if (ctx.method !== 'GET' && AUTHURL.some((url) => { return urlStrs[1] === url})) {
                ctx.body = global.jsReponse(global.STCODES.JWTAUTHERR, 'Missing Auth Token.')
            } else {
                await next()
            }
        }

        
    }
}

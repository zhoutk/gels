import * as jwt from 'jsonwebtoken'
import { config, jsResponse } from '../inits/global'
import { STCODES } from '../inits/enums'

const AUTHURL = ['rs']

export default () => {
    return async (ctx: any, next: any) => {
        const token = (ctx.header.authorization && ctx.header.authorization.replace(/^Bearer\s+/i, '')) || ctx.header.token
        let urlStrs = ctx && ctx.url && ctx.url.split('/')
        let isAuth: boolean = AUTHURL.some((url) => { return urlStrs[1] === url })
        if (token) {
            try {
                const decoded = jwt.verify(token, config.jwt.secret)
                ctx.session = decoded
                await next()
            } catch (err) {
                if (ctx.method === 'GET' || !isAuth) {
                    return await next()
                }
                if ((err as Error).name === 'TokenExpiredError') {
                    ctx.body = jsResponse(STCODES.JWTAUTHERR, 'Token Expired.')
                } else if ((err as Error).name === 'JsonWebTokenError') {
                    ctx.body = jsResponse(STCODES.JWTAUTHERR, 'Invalid Token.')
                } else {
                    ctx.body = jsResponse(STCODES.JWTAUTHERR, (err as Error).message)
                }
            }
        } else {
            if (ctx.method !== 'GET' && isAuth) {
                ctx.body = jsResponse(STCODES.JWTAUTHERR, 'Missing Auth Token.')
            } else {
                await next()
            }
        }


    }
}

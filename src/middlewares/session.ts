import * as jwt from 'jsonwebtoken'
import { config, jsResponse } from '../inits/global'
import { STCODES } from '../inits/enums'

const PUBLIC_PATHS = ['/op/login', '/op/register']

export default () => {
    return async (ctx: any, next: any) => {
        const requestPath = ctx.path || ctx.url || ''
        if (config.skipRestAuth && requestPath.startsWith('/rs/')) {
            await next()
            return
        }
        if (PUBLIC_PATHS.some((path) => requestPath.startsWith(path))) {
            await next()
            return
        }

        const token = (ctx.header.authorization && ctx.header.authorization.replace(/^Bearer\s+/i, '')) || ctx.header.token
        if (!token) {
            ctx.body = jsResponse(STCODES.JWTAUTHERR, 'Missing Auth Token.')
            return
        }

        try {
            const decoded = jwt.verify(token, config.jwt.secret)
            ctx.session = decoded
            await next()
        } catch (err) {
            if ((err as Error).name === 'TokenExpiredError') {
                ctx.body = jsResponse(STCODES.JWTAUTHERR, 'Token Expired.')
            } else if ((err as Error).name === 'JsonWebTokenError') {
                ctx.body = jsResponse(STCODES.JWTAUTHERR, 'Invalid Token.')
            } else {
                ctx.body = jsResponse(STCODES.JWTAUTHERR, (err as Error).message)
            }
        }
    }
}

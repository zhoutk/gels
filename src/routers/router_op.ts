import Router from '@koa/router'
import * as jwt from 'jsonwebtoken'
import BaseDao from '../db/baseDao'
import { config, jsResponse } from '../inits/global'
import { STCODES } from '../inits/enums'

let router = new Router()

export default (() => {
    let process = async (ctx: any) => {
        let { command } = ctx.params
        switch (command) {
            case 'login':
                let rs = await new BaseDao('users').retrieve({ username: ctx.request.body.username })
                if (rs.status === STCODES.SUCCESS) {
                    let user = rs.data[0]
                    let token = jwt.sign({
                        userid: user.id,
                        username: user.username,
                    }, config.jwt.secret, {
                            expiresIn: config.jwt.expires_max,
                        }
                    )
                    ctx.body = jsResponse(STCODES.SUCCESS, 'login success.', { token })
                } else {
                    ctx.body = jsResponse(STCODES.QUERYEMPTY, 'The user is missing.')
                }
                break
            default:
                ctx.body = jsResponse(STCODES.NOTFOUNDERR, 'command is not found.')
                break
        }
    }
    return router.post('/op/:command', process)
})() 

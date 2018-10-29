import * as Router from 'koa-router'
import * as jwt from 'jsonwebtoken'
import BaseDao from '../db/baseDao'

let router = new Router()
const config = global.CONFIGS.jwt

export default (() => {
    let process = async (ctx, next) => {
        let { command } = ctx.params
        switch (command) {
            case 'login':
                let rs = await new BaseDao('users').retrieve({ username: ctx.request.body.username })
                if (rs.status === global.STCODES.SUCCESS) {
                    let user = rs.data[0]
                    let token = jwt.sign({
                        userid: user.id,
                        username: user.username,
                    }, config.secret, {
                            expiresIn: config.expires_max,
                        }
                    )
                    ctx.body = global.jsReponse(global.STCODES.SUCCESS, 'login success.', { token })
                } else {
                    ctx.body = global.jsReponse(global.STCODES.QUERYEMPTY, 'The user is missing.')
                }
                break
            case 'batch':
                return ctx.body = await new BaseDao().insertBatch('users', ctx.request.body)
            case 'trans':
                let trs = [
                    {
                        table: 'users',
                        method: 'Insert',
                        params: {
                            username: 'zhou1',
                            password: '1',
                            age: 1
                        }
                    },
                    {
                        table: 'users',
                        method: 'Insert',
                        params: {
                            username: 'zhou2',
                            password: '2',
                            age: 2
                        }
                    },
                    {
                        table: 'users',
                        method: 'Insert',
                        params: {
                            username: 'zhou3',
                            password: '3',
                            age: 3
                        }
                    },
                    {
                        table: 'users',
                        method: 'Insert',
                        params: {
                            username: 'zhou4',
                            password: '4',
                            age: 4
                        }
                    },
                    {
                        table: 'users',
                        method: 'Insert',
                        params: {
                            username: 'zhou5',
                            password: '5',
                            age: 5
                        }
                    }
                ]
                return ctx.body = await new BaseDao().transGo(trs, true)
            default:
                ctx.body = global.jsReponse(global.STCODES.NOTFOUND, 'command is not found.')
                break
        }
    }
    return router.post('/op/:command', process)
})() 

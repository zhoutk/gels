import { globInit, config, logger } from './inits/global'
import appIniter from './app'

void (async () => {
    globInit()
    //初始化koa app
    let port = process.env.PORT || config.port
    try {
        let app = await appIniter.init()
        app.listen(port, () => {
            logger.info(`current running environment is ${process.env.NODE_ENV || 'dev'}`)
            logger.info(`✅ 启动地址 http://127.0.0.1:${port}`)
        })
    } catch (e) {
        let msg: string
        if (e && typeof (e as any).message === 'string') msg = (e as any).message
        else if (typeof e === 'string') msg = e
        else {
            try { msg = JSON.stringify(e) } catch { msg = Object.prototype.toString.call(e as any) }
        }
        if (logger && typeof logger.error === 'function') logger.error(msg)
    }
})()
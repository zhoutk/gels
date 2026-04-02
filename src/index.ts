import { globInit } from './inits/global'
import appIniter from './app'

void (async () => {
    globInit()
    //初始化koa app
    let port = process.env.PORT || G.CONFIGS.port
    try {
        let app = await appIniter.init()
        app.listen(port, () => {
            G.logger.info(`current running environment is ${G.NODE_ENV}`)
            G.logger.info(`✅ 启动地址 http://127.0.0.1:${port}`)
        })
    } catch (e) {
        let msg: string
        if (e && typeof (e as any).message === 'string') msg = (e as any).message
        else if (typeof e === 'string') msg = e
        else {
            try { msg = JSON.stringify(e) } catch { msg = Object.prototype.toString.call(e as any) }
        }
        if (G.logger && typeof G.logger.error === 'function') G.logger.error(msg)
    }
})()
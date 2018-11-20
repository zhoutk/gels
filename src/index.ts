import { globInit } from './inits/global'
import appIniter from './app'

(async () => {
    await globInit()
    //初始化koa app
    let port = process.env.PORT || G.CONFIGS.port
    try {
        let app = await appIniter.init()
        app.listen(port, () => {
            G.logger.info(`current running environment is ${G.NODE_ENV}`)
            G.logger.info(`✅ 启动地址 http://127.0.0.1:${port}`)
        })
    } catch (e) {
        G.logger.error(e)
    }
      
    
})()
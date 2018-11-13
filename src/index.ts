import globInit from './inits/global'
import appIniter from './app'

(async () => {
    await globInit.init()
    //初始化koa app
    let app, port = process.env.PORT || G.CONFIGS.port
    try {
        app = await appIniter.init()
    } catch (e) {
        G.logger.error(e)
    }
      
    app.listen(port, () => {
        G.logger.info(`current running environment is ${G.NODE_ENV}`)
        G.logger.info(`✅ 启动地址 http://127.0.0.1:${port}`)
    })
    
})()
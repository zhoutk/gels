import globInit from './inits/global'
import appIniter from './app'

(async () => {
    await globInit.init()
    //初始化koa app
    let app, port = process.env.PORT || global.CONFIGS.port
    try {
        app = await appIniter.init()
    } catch (e) {
        global.logger.error(e)
    }
    
    app.use(ctx => {
        ctx.body = 'Hello Koa2'
      })
      
    app.listen(port, () => {
        global.logger.info(`current running environment is ${global.NODE_ENV}`)
        global.logger.info(`✅ 启动地址 http://127.0.0.1:${port}`)
    })
    
})()
import globInit from './inits/global'
import appIniter from './app'

(async () => {
    await globInit.init()
    //初始化koa app
    let app
    try {
        app = await appIniter.init()
    } catch (e) {
        global.logger.error(e)
    }
    global.logger.info('program is over.')
})()
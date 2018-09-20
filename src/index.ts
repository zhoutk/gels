import globInit from './inits/global'

(async () => {
    await globInit.init()
    global.logger.debug('global is ok.')
    console.log(global.globUtils.isDev())
})()
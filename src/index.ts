import globInit from './inits/global'

(async () => {
    await globInit.init()
    global.logger.debug('global is ok.')
    Promise.all([console.log('afasfasdf')])
    console.log(global.globUtils.isDev())
})()
import globInit from './inits/global'

(async () => {
    await globInit.init()
    global.logger.debug('global is ok.')
    Promise.all([console.log('afasfasdf')])
    let a = ['1', '2']
    console.log(global.__.join(a, '-'))
    console.log(global.globUtils.isDev())
})()
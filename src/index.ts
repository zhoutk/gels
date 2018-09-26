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
    
    app.use( async ( ctx ) => {

        if ( ctx.url === '/' && ctx.method === 'GET' ) {
          // 当GET请求时候返回表单页面
          let html = `
            <h1>koa2 request post demo</h1>
            <form method="POST" action="/">
              <p>userName</p>
              <input name="userName" /><br/>
              <p>nickName</p>
              <input name="nickName" /><br/>
              <p>email</p>
              <input name="email" /><br/>
              <button type="submit">submit</button>
            </form>
          `
          ctx.body = html
        } else if ( ctx.url === '/' && ctx.method === 'POST' ) {
          // 当POST请求的时候，中间件koa-bodyparser解析POST表单里的数据，并显示出来
          let postData = ctx.request.body
          throw global.koaError(ctx, 102, 'asgsdhdfjh')
          ctx.body = postData
        } else {
          // 其他请求显示404
          ctx.body = '<h1>404！！！ o(╯□╰)o</h1>'
        }
      })
      
    app.listen(port, () => {
        global.logger.info(`current running environment is ${global.NODE_ENV}`)
        global.logger.info(`✅ 启动地址 http://127.0.0.1:${port}`)
    })
    
})()
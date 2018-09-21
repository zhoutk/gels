import * as Koa from 'koa'
import server from './inits'

//加载中间件
export default {
  async init() {
    const app = new Koa()
    //支持 X-Forwarded-Host
    app.proxy = true
    //cookie 密钥
    //在进行cookie签名时，只有设置 signed 为 true 的时候，才会使用密钥进行加密：
    //ctx.cookies.set('name', 'tobi', { signed: true });
    // app.keys = [APP_CONFIG.secret || 'secret key string']
    const middlewares = [
    //   'logger', //记录所用方式与时间
    //   'globalError', // 全局错误处理
    //   'error', // 使用自定义错误
    //   'send', //send
    //   'favicon', //favicon
    //   'conditional', //配合etag
    //   'etag', //etag 客户端缓存处理
    //   'session', //session处理
      'bodyParser', //body解析
    //   'json', // 传输JSON
    //   'views', //模板文件
    //   'rewrite', //url重写
      // 默认静态文件夹 无路径前缀
    //   ['static', APP_CONFIG.staticPath],
      // 文件上传对应的静态文件夹 前缀upload
    //   ['static', APP_CONFIG.uploadPath, APP_CONFIG.uploadStaticPrefix],
      // 本项目中的public静态文件夹 前缀@
    //   ['static', ROOT_PATH + '/public', '@'],
    //   ['cors'],
    //   ['router', { debug, logger }]
    ]
    for (let n of middlewares) {
      if (n) {
        const middleware = await this.loadMiddleware.apply(null, [].concat(n))
        if (middleware) {
          //考虑返回多个中间件
          for (let m of [].concat(middleware)) {
            m && (app.use.apply(app, [].concat(m)))
          }
        }
      }
    }
    //其他始始化处理  directory socket schedule ...
    await server.init(app)
    return app
  },
  async loadMiddleware(name, ...args) {
    const middleware = require('./middlewares/' + name).default
    return (middleware && await middleware.apply(null, args)) || async function (ctx, next) { await next() }
  }
}

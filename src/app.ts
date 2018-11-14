import * as Koa from 'koa'
import Startup from './inits'

//加载中间件
export default {
  async init() {
    const app = new Koa()
    //支持 X-Forwarded-Host
    app.proxy = true
    const middlewares = [
      'logger', //记录所用方式与时间
      'session',
      'globalError', // 全局错误处理
      'conditional', //配合etag
      'etag', //etag 客户端缓存处理
      'cors',
      'bodyParser', //body解析
      'rewrite', //url重写
      'router',
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
    await new Startup().init(app)
    return app
  },
  async loadMiddleware(name, ...args) {
    const middleware = require('./middlewares/' + name).default
    return (middleware && await middleware.apply(null, args)) || async function (ctx, next) { await next() }
  }
}

import * as Koa from 'koa'
import Startup from './inits'

//加载中间件
export default {
  async init() {
    const app = new Koa()
    //支持 X-Forwarded-Host
    app.proxy = true
    const middlewares = [
      'cors',
      'logger', //记录所用方式与时间
      'session',
      'globalError', // 全局错误处理
      'conditional', //配合etag
      'etag', //etag 客户端缓存处理
      'bodyParser', //body解析
      'rewrite', //url重写
      'static',
      //['graphql', app],
      'router',
    ]
    for (const name of middlewares) {
      if (!name) continue
      const middleware = await this.loadMiddleware(name) as Koa.Middleware | Koa.Middleware[] | undefined
      if (!middleware) continue
      const list = Array.isArray(middleware) ? middleware : [middleware]
      for (const m of list) {
        if (typeof m === 'function') {
          app.use(m)
        }
      }
    }
    //其他始始化处理  directory socket schedule ...
    await new Startup().init(app)
    return app
  },
    async loadMiddleware(name: string, ...args: unknown[]) {
    try {
      const mod: unknown = await import(`./middlewares/${name}`)
      const factory = ((mod as { default?: unknown }).default ?? mod)
      if (typeof factory === 'function') {
        const result = await (factory as (...a: unknown[]) => unknown)(...args)
        return result
      }
      return factory
    } catch (err) {
      let msg: string
      if (err && typeof (err as any).message === 'string') msg = (err as any).message
      else if (typeof err === 'string') msg = err
      else {
        try { msg = JSON.stringify(err) } catch { msg = Object.prototype.toString.call(err as any) }
      }
      if (G.logger && typeof G.logger.error === 'function') G.logger.error(`loadMiddleware ${name} fail: ${msg}`)
      // fallback to noop middleware
    }
    return async function (_ctx: unknown, next: unknown) {
      if (typeof next === 'function') await (next as () => Promise<unknown>)()
    }
  }
}

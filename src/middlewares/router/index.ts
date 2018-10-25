import Routers from '../../routers'
/**
 * 注册路由
 */
export default async (app) => {
  //根路由
  await new Routers().init(app)

  return [
    async (ctx, next) => {
      ctx.getUserName = function () {
        return ctx.cookies.get('username') || ''
      }
      if (global.tools.isDev() || !global.tools.isLogin()) {            //跳过权限验证
        return await next()
      }

      //权限验证相关
      const username = ctx.getUserName()
      if (ctx.method !== 'GET' || ctx.path.includes('.') || ['/login', '/logout'].includes(ctx.path) || username) {
        return await next()
      } else {
        ctx.originalUrl = '/login'
        ctx.url = '/login'
        await next()
      }
    },
    async (ctx, next) => {
      ctx.body = global.jsReponse(global.STCODES.NOTFOUND, 'What you request is not found.')
    }
  ]
}

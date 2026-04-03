import * as helmetPkg from 'koa-helmet'

export default () => {
    const fn = ((helmetPkg as any).default ?? helmetPkg) as () => any
    return fn()
}
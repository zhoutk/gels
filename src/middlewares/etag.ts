import * as etagPkg from 'koa-etag'
export default () => {
    const etag = ((etagPkg as any).default ?? etagPkg) as () => any
    return etag()
}
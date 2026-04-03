import * as rewritePkg from 'koa-rewrite'
export default () => {
    const rewrite = ((rewritePkg as any).default ?? rewritePkg) as (from: string, to: string) => any
    return [
        rewrite('/index.html', '/')
    ]
}
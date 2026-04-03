import * as conditionalPkg from 'koa-conditional-get'
export default () => {
    const conditional = ((conditionalPkg as any).default ?? conditionalPkg) as () => any
    return conditional()
}
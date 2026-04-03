import * as servePkg from 'koa-static'
import * as path from 'path'
import { rootPath } from '../inits/global'
export default () => {
    const serve = ((servePkg as any).default ?? servePkg) as (root: string) => any
    return serve(path.join(rootPath, 'public'))
}
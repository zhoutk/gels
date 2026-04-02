import * as serve from 'koa-static'
import * as path from 'path'
import { rootPath } from '../inits/global'
export default () => {
    return serve(path.join(rootPath, 'public'))
}
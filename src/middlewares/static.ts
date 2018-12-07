import * as serve from 'koa-static'
import * as path from 'path'
export default () => {
    return serve(path.join(G.ROOT_PATH, 'public'))
}
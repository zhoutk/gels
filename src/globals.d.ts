import { GlobVar } from './inits/global'

type GLOB = typeof GlobVar

declare global {
    var G: GLOB
}

declare module 'mkdirp'
declare module 'koa-conditional-get'
declare module 'koa2-cors'
declare module 'koa-etag'
declare module 'koa-rewrite'
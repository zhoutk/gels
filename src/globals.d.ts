import { GlobVar } from './inits/global'

type GLOB = typeof GlobVar

declare global {
    var G: GLOB
}
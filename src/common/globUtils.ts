import { randomUUID } from 'crypto'
import * as lodash from 'lodash'

export default class GlobUtils {
    getStartTillBracket(str: string) {
        return str.indexOf('(') > -1 ? str.substring(0, str.indexOf('(')) : str
    }
    bigCamelCase(str: string) {
        return str.split('_').map((al) => {
            if (al.length > 0) {
                return al.substring(0, 1).toUpperCase() + al.substring(1).toLowerCase()
            }
            return al
        }).join('')
    }
    smallCamelCase(str: string) {
        let strs = str.split('_')
        if (strs.length < 2) {
            return str
        } else {
            let tail = strs.slice(1).map((al) => {
                if (al.length > 0) {
                    return al.substring(0, 1).toUpperCase() + al.substring(1).toLowerCase()
                }
                return al
            }).join('')
            return strs[0] + tail
        }
    }
    uuid() {
        return randomUUID().split('-')[0]
    }
    isDev() {
        return process.env.NODE_ENV !== 'prod'
    }
    arryParse(arr: unknown): unknown[] | null {
        try {
            if (Array.isArray(arr) || lodash.isNull(arr)) return arr as unknown[]
            if (typeof arr === 'string') {
                if ((arr).startsWith('[')) return JSON.parse(arr)
                return (arr).split(',')
            }
            return null
        } catch {
            return null
        }
    }
}
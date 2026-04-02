import { randomUUID } from 'crypto'

export default class GlobUtils {
    getRequestedFieldsFromResolveInfo(table: string, info: unknown): string[] {
        const selections = (info && typeof info === 'object' && 'selectionSet' in (info as any) && (info as any).selectionSet?.selections) || []
        const fieldStr = Array.isArray(selections) ? selections : []
        if (fieldStr.length === 0 || !G.DataTables[table]) return []
        const fields: string[] = ['id']
        fieldStr.forEach((al: any) => {
            const fieldName = al?.name?.value as string | undefined
            const realFieldName = fieldName ? G.DataTables[table][fieldName] : undefined
            if (!fieldName || fieldName === 'id') return
            if (al.selectionSet && !realFieldName) {
                const rf = G.DataTables[table][fieldName + '_id']
                if (rf) fields.push(fieldName + '_id')
            } else {
                fields.push(fieldName)
            }
        })
        return fields
    }
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
        return G.NODE_ENV !== 'prod'
    }
    isLogin() {
        return true
    }
    arryParse(arr: unknown): unknown[] | null {
        try {
            if (Array.isArray(arr) || G.L.isNull(arr)) return arr as unknown[]
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
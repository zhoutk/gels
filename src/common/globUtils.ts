import * as uuid from 'uuid'

export default class GlobUtils {
    getRequestedFieldsFromResolveInfo(table: string, info: any) {
        let fieldStr = info && info.selectionSet && info.selectionSet.selections || []
        if (fieldStr.length === 0 || !G.DataTables[table])
            return []
        let fields = ['id']
        fieldStr.forEach((al) => {
            let fieldName = al.name.value, realFieldName = G.DataTables[table][fieldName]
            if (fieldName !== 'id') {
                if (al.selectionSet && !realFieldName) {
                    realFieldName = G.DataTables[table][fieldName + '_id']
                    if (realFieldName)
                        fields.push(fieldName + '_id')
                } else {
                    fields.push(fieldName)
                }
            }
        })
        return fields
    }
    getStartTillBracket(str: string) {
        return str.indexOf('(') > -1 ? str.substr(0, str.indexOf('(')) : str
    }
    bigCamelCase(str: string) {
        return str.split('_').map((al) => {
            if (al.length > 0) {
                return al.substr(0, 1).toUpperCase() + al.substr(1).toLowerCase()
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
                    return al.substr(0, 1).toUpperCase() + al.substr(1).toLowerCase()
                }
                return al
            }).join('')
            return strs[0] + tail
        }
    }
    uuid() {
        return uuid.v1().split('-')[0]
    }
    isDev() {
        return G.NODE_ENV !== 'prod'
    }
    isLogin() {
        return true
    }
    arryParse(arr): Array<any>|null {
        try {
            if (Array.isArray(arr) || G.L.isNull(arr))
                return arr
            else if (typeof arr === 'string') {
                if (arr.startsWith('['))
                    arr = JSON.parse(arr)
                else
                    arr = arr.split(',')
            } else 
                return null
        } catch (err) {
            arr = null
        }
        return arr
    }
}
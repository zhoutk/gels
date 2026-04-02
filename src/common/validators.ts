import { runtime, tools } from '../inits/global'

export function validatePagination(page: unknown, size: unknown): { page: number; size: number } {
    const normalizedPage = Math.max(0, Math.min(1000, Number(page) || 0))
    const normalizedSize = Math.max(1, Math.min(100, Number(size) || 10))
    return { page: normalizedPage, size: normalizedSize }
}

export function validateFields(tableName: string, fields: unknown): string[] | null {
    const fieldList = tools.arryParse(fields)
    if (!fieldList) return null
    if (!Array.isArray(fieldList)) return null

    const schema = runtime.DataTables[tableName] || runtime.DataTables[`v_${tableName}`]
    if (!schema) {
        return fieldList.every(field => typeof field === 'string') ? fieldList as string[] : null
    }

    const allowedFields = new Set(Object.keys(schema))
    return fieldList.every(field => typeof field === 'string' && allowedFields.has(field)) ? fieldList as string[] : null
}
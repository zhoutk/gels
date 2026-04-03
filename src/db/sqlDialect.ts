import { config } from '../inits/global'

export const SQLITE_DIALECT = 'sqlite3'
export const JSON_FILE_DIALECT = 'json-file'

export function isSqliteDialect(): boolean {
    const dialect = (config as { db_dialect?: string }).db_dialect
    if (!dialect) return false
    return String(dialect).startsWith(SQLITE_DIALECT)
}

export function isJsonFileDialect(): boolean {
    const dialect = (config as { db_dialect?: string }).db_dialect
    if (!dialect) return false
    return String(dialect).startsWith(JSON_FILE_DIALECT)
}

export function quoteSqliteIdentifier(name: string): string {
    return `"${String(name).replace(/"/g, '""')}"`
}
import { config } from '../inits/global'

export const SQLITE_DIALECT = 'sqlite3'

export function isSqliteDialect(): boolean {
    return config.db_dialect === SQLITE_DIALECT
}

export function quoteSqliteIdentifier(name: string): string {
    return `"${String(name).replace(/"/g, '""')}"`
}
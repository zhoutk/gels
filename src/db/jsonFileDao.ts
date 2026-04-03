import * as fs from 'fs'
import * as path from 'path'
import IDao from './idao'
import TransElement from '../common/transElement'
import { config, jsResponse, logger, runtime, tools } from '../inits/global'
import { STCODES } from '../inits/enums'

type JsonRow = Record<string, unknown>

type JsonTable = {
    table: string
    rows: JsonRow[]
    columns?: string[]
}

type JsonStore = JsonTable[]

type QueryCondition = (row: JsonRow) => boolean

type AggregateSpec = {
    source: string
    alias: string
}

type QuerySpec = {
    conditions: QueryCondition[]
    groupField?: string
    countSpecs: AggregateSpec[]
    sumSpecs: AggregateSpec[]
    sortText?: string
    page: number
    size: number
    hasAggregates: boolean
}

const DEFAULT_DB_NAME = 'datum.json'

let storeCache: JsonStore | null = null
let storeCachePath: string | null = null

function resolveDatabasePath(): string {
    const dbName = String(config.dbconfig.db_name || DEFAULT_DB_NAME).trim()
    const fileName = dbName.length === 0 ? DEFAULT_DB_NAME : dbName
    const absolutePath = path.isAbsolute(fileName) ? fileName : path.resolve(process.cwd(), fileName)
    fs.mkdirSync(path.dirname(absolutePath), { recursive: true })
    return absolutePath
}

function readStore(): JsonStore {
    const databasePath = resolveDatabasePath()
    if (storeCache && storeCachePath === databasePath) {
        return storeCache
    }

    try {
        const raw = fs.readFileSync(databasePath, 'utf8')
        const parsed = raw.trim().length === 0 ? [] : JSON.parse(raw)
        storeCache = normalizeStore(parsed)
    } catch (err) {
        const code = (err as NodeJS.ErrnoException)?.code
        if (code !== 'ENOENT' && logger && typeof logger.error === 'function') {
            logger.error(`json store load fail: ${String((err as any)?.message ?? err)}`)
        }
        storeCache = []
    }

    storeCachePath = databasePath
    return storeCache
}

function writeStore(store: JsonStore): void {
    const databasePath = resolveDatabasePath()
    fs.writeFileSync(databasePath, JSON.stringify(store, null, 2), 'utf8')
    storeCache = store
    storeCachePath = databasePath
}

function normalizeStore(value: unknown): JsonStore {
    if (!Array.isArray(value)) return []
    return value.map((item) => {
        const tableName = typeof (item as any)?.table === 'string'
            ? String((item as any).table)
            : typeof (item as any)?.name === 'string'
                ? String((item as any).name)
                : ''
        const rowsSource = Array.isArray((item as any)?.rows)
            ? (item as any).rows
            : Array.isArray((item as any)?.data)
                ? (item as any).data
                : []
        const rows = rowsSource
            .filter((row: unknown) => row && typeof row === 'object' && !Array.isArray(row))
            .map((row: unknown) => ({ ...(row as JsonRow) }))
        const columns = Array.isArray((item as any)?.columns)
            ? (item as any).columns.filter((column: unknown) => typeof column === 'string').map((column: string) => column)
            : Array.isArray((item as any)?.schema)
                ? (item as any).schema.filter((column: unknown) => typeof column === 'string').map((column: string) => column)
                : inferColumnsFromRows(rows)
        return { table: tableName, rows, columns }
    }).filter((item) => item.table.length > 0)
}

function cloneStore(store: JsonStore): JsonStore {
    return JSON.parse(JSON.stringify(store)) as JsonStore
}

function getTable(store: JsonStore, tableName: string): JsonTable | undefined {
    return store.find((item) => item.table === tableName)
}

function inferColumnsFromRows(rows: JsonRow[]): string[] | undefined {
    const columns: string[] = []
    for (const row of rows) {
        for (const key of Object.keys(row)) {
            if (!columns.includes(key)) {
                columns.push(key)
            }
        }
    }
    return columns.length > 0 ? columns : undefined
}

function ensureTable(store: JsonStore, tableName: string): JsonTable {
    let table = getTable(store, tableName)
    if (!table) {
        table = { table: tableName, rows: [] }
        store.push(table)
    }
    return table
}

function removeTable(store: JsonStore, tableName: string): boolean {
    const index = store.findIndex((item) => item.table === tableName)
    if (index < 0) return false
    store.splice(index, 1)
    return true
}

function applySchemaDefaults(table: JsonTable, row: JsonRow): JsonRow {
    const normalized = { ...row }
    if (Array.isArray(table.columns)) {
        for (const column of table.columns) {
            if (!(column in normalized)) {
                normalized[column] = null
            }
        }
    }
    return normalized
}

function parseCreateColumns(sql: string): string[] | undefined {
    const openIndex = sql.indexOf('(')
    const closeIndex = sql.lastIndexOf(')')
    if (openIndex < 0 || closeIndex <= openIndex) return undefined

    const body = sql.slice(openIndex + 1, closeIndex)
    const parts: string[] = []
    let current = ''
    let depth = 0

    for (const char of body) {
        if (char === '(') {
            depth += 1
            current += char
            continue
        }
        if (char === ')') {
            depth = Math.max(0, depth - 1)
            current += char
            continue
        }
        if (char === ',' && depth === 0) {
            parts.push(current.trim())
            current = ''
            continue
        }
        current += char
    }

    if (current.trim().length > 0) {
        parts.push(current.trim())
    }

    const columns: string[] = []
    for (const part of parts) {
        const normalized = part.trim().toLowerCase()
        if (normalized.startsWith('primary key') || normalized.startsWith('unique') || normalized.startsWith('key ') || normalized.startsWith('constraint')) {
            continue
        }
        const match = part.trim().match(/^[`"']?([^\s`"()]+)[`"']?\s+/)
        if (match && match[1]) {
            columns.push(match[1])
        }
    }

    return columns.length > 0 ? columns : undefined
}

function toPrimitiveString(value: unknown): string | null {
    if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') return String(value)
    return null
}

function parseMaybeList(value: unknown): unknown[] | null {
    if (Array.isArray(value)) return value
    if (typeof value !== 'string') return null
    if (!value.startsWith('[') && value.indexOf(',') < 0) return null
    return tools.arryParse(value)
}

function isNil(value: unknown): boolean {
    return value === null || value === undefined
}

function toComparableNumber(value: unknown): number | null {
    if (typeof value === 'number' && Number.isFinite(value)) return value
    if (typeof value === 'string' && value.trim().length > 0) {
        const parsed = Number(value)
        if (Number.isFinite(parsed)) return parsed
    }
    return null
}

function valuesEqual(left: unknown, right: unknown): boolean {
    if (isNil(left) && isNil(right)) return true
    if (isNil(left) || isNil(right)) return false
    const leftNumber = toComparableNumber(left)
    const rightNumber = toComparableNumber(right)
    if (leftNumber !== null && rightNumber !== null) {
        return leftNumber === rightNumber
    }
    return String(left) === String(right)
}

function containsValue(left: unknown, right: unknown): boolean {
    if (isNil(left) || isNil(right)) return false
    return String(left).includes(String(right))
}

function compareByOperator(left: unknown, operator: string, right: unknown): boolean {
    const leftNumber = toComparableNumber(left)
    const rightNumber = toComparableNumber(right)
    const useNumeric = leftNumber !== null && rightNumber !== null
    const l = useNumeric ? leftNumber : String(left ?? '')
    const r = useNumeric ? rightNumber : String(right ?? '')

    switch (operator) {
        case '>,':
            return l > r
        case '>=,':
            return l >= r
        case '<,':
            return l < r
        case '<=,':
            return l <= r
        case '<>,':
            return l !== r
        case '=,':
            return l === r
        default:
            return false
    }
}

function parseAggregateSpecs(value: unknown, label: string): AggregateSpec[] | null {
    const parts = parseMaybeList(value)
    if (!parts || parts.length === 0 || parts.length % 2 === 1) {
        return null
    }

    const specs: AggregateSpec[] = []
    for (let i = 0; i < parts.length; i += 2) {
        const source = toPrimitiveString(parts[i])
        const alias = toPrimitiveString(parts[i + 1])
        if (source === null || alias === null) {
            return null
        }
        specs.push({ source, alias })
    }

    void label
    return specs
}

function buildQuerySpec(params: Record<string, unknown>): { error?: any; spec?: QuerySpec } {
    let { sort, search, fuzzy, page: rawPage, size: rawSize, sum, count, group, ...restParams } = params || {}
    const page = Math.max(0, Number(rawPage) || 0)
    const size = Math.max(1, Number(rawSize) || runtime.PAGESIZE)
    const isFuzzySearch = search !== undefined || fuzzy !== undefined
    const conditions: QueryCondition[] = []

    let groupField: string | undefined
    if (group !== undefined) {
        const groupText = toPrimitiveString(group)
        if (groupText === null) {
            return { error: jsResponse(STCODES.PARAMERR, 'Invalid group value.') }
        }
        groupField = groupText
    }

    const countSpecs = count === undefined ? [] : parseAggregateSpecs(count, 'count')
    if (count !== undefined && !countSpecs) {
        return { error: jsResponse(STCODES.PARAMERR, 'Format of count is wrong.') }
    }

    const sumSpecs = sum === undefined ? [] : parseAggregateSpecs(sum, 'sum')
    if (sum !== undefined && !sumSpecs) {
        return { error: jsResponse(STCODES.PARAMERR, 'Format of sum is wrong.') }
    }

    const keys = Object.keys(restParams)
    for (const key of keys) {
        let value: any = (params as Record<string, any>)[key]
        if (['lks', 'ins', 'ors'].indexOf(key) < 0) {
            const parsed = parseMaybeList(value)
            if (parsed) value = parsed
        }

        if (key === 'lks' || key === 'ins' || key === 'ors') {
            const parsed = parseMaybeList(value)
            if (!parsed || parsed.length < 2 || ((key === 'ors' || key === 'lks') && parsed.length % 2 === 1)) {
                return { error: jsResponse(STCODES.PARAMERR, `Format of ${key} is wrong.`) }
            }

            if (key === 'ins') {
                const fieldName = toPrimitiveString(parsed.shift())
                if (fieldName === null) {
                    return { error: jsResponse(STCODES.PARAMERR, `Format of ${key} is wrong.`) }
                }
                const expectedValues = parsed.slice()
                conditions.push((row) => expectedValues.some((expected) => valuesEqual(row[fieldName], expected)))
            } else {
                const pairs = parsed.slice()
                conditions.push((row) => {
                    for (let i = 0; i < pairs.length; i += 2) {
                        const fieldName = toPrimitiveString(pairs[i])
                        if (fieldName === null) return false
                        const expected = pairs[i + 1]
                        if (expected === null || expected === undefined) {
                            if (isNil(row[fieldName])) return true
                            continue
                        }
                        const matches = key === 'lks'
                            ? containsValue(row[fieldName], expected)
                            : valuesEqual(row[fieldName], expected)
                        if (matches) return true
                    }
                    return false
                })
            }
            continue
        }

        if (value === 'null') {
            conditions.push((row) => isNil(row[key]))
            continue
        }

        const expressionText = Array.isArray(value) ? value.join() : String(value)
        if ((Array.isArray(value) && (value.length === 2 || value.length === 4)) &&
            ['>,', '>=,', '<,', '<=,', '<>,', '=,'].some((element) => expressionText.startsWith(element))
        ) {
            const expressionParts = expressionText.split(',')
            if (expressionParts.length === 2) {
                const operator = expressionParts[0] + ','
                const expected = expressionParts[1]
                conditions.push((row) => compareByOperator(row[key], operator, expected))
            } else if (expressionParts.length === 4) {
                const operatorA = expressionParts[0] + ','
                const expectedA = expressionParts[1]
                const operatorB = expressionParts[2] + ','
                const expectedB = expressionParts[3]
                conditions.push((row) => compareByOperator(row[key], operatorA, expectedA) && compareByOperator(row[key], operatorB, expectedB))
            } else {
                return { error: jsResponse(STCODES.PARAMERR, `Format of ${key} is wrong.`) }
            }
            continue
        }

        if (isFuzzySearch) {
            conditions.push((row) => containsValue(row[key], value))
            continue
        }

        if (Array.isArray(value)) {
            conditions.push((row) => value.some((item: unknown) => valuesEqual(row[key], item)))
            continue
        }

        conditions.push((row) => valuesEqual(row[key], value))
    }

    const spec: QuerySpec = {
        conditions,
        groupField,
        countSpecs: countSpecs || [],
        sumSpecs: sumSpecs || [],
        sortText: sort === undefined ? undefined : toPrimitiveString(sort) || undefined,
        page,
        size,
        hasAggregates: (countSpecs?.length ?? 0) > 0 || (sumSpecs?.length ?? 0) > 0,
    }

    if (sort !== undefined && spec.sortText === undefined) {
        return { error: jsResponse(STCODES.PARAMERR, 'Invalid sort value.') }
    }

    return { spec }
}

function compareSortValues(left: unknown, right: unknown): number {
    if (isNil(left) && isNil(right)) return 0
    if (isNil(left)) return 1
    if (isNil(right)) return -1
    const leftNumber = toComparableNumber(left)
    const rightNumber = toComparableNumber(right)
    if (leftNumber !== null && rightNumber !== null) {
        if (leftNumber < rightNumber) return -1
        if (leftNumber > rightNumber) return 1
        return 0
    }
    const leftText = String(left)
    const rightText = String(right)
    return leftText.localeCompare(rightText)
}

function sortRows(rows: JsonRow[], sortText?: string): JsonRow[] {
    if (!sortText) return rows
    const clauses = sortText
        .split(',')
        .map((part) => part.trim())
        .filter((part) => part.length > 0)
        .map((part) => {
            const tokens = part.split(/\s+/).filter((token) => token.length > 0)
            const field = tokens[0]
            const direction = tokens[1] && tokens[1].toLowerCase() === 'desc' ? -1 : 1
            return { field, direction }
        })

    return rows.slice().sort((left, right) => {
        for (const clause of clauses) {
            const compare = compareSortValues(left[clause.field], right[clause.field])
            if (compare !== 0) return compare * clause.direction
        }
        return 0
    })
}

function countMatches(rows: JsonRow[], source: string): number {
    if (source === '*' || source === '1') {
        return rows.length
    }
    return rows.filter((row) => !isNil(row[source])).length
}

function sumMatches(rows: JsonRow[], source: string): number | null {
    let hasValue = false
    let total = 0
    for (const row of rows) {
        const numeric = toComparableNumber(row[source])
        if (numeric !== null) {
            hasValue = true
            total += numeric
        }
    }
    return hasValue ? total : null
}

function buildAggregateRow(rows: JsonRow[], spec: QuerySpec): JsonRow {
    const row: JsonRow = {}
    for (const countSpec of spec.countSpecs) {
        row[countSpec.alias] = countMatches(rows, countSpec.source)
    }
    for (const sumSpec of spec.sumSpecs) {
        row[sumSpec.alias] = sumMatches(rows, sumSpec.source)
    }
    return row
}

function groupRows(rows: JsonRow[], groupField: string): Map<string, { key: unknown; rows: JsonRow[] }> {
    const grouped = new Map<string, { key: unknown; rows: JsonRow[] }>()
    for (const row of rows) {
        const groupValue = row[groupField]
        const key = `${typeof groupValue}:${JSON.stringify(groupValue)}`
        const existing = grouped.get(key)
        if (existing) {
            existing.rows.push(row)
        } else {
            grouped.set(key, { key: groupValue, rows: [row] })
        }
    }
    return grouped
}

function buildGroupedRows(rows: JsonRow[], spec: QuerySpec): JsonRow[] {
    if (!spec.groupField) return rows
    const grouped = groupRows(rows, spec.groupField)
    const result: JsonRow[] = []
    for (const groupedRow of grouped.values()) {
        const row: JsonRow = { [spec.groupField]: groupedRow.key }
        for (const countSpec of spec.countSpecs) {
            row[countSpec.alias] = countMatches(groupedRow.rows, countSpec.source)
        }
        for (const sumSpec of spec.sumSpecs) {
            row[sumSpec.alias] = sumMatches(groupedRow.rows, sumSpec.source)
        }
        result.push(row)
    }
    return result
}

function projectFields(rows: JsonRow[], fields: string[], spec: QuerySpec): JsonRow[] {
    if (!Array.isArray(fields) || fields.length === 0) {
        return rows.map((row) => ({ ...row }))
    }

    const allowed = new Set(fields)
    if (spec.groupField) {
        allowed.add(spec.groupField)
    }
    for (const countSpec of spec.countSpecs) {
        allowed.add(countSpec.alias)
    }
    for (const sumSpec of spec.sumSpecs) {
        allowed.add(sumSpec.alias)
    }

    return rows.map((row) => {
        const projected: JsonRow = {}
        for (const key of allowed) {
            if (Object.prototype.hasOwnProperty.call(row, key)) {
                projected[key] = row[key]
            }
        }
        return projected
    })
}

function makeQueryResult(rows: JsonRow[], fields: string[], spec: QuerySpec): any {
    const projectedRows = projectFields(rows, fields, spec)
    if (spec.page > 0) {
        const pageIndex = spec.page - 1
        const start = pageIndex * spec.size
        const pagedRows = projectedRows.slice(start, start + spec.size)
        return jsResponse(STCODES.SUCCESS, 'data query success.', {
            data: pagedRows,
            pages: projectedRows.length > 0 ? Math.ceil(projectedRows.length / spec.size) : 0,
            records: projectedRows.length,
        })
    }

    return jsResponse(STCODES.SUCCESS, 'data query success.', {
        data: projectedRows,
        pages: projectedRows.length > 0 ? 1 : 0,
        records: projectedRows.length,
    })
}

function applyFilters(rows: JsonRow[], spec: QuerySpec): JsonRow[] {
    return rows.filter((row) => spec.conditions.every((condition) => condition(row)))
}

function normalizeRowInput(params: Record<string, unknown>): JsonRow {
    return { ...params }
}

function upsertRow(table: JsonTable, input: JsonRow): { affectedRows: number; insertId: string | number } {
    const row = applySchemaDefaults(table, normalizeRowInput(input))
    const insertId = row.id === undefined || row.id === null || String(row.id).length === 0
        ? tools.uuid()
        : typeof row.id === 'string' || typeof row.id === 'number'
            ? row.id
            : String(row.id)
    row.id = insertId

    const index = table.rows.findIndex((existing) => valuesEqual(existing.id, insertId))
    if (index >= 0) {
        table.rows[index] = row
    } else {
        table.rows.push(row)
    }

    return { affectedRows: 1, insertId }
}

function updateRow(table: JsonTable, input: JsonRow, id: string | number): { affectedRows: number } {
    const index = table.rows.findIndex((existing) => valuesEqual(existing.id, id))
    if (index < 0) return { affectedRows: 0 }
    const nextRow = applySchemaDefaults(table, { ...table.rows[index], ...normalizeRowInput(input), id })
    table.rows[index] = nextRow
    return { affectedRows: 1 }
}

function deleteRow(table: JsonTable, id: string | number): { affectedRows: number } {
    const index = table.rows.findIndex((existing) => valuesEqual(existing.id, id))
    if (index < 0) return { affectedRows: 0 }
    table.rows.splice(index, 1)
    return { affectedRows: 1 }
}

function createTable(store: JsonStore, tableName: string, columns?: string[]): { affectedRows: number } {
    const existing = getTable(store, tableName)
    if (existing) {
        existing.rows = []
        existing.columns = columns && columns.length > 0 ? columns.slice() : existing.columns
        return { affectedRows: 1 }
    }
    store.push({ table: tableName, rows: [], columns: columns && columns.length > 0 ? columns.slice() : undefined })
    return { affectedRows: 1 }
}

function dropTable(store: JsonStore, tableName: string): { affectedRows: number } {
    const removed = removeTable(store, tableName)
    return { affectedRows: removed ? 1 : 0 }
}

function resolveTableNameFromValues(sql: string, values: unknown[]): string {
    const fromValues = values.length > 0 ? values[0] : undefined
    if (typeof fromValues === 'string' || typeof fromValues === 'number') {
        return String(fromValues)
    }

    const match = sql.match(/(?:from|table|into|update|drop\s+table\s+if\s+exists)\s+([`"']?)([\w.-]+)\1/i)
    return match ? match[2] : ''
}

function applyInsertSql(store: JsonStore, sql: string, values: unknown[]): { affectedRows: number; insertId: string | number } {
    const tableName = resolveTableNameFromValues(sql, values)
    if (!tableName) {
        return { affectedRows: 0, insertId: '' }
    }

    const table = ensureTable(store, tableName)
    const payload = values.length > 1 && typeof values[1] === 'object' && !Array.isArray(values[1])
        ? values[1] as Record<string, unknown>
        : {}
    return upsertRow(table, payload)
}

function applyUpdateSql(store: JsonStore, sql: string, values: unknown[]): { affectedRows: number } {
    const tableName = resolveTableNameFromValues(sql, values)
    const table = getTable(store, tableName)
    if (!table) return { affectedRows: 0 }

    const sqlMatch = sql.match(/update\s+\?\?\s+set\s+(.+?)\s+where\s+id\s*=\s*\?/i)
    const assignmentText = sqlMatch ? sqlMatch[1] : ''
    const assignments = assignmentText.split(',').map((part) => part.trim()).filter((part) => part.length > 0)
    const id = values.length > 0 ? values[values.length - 1] as string | number : ''
    const updatePayload: JsonRow = {}
    let valueIndex = 1

    for (const assignment of assignments) {
        const [fieldRaw, expressionRaw] = assignment.split('=')
        const field = fieldRaw ? fieldRaw.trim().replace(/^`|`$/g, '').replace(/^"|"$/g, '') : ''
        const expression = expressionRaw ? expressionRaw.trim() : ''
        if (field.length === 0) continue
        if (expression === '?') {
            updatePayload[field] = values[valueIndex]
            valueIndex += 1
        }
    }

    return updateRow(table, updatePayload, id)
}

function applyDeleteSql(store: JsonStore, sql: string, values: unknown[]): { affectedRows: number } {
    const tableName = resolveTableNameFromValues(sql, values)
    const table = getTable(store, tableName)
    if (!table) return { affectedRows: 0 }
    const id = values.length > 0 ? values[values.length - 1] as string | number : ''
    return deleteRow(table, id)
}

function applyExecSql(store: JsonStore, sql: string, values: unknown[]): any {
    const normalized = sql.trim().toLowerCase()
    if (normalized.startsWith('begin') || normalized.startsWith('commit') || normalized.startsWith('rollback')) {
        return normalizeRunResult()
    }

    if (normalized.startsWith('drop table')) {
        const tableName = resolveTableNameFromValues(sql, values)
        return dropTable(store, tableName)
    }

    if (normalized.startsWith('create table')) {
        const tableName = resolveTableNameFromValues(sql, values)
        return createTable(store, tableName, parseCreateColumns(sql))
    }

    if (normalized.startsWith('update')) {
        return applyUpdateSql(store, sql, values)
    }

    if (normalized.startsWith('delete from')) {
        return applyDeleteSql(store, sql, values)
    }

    if (normalized.startsWith('insert into')) {
        return applyInsertSql(store, sql, values)
    }

    throw jsResponse(STCODES.DBOPERATEERR, `Unsupported SQL: ${sql}`)
}

function normalizeRunResult(result: { affectedRows?: number; insertId?: number | string } = {}) {
    return {
        affectedRows: Number(result.affectedRows ?? 0),
        insertId: result.insertId ?? 0,
    }
}

function queryMetadataRows(sql: string, values: unknown[]): JsonRow[] {
    const normalized = sql.trim().toLowerCase()
    const tableName = values.length > 0 ? String(values[values.length - 1] ?? '') : ''
    if (tableName.length === 0) return []

    if (normalized.includes('information_schema.views')) {
        return []
    }

    if (normalized.includes('information_schema.columns')) {
        return []
    }

    if (normalized.includes('sqlite_master')) {
        const typeValue = values.length > 0 ? String(values[0] ?? '').toLowerCase() : 'table'
        if (typeValue !== 'table') return []
        return getTable(readStore(), tableName) ? [{ TABLE_NAME: tableName }] : []
    }

    if (normalized.includes('information_schema.tables')) {
        return getTable(readStore(), tableName) ? [{ TABLE_NAME: tableName }] : []
    }

    return []
}

function queryStore(tablename: string, params: Record<string, unknown> = {}, fields: string[] = []): any {
    const store = readStore()
    const table = getTable(store, tablename)
    const rows = table ? table.rows.map((row) => ({ ...row })) : []
    const query = buildQuerySpec(params)
    if (query.error) return query.error
    const spec = query.spec as QuerySpec

    const filteredRows = applyFilters(rows, spec)
    let resultRows: JsonRow[]
    if (spec.groupField) {
        resultRows = buildGroupedRows(filteredRows, spec)
    } else if (spec.hasAggregates) {
        resultRows = [buildAggregateRow(filteredRows, spec)]
    } else {
        resultRows = filteredRows
    }

    resultRows = sortRows(resultRows, spec.sortText)
    return makeQueryResult(resultRows, fields, spec)
}

async function runTransaction(store: JsonStore, elements: Array<{ method: string; table: string; params: unknown; id?: string | number; sql?: string }>): Promise<any> {
    const workingStore = cloneStore(store)
    try {
        for (const element of elements) {
            if (element.sql !== undefined) {
                applyExecSql(workingStore, element.sql, Array.isArray(element.params) ? element.params : [])
                continue
            }

            if (element.method === 'Insert' && !Array.isArray(element.params)) {
                const table = ensureTable(workingStore, element.table)
                upsertRow(table, element.params as Record<string, unknown>)
            } else if (element.method === 'Update' && !Array.isArray(element.params) && element.id !== undefined) {
                const table = ensureTable(workingStore, element.table)
                updateRow(table, element.params as Record<string, unknown>, element.id)
            } else if (element.method === 'Delete' && element.id !== undefined) {
                const table = ensureTable(workingStore, element.table)
                deleteRow(table, element.id)
            } else if (element.method === 'Batch' && Array.isArray(element.params)) {
                const table = ensureTable(workingStore, element.table)
                for (const item of element.params as Array<Record<string, unknown>>) {
                    upsertRow(table, item)
                }
            }
        }

        writeStore(workingStore)
        return jsResponse(STCODES.SUCCESS, 'trans run success', { affectedRows: elements.length })
    } catch (err) {
        return err
    }
}

export default class JsonFileDao implements IDao {
    static logFlag = config.DbLogClose ? false : true

    select(tablename: string, params: Record<string, unknown> = {}, fields?: string[]): Promise<unknown> {
        return Promise.resolve(queryStore(tablename, params, fields || []))
    }

    insert(tablename: string, params: Record<string, unknown> = {}): Promise<unknown> {
        const store = readStore()
        const table = ensureTable(store, tablename)
        const result = upsertRow(table, params)
        writeStore(store)
        return Promise.resolve(result)
    }

    update(tablename: string, params: Record<string, unknown> = {}, id: string | number): Promise<unknown> {
        const store = readStore()
        const table = ensureTable(store, tablename)
        const result = updateRow(table, params, id)
        writeStore(store)
        return Promise.resolve(result)
    }

    delete(tablename: string, id: string | number): Promise<unknown> {
        const store = readStore()
        const table = ensureTable(store, tablename)
        const result = deleteRow(table, id)
        writeStore(store)
        return Promise.resolve(result)
    }

    querySql(sql: string, values: unknown[], params: Record<string, unknown> = {}, fields?: string[]): Promise<unknown> {
        void params
        void fields
        const rows = queryMetadataRows(sql, values)
        return Promise.resolve(jsResponse(STCODES.SUCCESS, 'data query success.', {
            data: rows,
            pages: rows.length > 0 ? 1 : 0,
            records: rows.length,
        }))
    }

    execSql(sql: string, values: unknown[]): Promise<unknown> {
        try {
            const store = readStore()
            const result = applyExecSql(store, sql, values)
            writeStore(store)
            return Promise.resolve(normalizeRunResult(result as any))
        } catch (err) {
            if (logger && typeof logger.error === 'function') {
                logger.error(`${String((err as any)?.message ?? err)} _Sql_ : ${sql} _Values_ : ${JSON.stringify(values)}`)
            }
            return Promise.reject(jsResponse(STCODES.DBOPERATEERR, (err as any)?.message ?? String(err)))
        }
    }

    insertBatch(tablename: string, elements: Array<Record<string, unknown>>): Promise<any> {
        const store = readStore()
        const table = ensureTable(store, tablename)
        for (const element of elements) {
            upsertRow(table, element)
        }
        writeStore(store)
        return Promise.resolve({ affectedRows: elements.length, insertId: elements.length > 0 ? elements[elements.length - 1].id ?? 0 : 0 })
    }

    transGo(elements: Array<TransElement>, isAsync: boolean = true): Promise<any> {
        void isAsync
        const store = readStore()
        const mapped = elements.map((element) => ({
            method: element.method,
            table: element.table,
            params: element.params,
            id: element.id,
            sql: element.sql,
        }))
        return runTransaction(store, mapped)
    }

    close(): Promise<void> {
        storeCache = null
        storeCachePath = null
        return Promise.resolve()
    }

    private async query(tablename: string, params: Record<string, unknown> | unknown[], fields: string[] = [], sql = '', values: unknown[] = []): Promise<any> {
        void sql
        void values
        const recordParams = Array.isArray(params) ? {} : params
        return queryStore(tablename, recordParams, fields)
    }
}

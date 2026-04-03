import BaseDao from '../db/baseDao'
import { isPostgresDialect, isSqliteDialect, quotePostgresIdentifier, quoteSqliteIdentifier } from '../db/sqlDialect'
import { config, jsResponse } from '../inits/global'
import { STCODES } from '../inits/enums'

type DbInitRow = {
    id: string
    name: string
    age: number
    score: number
}

const DEFAULT_TABLE_NAME = 'table_for_test'

const SEED_ROWS: DbInitRow[] = [
    { id: 'a1b2c3d4', name: 'Kevin 凯文', age: 18, score: 99.99 },
    { id: 'a2b3c4d5', name: 'test001', age: 19, score: 98.88 },
    { id: 'a3b4c5d6', name: 'test002', age: 20, score: 97.77 },
    { id: 'a4b5c6d7', name: 'test003', age: 21, score: 96.66 },
    { id: 'a5b6c7d8', name: 'test004', age: 22, score: 95.55 },
    { id: 'a6b7c8d9', name: 'test005', age: 23, score: 94.44 },
]

function resolveTableName(params: Record<string, unknown>): string {
    const candidate = params.tableName || params.table || params.name || params.targetTable
    if (typeof candidate === 'string' && candidate.trim().length > 0) {
        return candidate.trim()
    }
    return DEFAULT_TABLE_NAME
}

export default class DbInitDao {
    table: string

    constructor(table?: string) {
        this.table = table || 'db_init'
    }

    async create(params: Record<string, unknown> = {}, _fields: string[] = [], _session: { userid: string } = { userid: '' }): Promise<any> {
        void _fields
        void _session
        await BaseDao.initDao()
        const tableName = resolveTableName(params)
        const baseDao = new BaseDao(tableName)
        const dropSql = isSqliteDialect() || isPostgresDialect()
            ? `DROP TABLE IF EXISTS ${quoteSqliteIdentifier(tableName)}`
            : 'DROP TABLE IF EXISTS ??'
        const createSql = isSqliteDialect()
            ? `CREATE TABLE ${quoteSqliteIdentifier(tableName)} (id text NOT NULL, name text DEFAULT NULL, age integer DEFAULT NULL, score real DEFAULT NULL, PRIMARY KEY (id))`
            : isPostgresDialect()
                ? `CREATE TABLE ${quotePostgresIdentifier(tableName)} (id text NOT NULL PRIMARY KEY, name text DEFAULT NULL, age integer DEFAULT NULL, score numeric(10,2) DEFAULT NULL)`
            : 'CREATE TABLE ?? (id varchar(32) NOT NULL, name varchar(255) DEFAULT NULL, age int(11) DEFAULT NULL, score decimal(10,2) DEFAULT NULL, PRIMARY KEY (id)) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4'

        await baseDao.execSql(dropSql, isSqliteDialect() || isPostgresDialect() ? [] : [tableName])
        await baseDao.execSql(createSql, isSqliteDialect() || isPostgresDialect() ? [] : [tableName])

        const insertResult = await baseDao.insertBatch(tableName, SEED_ROWS)

        return jsResponse(STCODES.SUCCESS, 'db init success.', {
            table: tableName,
            affectedRows: insertResult.affectedRows,
            seededRows: SEED_ROWS.length,
            dbName: config.dbconfig.db_name,
        })
    }

    async retrieve(params: Record<string, unknown> = {}): Promise<any> {
        await BaseDao.initDao()
        const tableName = resolveTableName(params)
        const rs = await new BaseDao().querySql(
            isSqliteDialect()
                ? 'SELECT name AS TABLE_NAME FROM sqlite_master WHERE type = ? AND name = ? '
                : isPostgresDialect()
                    ? 'SELECT table_name AS TABLE_NAME FROM information_schema.tables WHERE table_schema = current_schema() AND table_name = ? '
                    : 'SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ? ',
            isSqliteDialect()
                ? ['table', tableName]
                : isPostgresDialect()
                    ? [tableName]
                    : [config.dbconfig.db_name, tableName],
            {},
            []
        ) as any
        const isReady = Array.isArray(rs?.data) && rs.data.length > 0
        return jsResponse(STCODES.SUCCESS, isReady ? 'db init table is ready.' : 'db init table is not ready.', {
            table: tableName,
            ready: isReady,
        })
    }

    async delete(params: Record<string, unknown> = {}): Promise<any> {
        await BaseDao.initDao()
        const tableName = resolveTableName(params)
        const baseDao = new BaseDao(tableName)

        await baseDao.execSql(
            isSqliteDialect() || isPostgresDialect() ? `DROP TABLE IF EXISTS ${quoteSqliteIdentifier(tableName)}` : 'DROP TABLE IF EXISTS ??',
            isSqliteDialect() || isPostgresDialect() ? [] : [tableName]
        )

        return jsResponse(STCODES.SUCCESS, 'db init table removed.', {
            table: tableName,
        })
    }
}
import BaseDao from '../db/baseDao'
import { config, jsResponse, runtime } from '../inits/global'
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

const TABLE_SCHEMA = () => ({
    id: {
        COLUMN_NAME: 'id',
        COLUMN_TYPE: 'varchar(32)',
        COLUMN_KEY: 'PRI',
    },
    name: {
        COLUMN_NAME: 'name',
        COLUMN_TYPE: 'varchar(255)',
        COLUMN_KEY: '',
    },
    age: {
        COLUMN_NAME: 'age',
        COLUMN_TYPE: 'int(11)',
        COLUMN_KEY: '',
    },
    score: {
        COLUMN_NAME: 'score',
        COLUMN_TYPE: 'decimal(10,2)',
        COLUMN_KEY: '',
    },
})

function resolveTableName(params: Record<string, unknown>): string {
    const candidate = params.tableName || params.table || params.name || params.targetTable
    if (typeof candidate === 'string' && candidate.trim().length > 0) {
        return candidate.trim()
    }
    return DEFAULT_TABLE_NAME
}

function applyTableSchema(tableName: string) {
    runtime.DataTables[tableName] = TABLE_SCHEMA()
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

        await baseDao.execSql('DROP TABLE IF EXISTS ??', [tableName])
        await baseDao.execSql(
            'CREATE TABLE ?? (id varchar(32) NOT NULL, name varchar(255) DEFAULT NULL, age int(11) DEFAULT NULL, score decimal(10,2) DEFAULT NULL, PRIMARY KEY (id)) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4',
            [tableName]
        )

        applyTableSchema(tableName)
        const insertResult = await baseDao.insertBatch(tableName, SEED_ROWS)

        return jsResponse(STCODES.SUCCESS, 'db init success.', {
            table: tableName,
            affectedRows: insertResult.affectedRows,
            seededRows: SEED_ROWS.length,
            dbName: config.dbconfig.db_name,
        })
    }

    async retrieve(params: Record<string, unknown> = {}): Promise<any> {
        const tableName = resolveTableName(params)
        const isReady = Boolean(runtime.DataTables[tableName])
        return jsResponse(STCODES.SUCCESS, isReady ? 'db init table is ready.' : 'db init table is not ready.', {
            table: tableName,
            ready: isReady,
        })
    }

    async delete(params: Record<string, unknown> = {}): Promise<any> {
        await BaseDao.initDao()
        const tableName = resolveTableName(params)
        const baseDao = new BaseDao(tableName)

        await baseDao.execSql('DROP TABLE IF EXISTS ??', [tableName])
        delete runtime.DataTables[tableName]

        return jsResponse(STCODES.SUCCESS, 'db init table removed.', {
            table: tableName,
        })
    }
}
import BaseDao from '../../db/baseDao'

const TYPEFROMMYSQLTOGRAPHQL = {
    int: 'Int',
    varchar: 'String',
    datetime: 'String',
}

async function getInfoFromSql() {
    let typeDefObj = { query: []}, resolvers = { Query: {} }
    let dao = new BaseDao()
    let tables = await dao.querySql('select TABLE_NAME,TABLE_COMMENT from information_schema.`TABLES` ' +
        ' where TABLE_SCHEMA = ? and TABLE_TYPE = ? and substr(TABLE_NAME,1,2) <> ? order by ?',
        [G.CONFIGS.dbconfig.db_name, 'BASE TABLE', 't_', 'TABLE_NAME'])
    let columnRs = []
    tables.data.forEach((table) => {
        columnRs.push(dao.querySql('SELECT	`COLUMNS`.COLUMN_NAME,`COLUMNS`.COLUMN_TYPE,`COLUMNS`.IS_NULLABLE,' +
            '`COLUMNS`.CHARACTER_SET_NAME,`COLUMNS`.COLUMN_DEFAULT,`COLUMNS`.EXTRA,' +
            '`COLUMNS`.COLUMN_KEY,`COLUMNS`.COLUMN_COMMENT,`STATISTICS`.TABLE_NAME,' +
            '`STATISTICS`.INDEX_NAME,`STATISTICS`.SEQ_IN_INDEX,`STATISTICS`.NON_UNIQUE,' +
            '`COLUMNS`.COLLATION_NAME ' +
            'FROM information_schema.`COLUMNS` ' +
            'LEFT JOIN information_schema.`STATISTICS` ON ' +
            'information_schema.`COLUMNS`.TABLE_NAME = `STATISTICS`.TABLE_NAME ' +
            'AND information_schema.`COLUMNS`.COLUMN_NAME = information_schema.`STATISTICS`.COLUMN_NAME ' +
            'AND information_schema.`STATISTICS`.table_schema = ? ' +
            'where information_schema.`COLUMNS`.TABLE_NAME = ? and `COLUMNS`.table_schema = ?',
            [G.CONFIGS.dbconfig.db_name, table.TABLE_NAME, G.CONFIGS.dbconfig.db_name]))
    })
    let rs = await Promise.all(columnRs), len = tables.data.length
    for (let i = 0; i < len; i++) {
        let table = tables.data[i].TABLE_NAME
        let columns = rs[i].data
        let paramStr = ['page: Int', 'size: Int', 'sort: String', 'ins: String', 'ors: String', 'lks: String', 'group: String', 'sum: String', 'search: String']
        let paramId = ''
        if (!typeDefObj[table]) {
            typeDefObj[table] = []
        }
        columns.forEach((col) => {
            let typeStr = TYPEFROMMYSQLTOGRAPHQL[G.tools.getStartTillBracket(col['COLUMN_TYPE'])] || 'String'
            if (col['COLUMN_NAME'].endsWith('_id')) {
                typeDefObj[table].push(`${G.L.trimEnd(col['COLUMN_NAME'], '_id')}: ${G.tools.bigCamelCase(G.L.trimEnd(col['COLUMN_NAME'], '_id'))}\n`)
                resolvers[G.tools.bigCamelCase(table)] = {
                    [G.L.trimEnd(col['COLUMN_NAME'], '_id')]: async (element) => {
                        let rs = await new BaseDao(G.L.trimEnd(col['COLUMN_NAME'], '_id')).retrieve({ id: element[col['COLUMN_NAME']] })
                        return rs.data[0]
                    }
                }

                let fTable = G.L.trimEnd(col['COLUMN_NAME'], '_id')
                if (!typeDefObj[fTable]) {
                    typeDefObj[fTable] = []
                }
                typeDefObj[fTable].push(`${table}s: [${G.tools.bigCamelCase(table)}]\n`)
                resolvers[G.tools.bigCamelCase(fTable)] = {
                    [`${table}s`]: async (element) => {
                        let rs = await new BaseDao(table).retrieve({ [col['COLUMN_NAME']]: element.id})
                        return rs.data
                    }
                }
            } else {
                typeDefObj[table].push(`${col['COLUMN_NAME']}: ${typeStr}${col['IS_NULLABLE'] === 'NO' ? '!' : ''}\n`)
            }
            paramStr.unshift(`${col['COLUMN_NAME']}: ${typeStr}`)
            if (col['COLUMN_NAME'] === 'id')
                paramId = `${col['COLUMN_NAME']}: ${typeStr}`
        })
        if (paramId.length > 0) {
            typeDefObj['query'].push(`${table}(${paramId}!): ${G.tools.bigCamelCase(table)}\n`)
            resolvers.Query[`${table}`] = async (_, { id }) => {
                let rs = await new BaseDao(table).retrieve({ id })
                return rs.data[0]
            }
        } else {
            G.logger.error(`Table [${table}] must have id field.`)
        }
        typeDefObj['query'].push(`${table}s(${paramStr.join(', ')}): [${G.tools.bigCamelCase(table)}]\n`)
        resolvers.Query[`${table}s`] = async (_, args) => {
            let rs = await new BaseDao(table).retrieve(args)
            return rs.data
        }
    }
    let typeDefs = Object.entries(typeDefObj).reduce((total, cur) => {
        return total += `
            type ${G.tools.bigCamelCase(cur[0])} {
                ${cur[1].join('')}
            }
        `
    }, '')
    return { typeDefs, resolvers }
}

export { getInfoFromSql } 
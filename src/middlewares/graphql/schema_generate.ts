import BaseDao from '../../db/baseDao'
import { getInfoFromSql } from '../../../dist/middlewares/graphql/schema_generate'

const TYPEFROMMYSQLTOGRAPHQL = {
    int: 'Int',
    varchar: 'String',
}

async function getInfoFromSql() {
    let typeDefs = [], resolvers = {
        Query: {}
    }
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
    let querys = []
    for (let i = 0; i < len; i++) {
        let table = tables.data[i].TABLE_NAME
        let columns = rs[i].data
        let colStr = ''
        let paramStr = []
        columns.forEach((col) => {
            if (!col['COLUMN_NAME'].endsWith('_id')) {
                colStr += `${col['COLUMN_NAME']}: ${TYPEFROMMYSQLTOGRAPHQL[G.tools.getStartTillBracket(col['COLUMN_TYPE'])]}
                `
            } else {
                colStr += `${G.L.trimEnd(col['COLUMN_NAME'], '_id')}: ${G.tools.bigCamelCase(G.L.trimEnd(col['COLUMN_NAME'], '_id'))}
                `
                resolvers[G.tools.bigCamelCase(table)][G.L.trimEnd(col['COLUMN_NAME'], '_id')] = async (al) => {
                    let rs = await new BaseDao(G.L.trimEnd(col['COLUMN_NAME'], '_id')).retrieve({id: al[col['COLUMN_NAME']]})
                    return rs.data[0]
                  }
            }
            paramStr.push(`${col['COLUMN_NAME']}: ${TYPEFROMMYSQLTOGRAPHQL[G.tools.getStartTillBracket(col['COLUMN_TYPE'])]}`)
        })
        typeDefs.push(`
            type ${G.tools.bigCamelCase(table)} {
                ${colStr}
            }
        `)
        querys.push(`${table}s(${paramStr.join(', ')}): [${G.tools.bigCamelCase(table)}]
        `)
        resolvers.Query[`${table}s`] = async (_, args) => {
            let rs = await new BaseDao(table).retrieve(args)
            return rs.data
          }
    }
    typeDefs.push(`
        type Query {
            ${querys.join('')}
        }
    `)
    return { typeDefs, resolvers }
}

export { getInfoFromSql } 
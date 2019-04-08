import BaseDao from '../../db/baseDao'

const TYPEFROMMYSQLTOGRAPHQL = {
    int: 'Int',
    varchar: 'String',
    datetime: 'String',
}

async function getInfoFromSql() {
    let typeDefObj = { query: [], mutation: []}, resolvers = { Query: {}, Mutation: {} }
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
        G.DataTables[table] = Object.create(null)
        let paramStr = [
            '"""分页参数，第几页，从1开始"""page: Int', 
            '"""分页参数，每页记录数"""size: Int', 
            '"""排序参数，如：sort=id desc,name"""sort: String', 
            '"""in 查询，如： ins=id,1,2,3"""ins: String', 
            '"""or 查询，如： ors=username,john,username,zhoutk"""ors: String', 
            '"""like 查询 or 连接，如： lks=username,jo,password,123"""lks: String', 
            '"""group by 查询，如： group=age"""group: String', 
            '"""求和函数 sum 使用，规定返回字段为sumrs，如：sum=age,sumrs"""sum: String', 
            '"""统计函数 count 使用，规定返回字段为countrs，如：count=1,countrs"""count: String', 
            '"""模糊匹配与精确匹配切换开关，如： username=jo&search="""search: String'
        ]
        let paramId = ''
        if (!typeDefObj[table]) {
            typeDefObj[table] = []
        }
        for (let i = columns.length - 1; i >= 0; i--) {
            let col = columns[i]
            G.DataTables[table][col['COLUMN_NAME']] = G.L.cloneDeep(col) 
            let typeStr = TYPEFROMMYSQLTOGRAPHQL[G.tools.getStartTillBracket(col['COLUMN_TYPE'])] || 'String'
            if (col['COLUMN_NAME'].endsWith('_id')) {
                typeDefObj[table].unshift(`"""${col['COLUMN_COMMENT']}"""
                    ${G.L.trimEnd(col['COLUMN_NAME'], '_id')}: ${G.tools.bigCamelCase(G.L.trimEnd(col['COLUMN_NAME'], '_id'))}`)
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
                if (typeDefObj[fTable].length >= 2)
                    typeDefObj[fTable].splice(typeDefObj[fTable].length - 2, 0, `${table}s: [${G.tools.bigCamelCase(table)}]\n`)
                else 
                    typeDefObj[fTable].push(`${table}s: [${G.tools.bigCamelCase(table)}]\n`)
                resolvers[G.tools.bigCamelCase(fTable)] = {
                    [`${table}s`]: async (element) => {
                        let rs = await new BaseDao(table).retrieve({ [col['COLUMN_NAME']]: element.id})
                        return rs.data
                    }
                }
            } else {
                typeDefObj[table].unshift(`"""${col['COLUMN_COMMENT']}"""${col['COLUMN_NAME']}: ${typeStr}${col['IS_NULLABLE'] === 'NO' ? '!' : ''}\n`)
            }
            paramStr.unshift(`"""${col['COLUMN_COMMENT']}"""${col['COLUMN_NAME']}: ${typeStr}`)
            if (col['COLUMN_NAME'] === 'id')
                paramId = `${col['COLUMN_NAME']}: ${typeStr}`
        }
        typeDefObj[table].push('"""求和（sum）结果返回，规定字段名为 sumrs"""sumrs: Int\n')
        typeDefObj[table].push('"""统计（count）结果返回，规定字段名为 countrs"""countrs: Int\n')
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

        typeDefObj['mutation'].push(`
                create${G.tools.bigCamelCase(table)}(${paramStr.slice(1, paramStr.length - 10).join(', ')}):ReviseResult
                update${G.tools.bigCamelCase(table)}(${paramStr.slice(0, paramStr.length - 10).join(', ')}):ReviseResult
                delete${G.tools.bigCamelCase(table)}(${paramId}!):ReviseResult
            `)
        resolvers.Mutation[`create${G.tools.bigCamelCase(table)}`] = async (_, args) => {
            let rs = await new BaseDao(table).create(args)
            return rs
        }
        resolvers.Mutation[`update${G.tools.bigCamelCase(table)}`] = async (_, args) => {
            let rs = await new BaseDao(table).update(args)
            return rs
        }
        resolvers.Mutation[`delete${G.tools.bigCamelCase(table)}`] = async (_, { id }) => {
            let rs = await new BaseDao(table).delete({ id })
            return rs
        }
    }
    let typeDefs = Object.entries(typeDefObj).reduce((total, cur) => {
        return total += `
            type ${G.tools.bigCamelCase(cur[0])} {
                ${cur[1].join('')}
            }
        `
    }, '')
    typeDefs += `
        type ReviseResult {
            id: Int
            affectedRows: Int
            status: Int
            message: String
        }
    `
    return { typeDefs, resolvers }
}

export { getInfoFromSql } 
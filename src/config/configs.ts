const mysqlDbconfig = {
    db_host: '10.0.0.7',
    db_port: 3306,
    db_name: 'dbtest',
    db_user: 'root',
    db_pass: '123456',
    db_char: 'utf8mb4',
    db_conn: 5,
}

const sqliteDbconfig = {
    db_host: '',
    db_port: 0,
    db_name: ':memory:',
    db_user: '',
    db_pass: '',
    db_char: 'utf8mb4',
    db_conn: 1,
}

const sqliteFileDbconfig = {
    db_host: '',
    db_port: 0,
    db_name: 'datum',
    db_user: '',
    db_pass: '',
    db_char: 'utf8mb4',
    db_conn: 1,
}

const dbconfigByDialect = {
    mysql: mysqlDbconfig,
    sqlite3: sqliteDbconfig,
    'sqlite3-file': sqliteFileDbconfig,
}

export default {
    inits: {
        directory: {
            run: false,
            dirs: ['public/upload', 'public/temp']
        },
        socket: {
            run: false
        }
    },
    port: 5000,
    StandSocketPort: 1202,
    db_dialect: 'sqlite3-file',
    DbLogClose: false,
    skipRestAuth: true,
    cors: {
        allowOrigins: (process.env.CORS_ORIGINS || 'http://127.0.0.1:3000,http://localhost:3000').split(','),
        allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
        allowHeaders: ['Content-Type', 'Authorization', 'token'],
        credentials: true,
    },
    rateLimit: {
        duration: 60000,
        max: 100,
        loginMax: 10,
    },
    get dbconfig() {
        return dbconfigByDialect[this.db_dialect as keyof typeof dbconfigByDialect] ?? dbconfigByDialect.mysql
    },
    jwt: {
        secret: 'zh-123456SFU>a4bh_$3#46d0e85W10aGMkE5xKQ',
        expires_max: 36000      //10小时，单位：秒
    },
}
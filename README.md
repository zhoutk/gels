## 项目介绍
基于koa2、关系数据库（暂时只支持mysql）建立的智能微服务快速开发框架，同时支持graphql与rest标准，使用typescript语言编写，力求安全、高效。  

A framework,  which use koa2, mysql, graphql &amp; typescript , to build micro service rapidly, safely &amp; efficiently.

gels -- 凝胶，希冀该项目能成为联结设计、开发，前端、后端的“强力胶水”，成为微服务快速开发的有力框架。

## 设计思路
中小型企业，更多的是注重快速开发、功能迭代。关系数据库为我们提供了很多有用的支持，我试图把数据库设计与程序开发有机的结合起来，让前端送到后端的json对象自动映射成为标准的SQL查询语句。我的这种ORM方式，服务端不需要写一行代码，只需完成关系数据库的设计，就能为前端提供标准服务接口。  
我设计了一套数据库访问标准接口，在实践中已经得到很好的运用。我已经在es6, typescript, java, python & go中实现；下一步是对数据库支持的扩展，准备支持流行的关系数据库（Mssql, sqlite3, prostgres等），有选择支持一些nosql，比如：mongo。  

## 内容目录
- [安装运行](#安装运行)
- [项目结构](#项目结构)
- [数据库接口设计](#数据库接口设计)
- [默认路由](#默认路由)
- [中间件](#中间件)
- [restful api](#restful_api)
- [智能查询](#智能查询)
- [高级操作](#高级操作)
- [相关视频资料](#相关视频资料)

## 安装运行 
- 运行数据脚本
    ```
    SET NAMES utf8;
    SET FOREIGN_KEY_CHECKS = 0;

    -- ----------------------------
    --  Table structure for `users`
    -- ----------------------------
    DROP TABLE IF EXISTS `users`;
    CREATE TABLE `users` (
    `id` int(11) NOT NULL AUTO_INCREMENT,
    `username` varchar(255) DEFAULT NULL,
    `password` varchar(255) DEFAULT NULL,
    `age` int(11) DEFAULT NULL,
    `power` json DEFAULT NULL,
    PRIMARY KEY (`id`)
    ) ENGINE=InnoDB AUTO_INCREMENT=7 DEFAULT CHARSET=utf8mb4;

    -- ----------------------------
    --  Records of `users`
    -- ----------------------------
    BEGIN;
    INSERT INTO `users` VALUES ('1', 'white', '123', '22', null), ('2', 'john', '456i', '25', null), ('3', 'marry', null, '22', null), ('4', 'bill', '123', '11', null), ('5', 'alice', '122', '16', null), ('6', 'zhoutk', '123456', '26', null);
    COMMIT;

    SET FOREIGN_KEY_CHECKS = 1;
    ```
- 配置文件示例，./src/config/configs.ts
    ```
    export default {
        inits: {
            directory: {
                run: false,
                dirs: ['public/upload', 'public/temp']
            }
        },
        port: 5000,
        db_dialect: 'mysql',
        dbconfig: {
            db_host: 'localhost',
            db_port: 3306,
            db_name: 'strest',
            db_user: 'root',
            db_pass: '123456',
            db_char: 'utf8mb4',
            db_conn: 10,
        },
        jwt: {
            secret: 'zh-tf2Gp4SFU>a4bh_$3#46d0e85W10aGMkE5xKQ',
            expires_max: 36000      //10小时，单位：秒
        },
    }
    ```
- 在终端（Terminal）中依次运行如下命令
    ```
    git clone https://github.com/zhoutk/gels
    cd gels
    npm i -g yarn
    yarn global install typescript tslint nodemon
    yarn install
    tsc -w          //或 command + shift + B，选 tsc:监视
    yarn start      //或 node ./dist/index.js
    ```
## 项目结构

```
├── package.json
├── src                              //源代码目录
│   ├── app.ts                       //koa配置及启动
│   ├── common                       //通用函数或元素目录
│   │   ├── globUtils.ts 			
│   ├── config                       //配置文件目录
│   │   ├── configs.ts
│   ├── db                           //数据封装目录
│   │   ├── baseDao.ts
│   ├── globals.d.ts                 //全局声明定义文件
│   ├── index.ts                     //运行入口
│   ├── inits                        //启动初始化配置目录
│   │   ├── global.ts
│   │   ├── index.ts
│   │   ├── initDirectory.ts
│   ├── middlewares                  //中间件目录
│   │   ├── globalError.ts
│   │   ├── logger.ts
│   │   ├── router
│   │   └── session.ts
│   └── routers                      //路由配置目录
│       ├── index.ts
│       └── router_rs.ts
├── tsconfig.json
└── tslint.json
```

## 数据库接口设计  
- 事务元素接口，sql参数用于手动书写sql语句，id会作为最后一个参数被送入参数数组。
    ```
    export default interface TransElement {
        table: string;
        method: string;
        params: object | Array<any>;
        sql?: string;
        id?: string | number;
    }
    ```
- 数据库操作接口，包括基本CURD，两个执行手写sql接口，一个批量插入与更新二合一接口，一个事务操作接口。实践证明，下面八个接口，在绝大部分情况下已经足够。
    ```
    export default interface IDao {
        select(tablename: string, params: object, fields?: Array<string>): Promise<any>;
        insert(tablename: string, params: object): Promise<any>;
        update(tablename: string, params: object, id: string|number): Promise<any>;
        delete(tablename: string, id: string|number): Promise<any>;
        querySql(sql: string, values: Array<any>, params: object, fields?: Array<string>): Promise<any>;
        execSql(sql: string, values: Array<any>): Promise<any>;
        insertBatch(tablename: string, elements: Array<any>): Promise<any>;
        transGo(elements: Array<TransElement>, isAsync?: boolean): Promise<any>;
    }
    ```

## 默认路由
- /op/:command，只支持POST请求，不鉴权，提供登录等特定服务支持
    - login，登录接口；输入参数{username, password}；登录成功返回参数：{status:200, token}
- /rs/:table[/:id]，支持四种restful请求，GET, POST, PUT, DELELTE，除GET外，其它请求检测是否授权

## 中间件
- globalError，全局错误处理中间件
- logger，日志，集成log4js，输出系统日志
- session，使用jsonwebtoken，实现鉴权；同时，为通过的鉴权的用户生成对应的session
    - 用户登录成功后得到的token，在以后的ajax调用时，需要在header头中加入token key

## restful_api
- [GET] /rs/users[?key=value&...], 列表查询，支持各种智能查询
- [GET] /rs/users/{id}, 单条查询
- [POST] /rs/users, 新增记录
- [PUT] /rs/users/{id}, 修改记录
- [DELETE] /rs/users/{id}, 删除记录

## 智能查询
> 查询保留字：fields, page, size, sort, search, lks, ins, ors, count, sum, group

- fields, 定义查询结果字段，支持数组和逗号分隔字符串两种形式
    ```
    查询示例：  /rs/users?username=white&age=22&fields=["username","age"]
    生成sql：   SELECT username,age FROM users  WHERE username = ?  and age = ?
    ```
- page, 分页参数，第几页
- size, 分页参数，每页行数
- sort, 查询结果排序参数
    ```
    查询示例：  /rs/users?page=1&size=10&sort=age desc
    生成sql：   SELECT * FROM users  ORDER BY age desc LIMIT 0,10
    ```
- search, 模糊查询切换参数，不提供时为精确匹配
    ```
    查询示例：  /rs/users?username=i&password=1&search
    生成sql：   SELECT * FROM users  WHERE username like ?  and password like ?
    ```
- ins, 数据库表单字段in查询，一字段对多个值，例：
    ```
    查询示例：  /rs/users?ins=["age",11,22,26]
    生成sql：   SELECT * FROM users  WHERE age in ( ? )
    ```
- ors, 数据库表多字段精确查询，or连接，多个字段对多个值，支持null值查询，例：
    ```
    查询示例：  /rs/users?ors=["age",1,"age",22,"password",null]
    生成sql：   SELECT * FROM users  WHERE  ( age = ?  or age = ?  or password is null )
    ```
- lks, 数据库表多字段模糊查询，or连接，多个字段对多个值，支持null值查询，例：
    ```
    查询示例：  /rs/users?lks=["username","i","password",null]
    生成sql：   SELECT * FROM users  WHERE  ( username like ?  or password is null  )
    ```
- count, 数据库查询函数count，行统计，例：
    ```
    查询示例：  /rs/users?count=["1","total"]&fields=["username"]
    生成sql：   SELECT username,count(1) as total  FROM users
    ```
- sum, 数据库查询函数sum，字段求和，例：
    ```
    查询示例：  /rs/users?sum=["age","ageSum"]&fields=["username"]
    生成sql：   SELECT username,sum(age) as ageSum  FROM users
    ```
- group, 数据库分组函数group，例：
    ```
    查询示例：  /rs/users?group=age&count=["*","total"]&fields=["age"]
    生成sql：   SELECT age,count(*) as total  FROM users  GROUP BY age
    ```

> 不等操作符查询支持

支持的不等操作符有：>, >=, <, <=, <>, =；逗号符为分隔符，一个字段支持一或二个操作。  
特殊处：使用"="可以使某个字段跳过search影响，让模糊匹配与精确匹配同时出现在一个查询语句中

- 一个字段一个操作，示例：
    ```
    查询示例：  /rs/users?age=>,10
    生成sql：   SELECT * FROM users  WHERE age> ?
    ```
- 一个字段二个操作，示例：
    ```
    查询示例：  /rs/users?age=>,10,<=,35
    生成sql：   SELECT * FROM users  WHERE age> ? and age<= ?
    ```
- 使用"="去除字段的search影响，示例：
    ```
    查询示例：  /rs/users?age==,22&username=i&search
    生成sql：   SELECT * FROM users  WHERE age= ?  and username like ?
    ```

## 高级操作
- 新增一条记录
    - url
    ```
        [POST]/rs/users
    ```
    - header
    ```
        Content-Type: application/json
        token: eyJhbGciOiJIUzI1NiIsInR...
    ```
    - 输入参数
    ```
        {
            "username":"bill",
            "password":"abcd",
            "age":46,
            "power": "[\"admin\",\"data\"]"
        }
    ``` 
    - 返回参数
    ```
        {
            "affectedRows": 1,
            "id": 7,
            "status": 200,
            "message": "data insert success."
        }
    ```
- execSql执行手写sql语句，供后端内部调用
    - 使用示例
    ```
        await new BaseDao().execSql("update users set username = ?, age = ? where id = ? ", ["gels","99","6"])
    ```
    - 返回参数
    ```
        {
            "affectedRows": 1,
            "status": 200,
            "message": "data execSql success."
        }
    ```
- insertBatch批量插入与更新二合一接口，供后端内部调用
    - 使用示例
    ```
        let params = [
                        {
                            "username":"bill2",
                            "password":"523",
                            "age":4
                        },
                        {
                            "username":"bill3",
                            "password":"4",
                            "age":44
                        },
                        {
                            "username":"bill6",
                            "password":"46",
                            "age":46
                        }
                    ]
        await new BaseDao().insertBatch('users', params)
    ```
    - 返回参数
    ```
        {
            "affectedRows": 3,
            "status": 200,
            "message": "data batch success."
        }
    ```
- tranGo事务处理接口，供后端内部调用
    - 使用示例
    ```
        let trs = [
                    {
                        table: 'users',
                        method: 'Insert',
                        params: {
                            username: 'zhou1',
                            password: '1',
                            age: 1
                        }
                    },
                    {
                        table: 'users',
                        method: 'Insert',
                        params: {
                            username: 'zhou2',
                            password: '2',
                            age: 2
                        }
                    },
                    {
                        table: 'users',
                        method: 'Insert',
                        params: {
                            username: 'zhou3',
                            password: '3',
                            age: 3
                        }
                    }
                ]
        await new BaseDao().transGo(trs, true)          //true，异步执行；false,同步执行
    ```
    - 返回参数
    ```
        {
            "affectedRows": 3,
            "status": 200,
            "message": "data trans success."
        }
    ```
    
## 相关视频资料
 
[运用typescript进行node.js后端开发精要][1]  
[nodejs实战之智能微服务快速开发框架][2]  
[JSON-ORM（对象关系映射）设计与实现][3]


  [1]: https://segmentfault.com/l/1500000016954243
  [2]: https://segmentfault.com/l/1500000017034959
  [3]: https://segmentfault.com/l/1500000017108031

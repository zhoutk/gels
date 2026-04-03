# 项目设计文档

## 1. 项目定位

这是一个基于 Koa、MySQL 和 TypeScript 的后端服务框架。它的目标不是做一个通用业务系统，而是提供一套可以快速拼装 REST 接口、数据库访问层和启动初始化流程的服务骨架。

本次升级保持了运行时主版本尽量不变，只对 TypeScript、类型包和少量开发工具做了保守升级，避免影响既有功能。

## 2. 技术栈

- 运行时框架：Koa 2
- 数据访问：mysql2
- API 形态：REST
- 认证：jsonwebtoken
- 日志：log4js
- 工具库：lodash、moment、bluebird、uuid、mkdirp
- 开发工具：TypeScript、nodemon、tslint

## 3. 启动链路

1. `src/index.ts` 是应用入口。
2. 启动时先执行 `globInit()`，把全局对象 `G`、Promise、配置、日志器和工具函数挂载到运行时。
3. `src/app.ts` 创建 Koa 实例，并按固定顺序装载中间件。
4. `src/inits/index.ts` 动态扫描 `src/inits/` 下的 `init*.ts` 文件，并根据配置决定是否执行。
5. `app.listen()` 后对外提供服务。

### 中间件顺序

当前顺序是：

- `cors`
- `logger`
- `session`
- `globalError`
- `conditional`
- `etag`
- `bodyParser`
- `rewrite`
- `static`
- `router`

这个顺序意味着：跨域、日志、鉴权、错误处理、缓存、请求体解析和路由分发都在统一链路中完成。

## 4. 核心模块设计

### 4.1 全局初始化

`src/inits/global.ts` 定义了全局对象 `G`，包含：

- `CONFIGS`：运行配置
- `logger`：log4js 日志实例
- `STCODES`：状态码
- `jsResponse()`：统一响应格式
- `koaError()`：统一异常构造
- `tools`：全局工具函数

这是项目的控制中心，也是后续维护时需要重点关注的耦合点。

当前版本不再维护全局表结构缓存。REST 的字段参数只做格式层面的校验，字段是否真实存在由数据库返回结果决定。

### 4.2 配置管理

`src/config/configs.ts` 当前管理以下内容：

- 启动开关：`inits.directory`、`inits.socket`
- 服务端口：`port`
- Socket 端口：`StandSocketPort`
- 数据库配置：`dbconfig`
- JWT 配置：`jwt.secret`、`jwt.expires_max`

设计上它更像环境级配置中心，而不是业务配置文件。

### 4.3 DAO 层

`src/db/baseDao.ts` 提供统一 CRUD 能力：

- `retrieve()`：查询
- `create()`：插入
- `update()`：更新
- `delete()`：删除
- `querySql()`：自定义 SQL 查询
- `execSql()`：执行 SQL
- `insertBatch()`：批量插入
- `transGo()`：事务执行

`src/db/mysqlDao.ts` 是 mysql2 的具体实现，负责：

- 连接池创建
- SQL 拼装
- 条件查询解析
- 事务控制
- 日志输出

它支持的查询语法较灵活，包含：

- 等值条件
- 范围条件
- `in` 查询
- `like` 查询
- `or` 组合条件
- `count` / `sum`
- 分页与排序

### 4.4 路由层

当前有两类路由：

- `src/routers/router_rs.ts`：通用 REST CRUD 路由
- `src/routers/router_op.ts`：操作类路由，当前主要是登录

其中 `router_rs.ts` 是整个项目最核心的动态路由，它会根据表名寻找对应 DAO，并调用相同名字的方法完成数据操作。

### 4.5 初始化模块

`src/inits/` 下的模块采用约定式加载：文件名以 `init` 开头，且导出 `init(app)` 方法即可参与启动过程。

当前实现中：

- `initDirectory` 会创建上传和临时目录
- `initSocket`、`initSchedule`、`initMemery` 目前更像占位入口

这种设计便于后续扩展，但也意味着初始化逻辑分散在多个文件中。

## 5. 认证与错误处理

### JWT

`src/middlewares/session.ts` 从请求头里的 `token` 字段读取 JWT，并把解析结果写入 `ctx.session`。

特点：

- GET 请求默认放行
- 非 GET 的 `/rs` 类接口需要 token
- token 过期和无效会返回统一状态码

### 错误处理

项目通过全局错误中间件和 `G.koaError()` 做统一错误返回，这让接口响应格式比较一致，但也依赖全局对象 `G`，测试和解耦成本较高。

## 6. 设计评审

### 优点

- 启动链路清晰，模块职责分层明确
- REST CRUD 自动化程度高，适合快速开发
- DAO 层封装比较完整，支持事务和复杂查询
- 配置、日志和响应格式统一，便于排查问题
- REST 接口模式清晰，适合快速开发

### 风险与技术债

- `G` 全局对象耦合度高，不利于测试和模块化演进
- `koa-router`、`tslint` 等包已经进入弃用或迁移期
- 配置文件中直接保存数据库和 JWT 密钥，安全性不足
- `initSchedule`、`initSocket`、`initMemery` 目前仍是骨架代码，功能完整性有限
- 缺少可见的自动化测试脚本，升级依赖后回归验证主要依赖人工检查

### 本次升级结论

- 已保留核心运行时依赖的主版本，避免破坏现有接口行为
- 已升级 TypeScript、`@types/node` 和部分开发依赖
- 已清理部分无实际作用的 stub 类型包，降低维护噪音
- 当前项目更适合做“保守维护 + 渐进重构”，不适合一次性全面大版本迁移

## 7. 后续建议

1. 把密钥和数据库配置迁移到环境变量或独立配置层。
2. 为 REST、DAO 增加回归测试。
3. 逐步评估 `koa-router` -> `@koa/router`、`tslint` -> ESLint 的迁移路径。
4. 如果要继续扩展项目，优先减少全局 `G` 的使用范围。

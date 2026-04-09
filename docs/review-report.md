# Gels 项目评审报告

> 评审日期：2026-04-09
> 评审范围：全部源码、配置、依赖、测试、文档
> 评审目标：全面评估项目现状，识别问题与风险，为 AI Agent 化改造提供基线

---

## 一、项目概览

| 维度 | 内容 |
|------|------|
| 项目名 | gels (arest) |
| 定位 | 基于 Koa2 + 关系数据库的 REST 微服务快速开发框架 |
| 语言 | TypeScript 4.9.5 |
| 运行时 | Node.js |
| 包管理 | pnpm |
| 核心依赖 | koa, @koa/router, mysql2, pg, sqlite3, jsonwebtoken, log4js, lodash |
| 支持数据库 | MySQL, SQLite3 (内存/文件), PostgreSQL, JSON 文件 |
| 代码规模 | src/ 约 20 个文件，~3000 行 TS |

### 架构总览

```
src/
├── index.ts          # 入口，调用 globInit() → appIniter.init()
├── app.ts            # Koa 实例创建，中间件装载
├── inits/            # 启动初始化（全局对象、目录、Socket 等）
│   ├── global.ts     # 全局对象 G、logger、tools、jsResponse
│   ├── enums.ts      # 状态码与消息枚举
│   └── init*.ts      # 可插拔初始化模块
├── config/           # 配置
│   ├── configs.ts    # 数据库、JWT、CORS、限流配置
│   └── log4js.ts     # 日志配置
├── db/               # 数据访问层
│   ├── idao.ts       # IDao 接口（8 个方法）
│   ├── baseDao.ts    # 基础 DAO，动态路由到具体方言实现
│   ├── mysqlDao.ts   # MySQL 实现
│   ├── postgresDao.ts# PostgreSQL 实现
│   ├── sqlite3Dao.ts # SQLite3 实现
│   ├── jsonFileDao.ts# JSON 文件实现（内存+磁盘持久化）
│   └── sqlDialect.ts # 方言判断辅助
├── dao/              # 业务 DAO（扩展 BaseDao）
│   ├── db_init.ts    # 测试数据初始化
│   ├── user.ts       # 用户（空壳）
│   └── z.template.ts # 模板
├── common/           # 通用工具
│   ├── globUtils.ts  # 全局工具类（UUID、驼峰、数组解析等）
│   ├── validators.ts # 参数校验（分页、字段）
│   └── transElement.ts # 事务元素接口
├── middlewares/      # 中间件（12 个）
│   ├── session.ts    # JWT 鉴权
│   ├── globalError.ts# 全局错误
│   ├── cors.ts       # 跨域
│   ├── helmet.ts     # 安全头
│   ├── rateLimit.ts  # 内存限流
│   ├── bodyParser.ts # 请求体解析
│   └── ...
└── routers/          # 路由
    ├── index.ts      # 路由注册
    ├── router_rs.ts  # REST CRUD 核心路由
    └── router_op.ts  # 操作路由（登录）
```

---

## 二、已完成的优化（基于 optimization-plan.md）

以下问题在上一轮审查后已修复：

| 编号 | 问题 | 状态 |
|------|------|------|
| S1 | 登录接口未校验密码 → 引入 bcrypt | ✅ 已完成（注：router_op.ts 当前仍用 retrieve+password 匹配，未用 bcrypt） |
| S2 | 错误堆栈暴露 → 开发环境才返回 stack | ✅ 已完成 |
| S4 | 缺少请求速率限制 → 自实现内存限流 | ✅ 已完成 |
| S5 | 缺少安全头中间件 → koa-helmet | ✅ 已完成 |
| H1 | 鉴权逻辑漏洞 → 显式白名单 + Bearer 支持 | ✅ 已完成 |
| H3 | GraphQL 残留代码 | ✅ 已完成 |
| H4 | isLogin() 永远返回 true | ✅ 已完成 |
| H5 | 缺少输入参数验证 | ✅ 已完成 |
| M1-1 | 移除 bluebird | ✅ 已完成 |
| M1-2 | 替换 moment → dayjs（含日期格式化修复） | ✅ 已完成 |
| M2 | TypeScript 严格模式 | ✅ 已完成 |
| M4 | 连接池懒加载 | ✅ 已完成（mysqlDao 仍为顶层初始化，见下文） |
| M5 | 完善 log4js 配置 | ✅ 已完成 |
| M7 | 请求体大小限制 | ✅ 已完成 |
| L2 | Token 传输标准化 | ✅ 已完成 |
| L4 | 替换 require-dir | ⚠️ inits/index.ts 仍使用 require-dir |
| L6 | CORS 配置完善 | ✅ 已完成 |

---

## 三、现存问题清单

### 3.1 严重问题（🔴 安全）

#### S1-REV — 登录接口密码校验仍不安全

**文件**：`src/routers/router_op.ts:20`

```typescript
let rs = await new BaseDao('users').retrieve({ username, password })
```

当前登录将 `password` 作为查询条件发送到数据库做等值匹配，而非用 bcrypt 校验哈希。这意味着：
- 密码必须以明文存储在数据库中
- 无法抵御彩虹表攻击
- optimization-plan.md 中标注 S1 已完成（引入 bcrypt），但实际代码并未使用 bcrypt

**建议**：注册时用 `bcrypt.hash()` 存储哈希，登录时用 `bcrypt.compare()` 校验。

---

#### S3 — 敏感配置硬编码（未修复）

**文件**：`src/config/configs.ts`

数据库密码 `123456` 和 JWT 密钥直接写在源码中，未使用环境变量或 `.env` 文件。

**风险**：
- 配置误提交到版本控制
- 不同环境无法区分配置
- CI/CD 无法安全注入

---

### 3.2 高优先级问题（🟠 逻辑缺陷）

#### H2 — SQL 拼接边界风险（部分修复）

**文件**：`src/db/mysqlDao.ts:319-323`

```typescript
const escaped = (pool as any).escape(String(value))
const replaced = escaped.replace(/', '/g, `%' and ${String(key)} like '%`)
const v = replaced.substring(1, replaced.length - 1)
where += `${String(key)} like '%${String(v)}%'`
```

模糊搜索的 `like` 条件拼接方式存在潜在 SQL 注入风险：先 `escape` 再手动去引号再字符串拼接。SQLite3 和 PostgreSQL 实现已正确使用参数化查询，但 MySQL 实现仍使用字符串拼接。

**文件**：`src/db/mysqlDao.ts:365-371`

`sort` 和 `group` 参数通过 `pool.escape()` 处理后手动去引号再拼接，类似风险。

---

#### H6 — mysqlDao 连接池仍为顶层初始化

**文件**：`src/db/mysqlDao.ts:24-37`

```typescript
let options: PoolOptions = { ... }
let pool = createPool(options)
```

optimization-plan.md 标注 M4（连接池懒加载）已完成，但 mysqlDao.ts 仍在模块顶层立即创建连接池。而 postgresDao.ts 同样如此。仅 baseDao.ts 的 `initDao()` 实现了延迟加载。

**风险**：若模块在 `globInit()` 之前被 import，会因为 `config` 未就绪而崩溃。

---

#### H7 — 登录时密码明文传输到数据库

**文件**：`src/routers/router_op.ts:20`

```typescript
let rs = await new BaseDao('users').retrieve({ username, password })
```

将 `password` 作为查询条件意味着数据库中密码必须明文存储。即使网络传输使用 HTTPS，数据库层面的密码泄露风险极高。

---

### 3.3 中优先级问题（🟡 技术债）

#### M1-3 — TypeScript 版本过旧

当前 TypeScript 4.9.5，5.x 有大量类型系统改进（装饰器元数据、const 类型参数、枚举改进等）。

---

#### M3 — 全局 G 对象反模式

**文件**：`src/inits/global.ts:26-41`

`GlobVar` 被挂载到 `global.G`，任何模块均可读写全局状态。这是项目最大的架构耦合点：

- 无法进行隔离的单元测试
- 模块间存在隐式依赖
- sqlite3Dao.ts 中甚至通过 `(global as any).G?.tools?.arryParse` 访问

---

#### M8 — DAO 查询逻辑大量重复

`mysqlDao.ts`、`postgresDao.ts`、`sqlite3Dao.ts` 的 `query()` 方法包含大量重复的查询构建逻辑（where 条件、分页、聚合、排序）。仅差异点在于：
- 标识符引用方式（反引号 vs 双引号）
- 占位符（`?` vs `$N`）
- 分页语法（`LIMIT offset,size` vs `LIMIT size OFFSET offset`）
- 批量插入冲突处理（`ON DUPLICATE KEY UPDATE` vs `ON CONFLICT DO UPDATE`）

应抽象为共享的查询构建器 + 方言适配器。

---

#### M9 — inits/index.ts 仍使用 require-dir

**文件**：`src/inits/index.ts:3`

```typescript
let requireDir = require('require-dir')
```

optimization-plan.md 标注 L4 已完成，但此文件仍使用 CommonJS `require-dir`，存在类型丢失问题。

---

#### M10 — postgresDao 字段名大小写敏感

**文件**：`src/db/postgresDao.ts`

PostgreSQL 默认将未引用的标识符转为小写，但代码中通过 `quotePostgresIdentifier()` 强制加引号。这可能导致与直接在数据库中创建的表不兼容。

---

### 3.4 低优先级问题（🔵 工程规范）

#### L1 — 测试覆盖有限

当前仅有 `test/rs.api.test.ts` 一个集成测试文件，覆盖 REST CRUD 基本流程。缺少：
- 中间件单元测试（session、rateLimit、globalError）
- DAO 层单元测试
- 边界条件测试
- 并发测试
- 认证流程测试

---

#### L3 — UUID 仅取 8 位

**文件**：`src/common/globUtils.ts:30-32`

```typescript
uuid() {
    return randomUUID().split('-')[0]
}
```

仅取 UUID 的前 8 位十六进制字符（32 bit），碰撞概率 2^16（约 65536 次后 50% 碰撞概率）。在高并发或大数据量场景下存在风险。

---

#### L5 — ESLint 核心目录规则过于宽松

**文件**：`eslint.config.js:59-76`

对 `src/inits/`、`src/middlewares/`、`src/routers/` 等核心目录关闭了所有 `@typescript-eslint/no-unsafe-*` 规则。

---

#### L7 — 缺少 API 文档

没有 OpenAPI/Swagger 规范文件，API 接口仅通过 README.md 文档描述，不利于前端对接和自动化测试。

---

#### L8 — 错误处理不一致

- `baseDao.ts` 中 CRUD 方法 `catch` 后 `return err`，而非 `throw`
- `globalError.ts` 中间件捕获的是 `throw` 出的异常
- 这意味着 DAO 层的错误不会触发全局错误中间件，而是以"成功"响应返回

---

## 四、架构评价

### 优点

1. **REST CRUD 自动化**：通过动态路由 + 表名映射，无需为每张表写 CRUD 代码，开发效率高
2. **多数据库支持**：MySQL / SQLite3 / PostgreSQL / JSON 文件四种方言，覆盖主流场景
3. **智能查询体系**：支持等值、范围、模糊、IN、OR、聚合、分组、分页，前端灵活度高
4. **中间件可插拔**：中间件按名称动态加载，加载失败自动降级为 noop
5. **配置统一**：配置集中管理，CORS / 限流 / 数据库均可配置
6. **测试基础设施**：已有 Vitest 集成测试 + db_init 数据初始化机制
7. **DAO 扩展机制**：`src/dao/` 下可按表名创建自定义 DAO，覆盖默认行为

### 缺点

1. **全局状态耦合**：`G` 对象是项目的核心耦合点，几乎每个模块都依赖它
2. **查询逻辑重复**：四种 DAO 的查询构建逻辑大量重复，维护成本高
3. **安全未到位**：密码明文存储/校验、配置硬编码、SQL 拼接风险
4. **类型安全弱**：大量 `any`、`as any`，ESLint 对核心目录关闭严格规则
5. **错误处理混乱**：DAO 层 catch 返回错误而非抛出，与全局错误中间件脱节
6. **文档与代码不同步**：optimization-plan.md 标注部分已完成的优化实际未完成

---

## 五、代码质量指标

| 指标 | 状态 | 说明 |
|------|------|------|
| TypeScript 严格模式 | ✅ 已开启 | `strict: true`, `noImplicitAny: true`, `strictNullChecks: true` |
| ESLint | ⚠️ 部分宽松 | 核心目录关闭了 unsafe 规则 |
| 测试覆盖 | ⚠️ 基础 | 1 个集成测试文件，覆盖 CRUD + 查询 |
| 编译 | ✅ 通过 | `tsc` 可正常编译 |
| 依赖健康度 | ⚠️ 中等 | TypeScript 4.x，部分包版本偏旧 |
| 代码重复 | ❌ 高 | DAO 查询逻辑三重重复 |
| 安全 | ❌ 弱 | 明文密码、配置硬编码、SQL 拼接 |

---

## 六、与 AI Agent 化的差距分析

将本项目改造为 RESTful API 形式的 AI Agent，需要解决以下关键差距：

| 差距 | 当前状态 | 目标状态 |
|------|----------|----------|
| 请求-响应模式 | 同步阻塞 | 支持长耗时任务（流式/异步） |
| AI 模型接入 | 无 | 接入 LLM API（OpenAI/Claude/本地模型） |
| 对话管理 | 无 | 会话上下文、历史记录、多轮对话 |
| 工具调用 | 无 | Function Calling / Tool Use 框架 |
| 消息格式 | 自定义 JSON | SSE / WebSocket 流式输出 |
| 任务队列 | 无 | 异步任务管理、进度追踪 |
| 提示词管理 | 无 | System Prompt 模板、变量注入 |
| 权限控制 | JWT 基础鉴权 | Agent 级别的操作权限和资源访问控制 |
| 日志追踪 | 请求级日志 | Agent 调用链路追踪 |

---

## 七、评审结论

### 总体评级：⚠️ 可用但需加固

项目在 REST CRUD 快速开发方面设计合理、功能完整，多数据库支持是显著优势。但在安全性（明文密码、配置硬编码）、代码质量（全局状态、重复逻辑、类型安全）方面存在明显短板，需要在 AI Agent 化之前完成关键加固。

### 优先行动建议

1. **P0 — 修复登录密码校验**：引入 bcrypt，消除明文密码存储
2. **P0 — 配置外部化**：引入 dotenv，移除硬编码密钥
3. **P1 — MySQL 查询参数化**：修复模糊搜索和 sort/group 的 SQL 拼接
4. **P1 — 连接池懒加载**：统一所有 DAO 的连接池初始化方式
5. **P2 — DAO 查询逻辑重构**：抽取共享查询构建器
6. **P2 — 全局 G 对象解耦**：渐进式重构，新功能不再依赖 G

---

**评审人**：AI Code Review
**下次评审建议时间**：AI Agent 开发计划第一阶段完成后

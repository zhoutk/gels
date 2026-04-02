# Gels 项目优化计划

> 审查日期：2026-04-02
> 审查范围：全部源码、配置、依赖、文档
> 目标：先完成项目优化，为后续 AI Agent 功能扩展奠定坚实基础

---

## 一、问题清单总览

| 级别 | 数量 | 说明 |
|------|------|------|
| 🔴 严重（安全） | 5 | 直接影响生产安全 |
| 🟠 高（逻辑缺陷） | 5 | 功能不正确或行为不符预期 |
| 🟡 中（技术债） | 7 | 影响可维护性、稳定性 |
| 🔵 低（优化建议） | 6 | 提升代码质量与工程规范 |

---

## 二、严重问题（🔴 安全）

### S1 — 登录接口未校验密码

**文件**：`src/routers/router_op.ts:13-26`

```typescript
let rs = await new BaseDao('users').retrieve({ username: ctx.request.body.username })
if (rs.status === G.STCODES.SUCCESS) {
    let user = rs.data[0]
    let token = jwt.sign({ userid: user.id, username: user.username }, ...)
}
```

**风险**：任何人知道用户名即可获得合法 token，认证形同虚设。

**修复方案**：
```typescript
import { compare } from 'bcrypt'

let rs = await new BaseDao('users').retrieve({ username: ctx.request.body.username })
if (rs.status === G.STCODES.SUCCESS) {
    let user = rs.data[0]
    if (!user.password || !await compare(ctx.request.body.password, user.password)) {
        ctx.body = G.jsResponse(G.STCODES.PASSWORDERR, 'Password is wrong.')
        return
    }
    let token = jwt.sign({ userid: user.id, username: user.username }, ...)
}
```

**补充建议**：
- 用户注册/修改密码时使用 `bcrypt.hash(password, 10)` 存储哈希值
- 添加登录失败次数限制，防止暴力破解

---

### S2 — 错误堆栈暴露给客户端

**文件**：`src/middlewares/globalError.ts:6`、`src/routers/router_rs.ts:49`

```typescript
// globalError.ts
ctx.body = G.jsResponse(ctx.ErrCode || G.STCODES.EXCEPTIONERR, (err as Error).message, 
    { stack: (err as Error).stack })

// router_rs.ts
rs = G.jsResponse(G.STCODES.EXCEPTIONERR, (err as Error).message, 
    {stack: (err as Error).stack})
```

**风险**：攻击者可通过 stack trace 获取服务器内部结构、文件路径、依赖版本等敏感信息。

**修复方案**：
```typescript
const data = G.tools.isDev() ? { stack: (err as Error).stack } : {}
ctx.body = G.jsResponse(ctx.ErrCode || G.STCODES.EXCEPTIONERR, (err as Error).message, data)
```

**同时修复 router_rs.ts**：删除第49行的 `{stack: (err as Error).stack}`，改为统一抛出异常由 globalError 中间件处理。

---

### S3 — 敏感配置硬编码

**文件**：`src/config/configs.ts`

```typescript
db_pass: '123456',
jwt: { secret: 'zh-123456SFU>a4bh_$3#46d0e85W10aGMkE5xKQ', ... }
```

**风险**：
- 配置误提交到版本控制
- 开发者之间共享配置无安全传输方式
- CI/CD 流水线无法安全注入配置

**修复方案**：
```typescript
// src/config/configs.ts
import 'dotenv/config'

export default {
    db_pass: process.env.DB_PASS || '',
    jwt: {
        secret: process.env.JWT_SECRET || '',
        expires_max: Number(process.env.JWT_EXPIRES) || 36000
    },
    dbconfig: {
        db_host: process.env.DB_HOST || 'localhost',
        db_port: Number(process.env.DB_PORT) || 3306,
        ...
    }
}
```

**配套措施**：
- 创建 `.env.example` 模板文件纳入版本控制
- 添加 `dotenv` 依赖
- 文档说明环境变量配置方式

---

### S4 — 缺少请求速率限制

**风险**：
- 登录接口可被暴力破解
- API 可被恶意刷量
- DoS 攻击风险

**修复方案**：
```typescript
// src/middlewares/rateLimit.ts
import rateLimit from 'koa-ratelimit'

export default () => {
    return rateLimit({
        db: new Map(), // 生产环境建议使用 Redis
        duration: 60000, // 1分钟
        max: 100, // 每分钟最多100次请求
        id: (ctx) => ctx.ip,
        errorMessage: 'Too many requests, please try again later.',
        disableHeader: false
    })
}
```

**特殊配置**：
- 登录接口单独配置更严格的限制（如每分钟10次）
- 可考虑使用 `koa-ratelimit` 或 `rate-limiter-flexible`

---

### S5 — 缺少安全头中间件

**风险**：
- XSS 攻击
- 点击劫持
- MIME 类型嗅探

**修复方案**：
```typescript
// 安装 koa-helmet 或自行配置安全头
import helmet from 'koa-helmet'

// 在 app.ts 中间件列表头部添加 'helmet'
```

**关键安全头**：
- `X-Content-Type-Options: nosniff`
- `X-Frame-Options: DENY`
- `X-XSS-Protection: 1; mode=block`
- `Content-Security-Policy`（按业务需求配置）

---

## 三、高优先级问题（🟠 逻辑缺陷）

### H1 — 鉴权逻辑存在多处漏洞

**文件**：`src/middlewares/session.ts`

**问题分析**：

```typescript
// 第17-18行：token 无效时，GET 请求或非认证 URL 仍放行
if (ctx.method === 'GET' || !isAuth) {
    return await next()  // 携带无效 token 的请求也被放行！
}

// 第29-33行：无 token 时，GET 请求放行
if (ctx.method !== 'GET' && isAuth) {
    ctx.body = G.jsResponse(G.STCODES.JWTAUTHERR, 'Missing Auth Token.')
} else {
    await next()
}
```

**实际行为**：
1. GET `/rs/users` - 无 token → 放行（数据泄露风险）
2. GET `/rs/users` - 无效 token → 放行（更严重）
3. POST `/rs/users` - 无 token → 拒绝（正确）
4. POST `/op/login` - 无 token → 放行（正确，登录不需要）

**修复方案**：
```typescript
const PUBLIC_PATHS = ['/op/login', '/op/register'] // 显式白名单

export default () => {
    return async (ctx, next) => {
        const urlPath = ctx.url.split('?')[0]
        const isPublic = PUBLIC_PATHS.some(p => urlPath.startsWith(p))
        
        if (isPublic) {
            return await next()
        }
        
        const token = ctx.header['token'] || ctx.header['authorization']?.replace('Bearer ', '')
        
        if (!token) {
            ctx.body = G.jsResponse(G.STCODES.JWTAUTHERR, 'Missing Auth Token.')
            return
        }
        
        try {
            const decoded = jwt.verify(token, config.secret)
            ctx.session = decoded
            await next()
        } catch (err) {
            ctx.body = G.jsResponse(G.STCODES.JWTAUTHERR, 'Invalid or Expired Token.')
        }
    }
}
```

---

### H2 — SQL 拼接边界风险

**文件**：`src/db/mysqlDao.ts:344-358`

```typescript
// sort 处理
const sortText = toSqlPrimitiveString(sort)
const valueEscaped = pool.escape(sortText)
const sortStr = ` ORDER BY ${valueEscaped.substring(1, valueEscaped.length - 1)}`
```

**问题**：
- `pool.escape()` 会添加引号，代码手动去掉引号后拼接，可能存在绕过风险
- `group` 参数同样处理方式
- 第308行 `where` 拼接存在类似模式

**修复方案**：
```typescript
// 使用字段名白名单校验
const ALLOWED_SORT_FIELDS = ['id', 'created_at', 'updated_at', ...Object.keys(G.DataTables[table])]

function validateSortField(sort: string): string | null {
    const parts = sort.split(/\s+/)
    const field = parts[0]
    const direction = parts[1]?.toUpperCase()
    
    if (!ALLOWED_SORT_FIELDS.includes(field)) return null
    if (direction && !['ASC', 'DESC'].includes(direction)) return null
    
    return direction ? `${field} ${direction}` : field
}
```

---

### H3 — GraphQL 残留代码

**文件**：`src/common/globUtils.ts:4-21`

```typescript
getRequestedFieldsFromResolveInfo(table: string, info: unknown): string[] {
    const selections = (info && typeof info === 'object' && 'selectionSet' in (info as any)...) || []
    ...
}
```

**问题**：GraphQL 已移除，此方法无法被正确调用，属于死代码。

**修复**：直接删除此方法。

---

### H4 — isLogin() 永远返回 true

**文件**：`src/common/globUtils.ts:53-55`

```typescript
isLogin(): boolean {
    return true   // 未实现
}
```

**问题**：函数名暗示有鉴权逻辑，但实际是空实现，可能在某处被误用。

**修复**：删除此方法，或改为检查 `ctx.session` 是否存在。

---

### H5 — 缺少输入参数验证

**文件**：`src/routers/router_rs.ts`、`src/db/mysqlDao.ts`

**问题**：
- 用户输入直接传入数据库操作，无类型/格式验证
- `fields` 参数未限制合法字段名
- `page`、`size` 参数未限制范围

**风险**：
- 恶意参数导致异常查询
- 数据类型错误导致数据库错误

**修复方案**：
```typescript
// src/common/validators.ts
export function validatePagination(page: unknown, size: unknown): { page: number; size: number } {
    const p = Math.max(0, Math.min(1000, Number(page) || 0))
    const s = Math.max(1, Math.min(100, Number(size) || 10))
    return { page: p, size: s }
}

export function validateFields(fields: unknown, tableFields: string[]): string[] | null {
    const arr = G.tools.arryParse(fields)
    if (!arr) return null
    return arr.every(f => tableFields.includes(f)) ? arr : null
}
```

---

## 四、中优先级问题（🟡 技术债）

### M1 — 过时依赖

| 依赖 | 当前版本 | 最新版本 | 建议 |
|------|----------|----------|------|
| `moment` | 2.30.1 | — | 已停止维护，替换为 `dayjs` |
| `bluebird` | 3.7.2 | — | Node.js 原生 Promise 已足够，可移除 |
| `uuid` | 8.3.2 | 13.0.0 | 替换为 `crypto.randomUUID()` |
| `mysql2` | 2.3.3 | 3.20.0 | 跨大版本，需回归测试 |
| `koa` | 2.13.4 | — | 保持 2.x，3.x 变化较大 |
| `typescript` | 4.9.5 | 5.x | 错过大量类型系统改进 |

**执行优先级**：
1. 移除 `bluebird`（立即，低风险）
2. 替换 `moment` → `dayjs`（立即，需测试日期格式化）
3. 升级 `typescript` → 5.x（短期，需修复编译错误）
4. 升级 `mysql2` 2.x → 3.x（中期，需完整回归测试）

---

### M2 — TypeScript 配置过于宽松

**文件**：`tsconfig.json`

```json
{
    "strict": true,
    "noImplicitAny": false,     // 与 strict 矛盾
    "strictNullChecks": false   // 关闭后 null/undefined 错误无法捕获
}
```

**修复方案**：分阶段开启严格模式
1. 先开启 `noImplicitAny`，修复编译错误
2. 再开启 `strictNullChecks`，处理 null/undefined
3. 最终删除覆盖项，保持 `strict: true` 唯一配置

---

### M3 — 全局 G 对象反模式

**文件**：`src/inits/global.ts`、全局引用

**问题**：
- 任何模块均可修改全局状态
- 无法进行单元测试（需 mock 整个 G）
- 模块间耦合度极高
- 连接池初始化依赖隐式时序

**优化方向**：
```typescript
// 逐步解耦方案
// 1. 配置独立导出
export const config = CONFIGS

// 2. 日志独立导出
export const logger = getLogger('default')

// 3. 工具函数独立导出
export const tools = new GlobUtils()

// 4. 新模块通过参数接收依赖
import { logger, config } from '../inits/global'

class MysqlDao {
    constructor(private logger: Logger, private config: DbConfig) {}
}
```

---

### M4 — 连接池初始化时序依赖

**文件**：`src/db/mysqlDao.ts:21-34`

```typescript
// 模块顶层立即初始化，要求 G.CONFIGS 此时已就绪
let options: PoolOptions = {
    'host': G.CONFIGS.dbconfig.db_host, // 若 G 未初始化会崩溃
    ...
}
let pool = createPool(options)
```

**问题**：若 `mysqlDao` 在 `globInit()` 之前被 import，会崩溃。

**修复方案**：
```typescript
// 改为懒加载
let pool: Pool | null = null

function getPool(): Pool {
    if (!pool) {
        pool = createPool({
            host: G.CONFIGS.dbconfig.db_host,
            ...
        })
    }
    return pool
}
```

---

### M5 — 日志配置过于简单

**文件**：`src/config/log4js.ts`

```typescript
appenders: { console: { type: 'console' } },
categories: { default: { appenders: ['console'], level: 'debug' } }
```

**问题**：
- 生产环境无文件日志
- 无日志分级输出
- 无日志轮转

**修复方案**：
```typescript
export default {
    appenders: {
        console: { type: 'console' },
        file: {
            type: 'dateFile',
            filename: 'logs/app.log',
            pattern: '.yyyy-MM-dd',
            alwaysIncludePattern: true,
            maxLogSize: 10485760, // 10MB
            backups: 30
        },
        errorFile: {
            type: 'dateFile',
            filename: 'logs/error.log',
            pattern: '.yyyy-MM-dd',
            level: 'error'
        }
    },
    categories: {
        default: { 
            appenders: G.tools.isDev() ? ['console'] : ['file', 'console'], 
            level: G.tools.isDev() ? 'debug' : 'info' 
        },
        error: { appenders: ['errorFile'], level: 'error' }
    }
}
```

---

### M6 — moment 日期格式化错误

**文件**：`src/db/baseDao.ts:174`

```typescript
(element as any)[key] = moment(value as any).format('YYYY-MM-DD hh:mm:ss')
```

**问题**：`hh` 是12小时制，应使用 `HH`（24小时制）。

**修复**：
```typescript
// 替换 moment 为 dayjs
import dayjs from 'dayjs'
(element as any)[key] = dayjs(value as any).format('YYYY-MM-DD HH:mm:ss')
```

---

### M7 — 缺少请求体大小限制

**文件**：`src/middlewares/bodyParser.ts`

**问题**：koa-body 默认配置可能允许过大的请求体。

**修复方案**：
```typescript
import { koaBody } from 'koa-body'

export default () => {
    return koaBody({
        jsonLimit: '1mb',
        formLimit: '1mb',
        textLimit: '1mb',
        multipart: true,
        formidable: {
            maxFileSize: 10 * 1024 * 1024 // 10MB
        }
    })
}
```

---

## 五、低优先级（🔵 工程规范）

### L1 — 缺少自动化测试

**现状**：`package.json` test 脚本为空，无任何测试。

**建议**：
```typescript
// 引入 vitest
// tests/dao.test.ts
import { describe, it, expect } from 'vitest'
import BaseDao from '../src/db/baseDao'

describe('BaseDao', () => {
    it('should query users', async () => {
        const dao = new BaseDao('users')
        const rs = await dao.retrieve({ username: 'test' })
        expect(rs.status).toBe(200)
    })
})
```

**覆盖优先级**：
1. DAO 层核心方法
2. session 中间件鉴权逻辑
3. globUtils 工具函数

---

### L2 — Token 传输不符合标准

**文件**：`src/middlewares/session.ts:8`

```typescript
const token = ctx.header['token']   // 非标准
```

**建议**：同时支持标准 `Authorization: Bearer <token>` 和现有 `token` header，逐步迁移。

```typescript
const token = ctx.header['authorization']?.replace('Bearer ', '') || ctx.header['token']
```

---

### L3 — uuid 实现不完整

**文件**：`src/common/globUtils.ts:47-48`

```typescript
uuid(): string {
    return crypto.randomUUID().split('-')[0]  // 仅取8位
}
```

**问题**：仅8个十六进制字符，碰撞概率高。

**修复**：
```typescript
uuid(): string {
    return crypto.randomUUID() // 使用完整UUID（36位）
}
```

---

### L4 — require-dir 带来类型问题

**文件**：`src/inits/index.ts`、`src/routers/index.ts`

**问题**：`require-dir` 是 CommonJS 工具，TS 项目中存在类型丢失。

**修复**：
```typescript
// 使用 fs.readdirSync + 显式 import
import { readdirSync } from 'fs'
import { join } from 'path'

async function loadModules(dir: string) {
    const files = readdirSync(dir)
        .filter(f => f.endsWith('.ts') && f !== 'index.ts')
    
    const modules = await Promise.all(
        files.map(f => import(join(dir, f)))
    )
    return modules
}
```

---

### L5 — ESLint 规则过度宽松

**文件**：`eslint.config.js:59-76`

**问题**：对核心目录关闭了 `@typescript-eslint/no-unsafe-*` 系列规则。

**建议**：随严格模式推进逐步收紧，将 `off` 改为 `warn`，最终改为 `error`。

---

### L6 — CORS 配置可能过于宽松

**文件**：`src/middlewares/cors.ts`

**建议**：检查 `koa2-cors` 配置，生产环境应限制允许的 origin。

```typescript
export default () => {
    return cors({
        origin: G.tools.isDev() ? '*' : ['https://your-domain.com'],
        allowMethods: ['GET', 'POST', 'PUT', 'DELETE'],
        allowHeaders: ['Content-Type', 'Authorization', 'token'],
        credentials: true
    })
}
```

---

## 六、优化执行计划

### 阶段一：安全加固（2-3天）⭐ 最高优先级

- [ ] S1：修复登录密码校验，引入 bcrypt
- [ ] S2：生产环境隐藏 stack trace（globalError + router_rs）
- [ ] S3：引入环境变量配置，创建 `.env.example`
- [ ] S4：添加请求速率限制中间件
- [ ] S5：添加安全头中间件（helmet）
- [ ] H1：重构 session 鉴权逻辑，显式白名单

### 阶段二：逻辑修复（2-3天）

- [ ] H2：SQL 参数白名单校验
- [ ] H3：删除 GraphQL 残留代码
- [ ] H4：删除或实现 `isLogin()`
- [ ] H5：添加输入参数验证器
- [ ] L2：支持标准 Authorization header
- [ ] L3：修复 uuid 使用完整 UUID

### 阶段三：技术债清理（1周）

- [ ] M1-1：移除 bluebird，使用原生 Promise
- [ ] M1-2：替换 moment → dayjs（含 M6 修复）
- [ ] M1-3：升级 TypeScript 5.x
- [ ] M2：开启 TypeScript 严格模式
- [ ] M4：连接池懒加载初始化
- [ ] M5：完善 log4js 配置
- [ ] M7：添加请求体大小限制
- [ ] L4：替换 require-dir

### 阶段四：工程规范（持续）

- [ ] L1：引入 vitest 测试框架
- [ ] M3：逐步解耦全局 G 对象（长期）
- [ ] L5：收紧 ESLint 规则
- [ ] L6：完善 CORS 配置
- [ ] 升级 mysql2 3.x（需完整回归测试）
- [ ] 完善 API 文档（OpenAPI/Swagger）

---

## 七、为 AI Agent 功能扩展预留的架构建议

在完成上述优化后，为后续 AI Agent 功能扩展，建议考虑以下架构调整：

### 7.1 服务层抽象

```typescript
// src/services/BaseService.ts
export abstract class BaseService {
    protected dao: BaseDao
    protected logger: Logger
    
    constructor(table: string) {
        this.dao = new BaseDao(table)
        this.logger = getLogger('service')
    }
    
    abstract process(context: ServiceContext): Promise<ServiceResult>
}

// 为 AI Agent 提供统一的服务接口
export interface AgentCapable {
    executeAgentTask(task: AgentTask): Promise<AgentResult>
}
```

### 7.2 消息队列准备

```typescript
// 为 AI Agent 异步任务预留
// src/queue/TaskQueue.ts
export interface TaskQueue {
    enqueue(task: QueueTask): Promise<void>
    dequeue(): Promise<QueueTask>
    subscribe(handler: TaskHandler): void
}
```

### 7.3 事件驱动架构

```typescript
// src/events/EventBus.ts
export class EventBus {
    private listeners: Map<string, EventHandler[]> = new Map()
    
    emit(event: string, data: unknown): void
    on(event: string, handler: EventHandler): void
    off(event: string, handler: EventHandler): void
}
```

### 7.4 AI Agent 接口预留

```typescript
// src/agents/types.ts
export interface AgentTask {
    id: string
    type: 'chat' | 'analyze' | 'execute' | 'query'
    input: unknown
    context: AgentContext
}

export interface AgentResult {
    id: string
    status: 'success' | 'failed' | 'pending'
    output: unknown
    metadata?: Record<string, unknown>
}
```

---

## 八、依赖升级优先级

| 优先 | 依赖 | 原因 | 风险 |
|------|------|------|------|
| 立即 | 移除 `bluebird` | 原生 Promise 已足够 | 低 |
| 立即 | `moment` → `dayjs` | 已停止维护 | 中（需测试日期格式化） |
| 立即 | 添加 `dotenv` | 安全配置需要 | 低 |
| 立即 | 添加 `bcrypt` | 密码哈希需要 | 低 |
| 立即 | 添加 `koa-ratelimit` | 安全需要 | 低 |
| 立即 | 添加 `koa-helmet` | 安全需要 | 低 |
| 短期 | `typescript` 4.x → 5.x | 类型系统改进 | 中（需修复编译错误） |
| 中期 | `mysql2` 2.x → 3.x | 安全修复和性能改进 | 高（需回归测试） |
| 评估 | `jsonwebtoken` 8.x → 9.x | API 略有变化 | 中 |

---

## 九、验收标准

### 安全验收

- [ ] 登录必须验证密码
- [ ] 生产环境不返回 stack trace
- [ ] 敏感配置不在代码中硬编码
- [ ] API 有速率限制
- [ ] 安全头正确设置

### 功能验收

- [ ] JWT 鉴权逻辑正确
- [ ] SQL 参数化或白名单校验
- [ ] 无死代码残留

### 工程验收

- [ ] TypeScript 编译无错误
- [ ] ESLint 检查通过（无 error）
- [ ] 核心功能有测试覆盖
- [ ] 文档更新完整

---

## 十、风险提示

1. **mysql2 升级**：跨大版本，需完整的数据库操作回归测试
2. **TypeScript 严格模式**：可能暴露大量潜在问题，需逐步开启
3. **全局 G 解耦**：影响面大，建议在新功能中先行尝试
4. **鉴权逻辑重构**：需确保现有客户端兼容（同时支持新旧 header）

---

**审查人**：AI Code Review
**下次审查建议时间**：阶段一完成后
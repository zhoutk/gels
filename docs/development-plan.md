# Gels AI Agent 开发计划

> 编制日期：2026-04-10（v3.0 更新）
> 基于项目评审报告（docs/review-report.md）及源码实际状态复核
> 目标：将 gels 框架升级为 RESTful API 形式的 AI Agent 服务平台
> 
> **核心定位**：作为 AI Agent 后端服务，为 `refer/` 目录下的客户端/SDK 项目（如 SDK、桌面应用等）提供 LLM 交互能力。这些项目不再自己管理 Agent，而是通过 RESTful API 与 gels 通信，获取 LLM 返回的结果。

---

## 〇、项目现状评估（2026-04-10 复核）

### 代码规模

| 维度 | 数据 |
|------|------|
| 源码文件 | ~20 个 TS 文件，~3000 行 |
| 中间件 | 12 个 |
| 路由 | 2 个（router_rs + router_op） |
| DAO 实现 | 4 种方言（MySQL / SQLite3 / PostgreSQL / JSON File） |
| 测试 | 1 个集成测试文件（Vitest + Supertest） |
| 文档 | 5 个（project-design / function-doc / optimization-plan / review-report / development-plan） |

### 已完成优化（对照源码验证）

| 编号 | 问题 | 标注状态 | 实际状态 |
|------|------|----------|----------|
| S2 | 错误堆栈暴露 | ✅ 已完成 | ✅ `globalError.ts:8` 仅 dev 模式返回 stack |
| S4 | 请求速率限制 | ✅ 已完成 | ✅ `rateLimit.ts` 自实现内存限流 |
| S5 | 安全头中间件 | ✅ 已完成 | ✅ `helmet.ts` 已集成 koa-helmet |
| H1 | 鉴权逻辑漏洞 | ✅ 已完成 | ✅ `session.ts` 显式白名单 + Bearer 支持 |
| H3 | GraphQL 残留 | ✅ 已完成 | ✅ `globUtils.ts` 已清理 |
| H4 | isLogin() 空实现 | ✅ 已完成 | ✅ 已删除 |
| H5 | 输入参数验证 | ✅ 已完成 | ✅ `validators.ts` 分页/字段校验 |
| L2 | Token 传输标准化 | ✅ 已完成 | ✅ `session.ts:19` 同时支持 Bearer 和 token header |
| M1-1 | 移除 bluebird | ✅ 已完成 | ✅ package.json 无 bluebird |
| M1-2 | 替换 moment | ✅ 已完成 | ✅ 使用 dayjs |
| M2 | TypeScript 严格模式 | ✅ 已完成 | ✅ tsconfig.json strict + noImplicitAny |
| M5 | log4js 配置 | ✅ 已完成 | ✅ 生产环境文件+控制台双输出 |
| M7 | 请求体大小限制 | ✅ 已完成 | ✅ bodyParser.ts JSON 1MB、文件 10MB |
| L6 | CORS 配置 | ✅ 已完成 | ✅ 可配置 origins、支持 credentials |

### 未完成问题（对照源码验证）

| 编号 | 问题 | 严重度 | 验证依据 |
|------|------|--------|----------|
| S1-REV | 登录仍用明文密码校验 | 🔴 P0 | `router_op.ts:20` `retrieve({ username, password })` |
| S3 | 敏感配置硬编码 | 🔴 P0 | `configs.ts:6,36,90` 密码/JWT secret 写在源码 |
| H2 | MySQL SQL 拼接风险 | 🟠 P1 | `mysqlDao.ts` like/sort/group 仍用字符串拼接 |
| H6 | MySQL 连接池顶层初始化 | 🟠 P1 | `mysqlDao.ts:24-37` 模块顶层立即 `createPool` |
| H7 | 密码明文传到数据库 | 🟠 P1 | `router_op.ts:20` password 作为查询条件 |
| M1-3 | TypeScript 升级 | ✅ 已升级 | `package.json` typescript ^6.0.2 |
| M3 | 全局 G 对象耦合 | 🟡 P2 | `global.ts` 仍挂载 `global.G`，多处依赖 |
| M8 | DAO 查询逻辑重复 | 🟡 P2 | 4 个 DAO 实现 ~2300 行重复查询构建 |
| M9 | require-dir 未替换 | 🟡 P2 | `inits/index.ts:3` 仍使用 require-dir |
| L1 | 测试覆盖有限 | 🔵 P3 | 仅 1 个 REST 集成测试文件 |
| L3 | UUID 仅取 8 位 | 🔵 P3 | `globUtils.ts:31` `randomUUID().split('-')[0]` |
| L5 | ESLint 核心目录规则宽松 | 🔵 P3 | `eslint.config.js` 对核心目录关闭 unsafe 规则 |
| L7 | 缺少 API 文档 | 🔵 P3 | 无 OpenAPI/Swagger 规范 |
| L8 | 错误处理不一致 | 🔵 P3 | baseDao catch 返回错误而非 throw |

---

## 一、愿景与目标

### 愿景

在现有 REST 微服务框架基础上，构建一个轻量级 AI Agent **后端服务平台**。通过标准 RESTful API 为 `refer/` 目录下的客户端项目（如 SDK、桌面应用、Web 前端等）提供 LLM 交互能力。客户端项目不再自己管理 Agent 逻辑，而是通过 API 将用户输入提交给 gels，由 gels 负责与 LLM 通信、工具调用、多轮对话管理，并返回结构化结果。

### 核心目标

1. **AI Agent 服务化**：Agent 作为后端服务抽象，通过 API 对外暴露
2. **RESTful API 原生支持**：所有 Agent 能力通过 RESTful API 暴露，兼容现有接口
3. **工具调用框架**：Agent 可调用预定义工具（数据库查询、HTTP 请求、代码执行等）
4. **多轮对话支持**：会话级上下文管理，支持连续交互
5. **流式输出**：SSE 支持长文本生成场景
6. **可扩展架构**：支持自定义 Agent、自定义工具、自定义提示词模板
7. **SDK 友好**：提供清晰的 API 契约，便于 refer/ 下各类项目集成

---

## 二、前置条件（Phase 0）

### 2.1 安全加固（可与 Phase 1 并行进行）

在开始 AI Agent 开发之前，**建议**完成以下加固工作。这些是评审报告中标识的、经源码验证确认仍未修复的问题。

> **注意**：如果希望快速启动 AI 功能，可以先进行 Phase 1，将安全加固作为独立任务后续迭代。

| 任务 | 说明 | 优先级 | 当前状态 |
|------|------|--------|----------|
| 修复登录密码校验（S1-REV/H7） | 注册用 `bcrypt.hash()`，登录用 `bcrypt.compare()`，不再将 password 传入 retrieve | P0 | ❌ 未修复 |
| 配置外部化（S3） | 引入 dotenv，敏感配置从环境变量读取，创建 `.env.example` | P0 | ❌ 未修复 |
| MySQL 查询参数化（H2） | 修复模糊搜索和 sort/group 的 SQL 拼接，使用参数化查询 | P1 | ❌ 未修复 |
| 统一连接池初始化（H6） | mysqlDao/postgresDao 改为懒加载连接池 | P1 | ❌ 未修复 |

**S1-REF 修复方案**（详细）：

```typescript
// src/routers/router_op.ts - 登录逻辑
import { compare } from 'bcryptjs'

case 'login': {
    const { username, password } = ctx.request.body || {}
    if (!username || !password) {
        ctx.body = jsResponse(STCODES.PARAMERR, 'username or password is missing.')
        break
    }
    let rs = await new BaseDao('users').retrieve({ username })
    if (rs.status === STCODES.SUCCESS && rs.data?.length > 0) {
        let user = rs.data[0]
        if (await compare(password, user.password)) {
            let token = jwt.sign({ userid: user.id, username }, config.jwt.secret, {
                expiresIn: config.jwt.expires_max,
            })
            ctx.body = jsResponse(STCODES.SUCCESS, 'login success.', { token })
        } else {
            ctx.body = jsResponse(STCODES.PASSWORDERR, 'Password is wrong.')
        }
    } else {
        ctx.body = jsResponse(STCODES.QUERYEMPTY, 'The user is missing.')
    }
    break
}

// 注册接口（新增）
case 'register': {
    const { username, password } = ctx.request.body || {}
    if (!username || !password) {
        ctx.body = jsResponse(STCODES.PARAMERR, 'username or password is missing.')
        break
    }
    const hash = await hash(password, 10)
    let rs = await new BaseDao('users').create({ username, password: hash })
    ctx.body = rs
    break
}
```

### 2.2 架构准备（可与 Phase 1 并行进行）

| 任务 | 说明 | 优先级 | 当前状态 |
|------|------|--------|----------|
| 移除 require-dir（M9） | `inits/index.ts` 改为 `fs.readdirSync` + 动态 import | P2 | ❌ 未修复 |
| 统一错误处理（L8） | DAO 层 catch 改为 throw，统一由 globalError 处理 | P2 | ❌ 未修复 |
| 修复 UUID（L3） | `globUtils.ts` 改为返回完整 UUID | P2 | ❌ 未修复 |
| 新模块不再依赖 G | 新增代码通过 `import` 获取 config/logger/tools | P2 | 准则约定 |

---

## 三、总体架构设计

### 3.1 分层架构

```
┌─────────────────────────────────────────────────────────┐
│                     API Layer (Koa)                      │
│  /rs/*    /op/*    /api/agent/*    /api/chat/*           │
├─────────────────────────────────────────────────────────┤
│                   Agent Controller                       │
│  请求路由 → 会话管理 → Agent 调度 → 响应格式化            │
├─────────────────────────────────────────────────────────┤
│                   Agent Core                             │
│  ┌──────────┐  ┌──────────┐  ┌──────────────┐          │
│  │ Agent    │  │ Tool     │  │ Prompt       │          │
│  │ Registry │  │ Registry │  │ Manager      │          │
│  └──────────┘  └──────────┘  └──────────────┘          │
│  ┌──────────┐  ┌──────────┐  ┌──────────────┐          │
│  │ LLM      │  │ Session  │  │ Event        │          │
│  │ Provider │  │ Manager  │  │ Emitter      │          │
│  └──────────┘  └──────────┘  └──────────────┘          │
├─────────────────────────────────────────────────────────┤
│                   Infrastructure                         │
│  ┌──────────┐  ┌──────────┐  ┌──────────────┐          │
│  │ DAO      │  │ Task     │  │ Config       │          │
│  │ Layer    │  │ Queue    │  │ Manager      │          │
│  └──────────┘  └──────────┘  └──────────────┘          │
└─────────────────────────────────────────────────────────┘
```

### 3.2 SDK 客户端集成架构

```
┌────────────────────────────────────────────────────────────────────────┐
│                          refer/ (客户端 SDK 项目)                        │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐               │
│  │  SDK 项目 A   │  │  SDK 项目 B   │  │  桌面应用 C    │               │
│  │ (AI Chat UI)  │  │ (数据分析)    │  │ (Tauri App)  │               │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘               │
└─────────┼─────────────────┼─────────────────┼────────────────────────┘
          │                 │                 │
          │  HTTP REST      │  HTTP REST      │  HTTP REST
          │  (JSON/SSE)     │  (JSON/SSE)      │  (JSON/SSE)
          ▼                 ▼                 ▼
┌────────────────────────────────────────────────────────────────────────┐
│                         gels (AI Agent 服务平台)                          │
│  ┌──────────────────────────────────────────────────────────────────┐  │
│  │                      RESTful API Layer                           │  │
│  │     /api/agent/*          /api/chat/*          /api/tools/*     │  │
│  └──────────────────────────────────────────────────────────────────┘  │
│  ┌──────────────────────────────────────────────────────────────────┐  │
│  │                      AI Agent Core                               │  │
│  │  ┌─────────┐   ┌─────────┐   ┌─────────┐   ┌─────────┐         │  │
│  │  │ Session │   │  LLM    │   │  Tool   │   │ Prompt  │         │  │
│  │  │ Manager │   │Provider │   │ Registry│   │ Manager │         │  │
│  │  └────┬────┘   └────┬────┘   └────┬────┘   └─────────┘         │  │
│  └───────┼─────────────┼─────────────┼──────────────────────────────┘  │
│          │             │             │                                    │
│          └─────────────┴─────────────┘                                    │
│                              │                                              │
│                              ▼                                              │
│  ┌──────────────────────────────────────────────────────────────────┐      │
│  │              LLM Provider (OpenAI / Claude / Ollama)              │      │
│  └──────────────────────────────────────────────────────────────────┘      │
└────────────────────────────────────────────────────────────────────────┘
```

### 3.3 目录结构扩展

```
src/
├── agent/                    # AI Agent 核心
│   ├── core/
│   │   ├── agent.ts          # Agent 基类
│   │   ├── registry.ts       # Agent 注册中心
│   │   └── executor.ts       # Agent 执行器
│   ├── llm/
│   │   ├── provider.ts       # LLM Provider 接口
│   │   ├── openai.ts         # OpenAI 实现
│   │   ├── claude.ts         # Claude 实现
│   │   └── local.ts          # 本地模型实现（Ollama 等）
│   ├── tools/
│   │   ├── tool.ts           # Tool 基类与接口
│   │   ├── registry.ts       # Tool 注册中心
│   │   ├── db_query.ts       # 数据库查询工具
│   │   ├── http_request.ts   # HTTP 请求工具
│   │   └── code_exec.ts      # 代码执行工具（沙箱）
│   ├── prompt/
│   │   ├── manager.ts        # 提示词管理器
│   │   └── templates/        # 提示词模板
│   │       ├── system.md     # 系统提示词
│   │       └── tools.md      # 工具描述模板
│   └── session/
│       ├── manager.ts        # 会话管理器
│       └── store.ts          # 会话存储（DAO 实现）
├── routers/
│   ├── router_agent.ts       # Agent API 路由
│   └── router_chat.ts        # Chat API 路由（SSE）
├── dao/
│   ├── agent_session.ts      # 会话 DAO
│   ├── agent_message.ts      # 消息 DAO
│   └── agent_task.ts         # 任务 DAO
└── ...
```

---

## 四、核心接口设计

### 4.1 Agent API

```
# 创建会话
POST   /api/agent/sessions
Body:  { agent_id: string, metadata?: object }
Resp:  { session_id: string, agent_id: string, created_at: string }

# 发送消息（同步）
POST   /api/agent/sessions/:id/messages
Body:  { content: string, stream?: false }
Resp:  { message_id: string, role: "assistant", content: string, tool_calls?: ToolCall[] }

# 发送消息（SSE 流式）
POST   /api/agent/sessions/:id/messages
Body:  { content: string, stream: true }
Resp:  SSE event stream:
       event: token
       data: { content: "..." }
       event: tool_call
       data: { id: "...", name: "...", arguments: {...} }
       event: tool_result
       data: { id: "...", result: {...} }
       event: done
       data: { message_id: "..." }

# 获取会话历史
GET    /api/agent/sessions/:id/messages
Query: ?page=1&size=20
Resp:  { data: Message[], pages: number, records: number }

# 列出可用 Agent
GET    /api/agent/agents
Resp:  { data: AgentInfo[] }

# 列出可用工具
GET    /api/agent/tools
Resp:  { data: ToolInfo[] }

# 获取会话详情
GET    /api/agent/sessions/:id
Resp:  { session_id, agent_id, metadata, created_at, updated_at }

# 删除会话
DELETE /api/agent/sessions/:id
Resp:  { affectedRows: number }
```

### 4.2 Chat API（简化版，面向前端聊天场景）

```
# 简化聊天接口（自动创建/复用会话）
POST   /api/chat
Body:  { message: string, session_id?: string, agent_id?: string, stream?: boolean }
Resp:  同 Agent API 或 SSE 流
```

### 4.3 核心类型定义

```typescript
// src/agent/core/types.ts

interface AgentConfig {
  id: string
  name: string
  description: string
  model: string
  system_prompt: string
  tools: string[]
  max_turns: number
  temperature: number
}

interface Message {
  id: string
  session_id: string
  role: 'system' | 'user' | 'assistant' | 'tool'
  content: string
  tool_calls?: ToolCall[]
  tool_call_id?: string
  metadata?: Record<string, unknown>
  created_at: string
}

interface ToolCall {
  id: string
  name: string
  arguments: Record<string, unknown>
}

interface ToolResult {
  tool_call_id: string
  result: unknown
  error?: string
}

interface AgentSession {
  id: string
  agent_id: string
  user_id: string
  metadata: Record<string, unknown>
  created_at: string
  updated_at: string
}

interface LLMResponse {
  content: string
  tool_calls?: ToolCall[]
  usage: { prompt_tokens: number; completion_tokens: number; total_tokens: number }
  finish_reason: 'stop' | 'tool_calls' | 'length'
}

interface SSEEvent {
  event: 'token' | 'tool_call' | 'tool_result' | 'done' | 'error'
  data: Record<string, unknown>
}
```

---

## 五、核心模块设计

### 5.1 LLM Provider

```typescript
// src/agent/llm/provider.ts

interface ILLMProvider {
  chat(messages: Message[], options: LLMOptions): Promise<LLMResponse>
  chatStream(messages: Message[], options: LLMOptions): AsyncIterable<SSEEvent>
  getToolSchema(tools: ToolDef[]): object
}

interface LLMOptions {
  model: string
  temperature?: number
  max_tokens?: number
  tools?: ToolDef[]
}

// ToolDef 遵循 OpenAI Function Calling 格式
interface ToolDef {
  type: 'function'
  function: {
    name: string
    description: string
    parameters: object
  }
}
```

实现优先级：
1. OpenAI（含 Azure OpenAI）
2. Claude（Anthropic）
3. 本地模型（Ollama / vLLM）

### 5.2 Tool 框架

```typescript
// src/agent/tools/tool.ts

interface ITool {
  name: string
  description: string
  parameters: object           // JSON Schema
  execute(args: Record<string, unknown>, context: ToolContext): Promise<ToolResult>
}

interface ToolContext {
  session_id: string
  user_id: string
  dao: BaseDao
  logger: Logger
}
```

**内置工具清单**：

| 工具 | 功能 | 参数 |
|------|------|------|
| db_query | 查询数据库表 | table, params, fields |
| db_insert | 插入记录 | table, data |
| db_update | 更新记录 | table, data, id |
| db_delete | 删除记录 | table, id |
| http_get | HTTP GET 请求 | url, headers, params |
| http_post | HTTP POST 请求 | url, headers, body |
| sql_query | 执行自定义 SQL（受限） | sql, values |
| code_eval | 执行代码片段（沙箱） | language, code |
| file_read | 读取文件 | path |
| file_write | 写入文件 | path, content |

### 5.3 Agent 执行器

```typescript
// src/agent/core/executor.ts

class AgentExecutor {
  private agent: AgentConfig
  private provider: ILLMProvider
  private toolRegistry: ToolRegistry
  private sessionStore: SessionStore
  private maxTurns: number

  async run(sessionId: string, userMessage: string, stream?: boolean): Promise<AsyncIterable<SSEEvent> | Message>

  // Agent 执行循环：
  // 1. 构建消息历史（system + 历史 + 用户消息）
  // 2. 调用 LLM
  // 3. 若返回 tool_calls → 执行工具 → 将结果加入消息 → 回到步骤 2
  // 4. 若返回 stop → 返回最终消息
  // 5. 超过 maxTurns → 返回截断消息
}
```

### 5.4 会话管理

```typescript
// src/agent/session/manager.ts

class SessionManager {
  async create(agentId: string, userId: string, metadata?: object): Promise<AgentSession>
  async get(sessionId: string): Promise<AgentSession | null>
  async getMessages(sessionId: string, page?: number, size?: number): Promise<Message[]>
  async addMessage(message: Message): Promise<void>
  async delete(sessionId: string): Promise<void>
  async cleanup(maxAge: number): Promise<number>
}
```

会话存储基于现有 DAO 层，新增以下数据库表：

```sql
CREATE TABLE agent_sessions (
  id VARCHAR(36) PRIMARY KEY,
  agent_id VARCHAR(64) NOT NULL,
  user_id VARCHAR(36),
  metadata JSON,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE agent_messages (
  id VARCHAR(36) PRIMARY KEY,
  session_id VARCHAR(36) NOT NULL,
  role VARCHAR(16) NOT NULL,
  content TEXT,
  tool_calls JSON,
  tool_call_id VARCHAR(64),
  metadata JSON,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (session_id) REFERENCES agent_sessions(id) ON DELETE CASCADE
);

CREATE TABLE agent_tasks (
  id VARCHAR(36) PRIMARY KEY,
  session_id VARCHAR(36) NOT NULL,
  status VARCHAR(16) NOT NULL DEFAULT 'pending',
  agent_id VARCHAR(64),
  input JSON,
  output JSON,
  error TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

### 5.5 SSE 中间件

```typescript
// src/middlewares/sse.ts

class SSEMiddleware {
  // 处理 SSE 连接
  // 设置 Content-Type: text/event-stream
  // 管理 Keep-Alive 心跳
  // 处理客户端断连
}
```

---

## 六、依赖新增

| 包名 | 用途 | 版本建议 |
|------|------|----------|
| `openai` | OpenAI API SDK | ^4.x |
| `@anthropic-ai/sdk` | Claude API SDK | ^0.x |
| `dotenv` | 环境变量管理 | ^16.x |
| `zod` | 运行时类型校验（Tool 参数） | ^3.x |
| `eventsource` | SSE 客户端（测试用） | ^3.x |

可选：
| 包名 | 用途 |
|------|------|
| `ioredis` | 生产级会话存储、限流 |
| `bullmq` | 任务队列（异步 Agent） |
| `vm2` 或 `isolated-vm` | 代码沙箱执行 |

---

## 七、开发阶段规划

### Phase 0：前置加固（3-5 天）

**目标**：修复安全漏洞 + 架构基础准备

| 任务 | 天数 | 交付物 | 状态 |
|------|------|--------|------|
| S1-REV：修复登录密码校验，引入 bcrypt | 0.5 | `router_op.ts` 使用 bcrypt.compare | ❌ |
| S3：配置外部化，引入 dotenv | 0.5 | `.env.example` + configs.ts 读取环境变量 | ❌ |
| 新增注册接口（使用 bcrypt.hash） | 0.5 | `router_op.ts` register 命令 | ❌ |
| H2：MySQL 查询参数化 | 1 | mysqlDao.ts like/sort/group 参数化 | ❌ |
| H6：统一连接池懒加载 | 0.5 | mysqlDao/postgresDao 延迟初始化 | ❌ |
| M9：移除 require-dir | 0.5 | `inits/index.ts` 改用 fs.readdirSync | ❌ |
| L8：统一错误处理 | 0.5 | DAO 层 catch 改为 throw | ❌ |
| L3：修复 UUID | 0.1 | globUtils.ts 返回完整 UUID | ❌ |

**验收标准**：
- `pnpm build` 通过
- `pnpm test` 全部通过
- 登录接口使用 bcrypt 校验，不再明文比较
- 敏感配置不在源码中硬编码
- MySQL DAO 使用参数化查询

---

### Phase 1：基础设施（1 周）

**目标**：Agent 数据模型 + LLM Provider 抽象层 + 会话管理

| 任务 | 天数 | 交付物 |
|------|------|--------|
| 新增数据库表（agent_sessions, agent_messages, agent_tasks） | 0.5 | SQL 迁移脚本 |
| LLM Provider 接口 + OpenAI 实现 | 1.5 | `src/agent/llm/provider.ts` + `openai.ts` |
| Agent Session Manager | 1 | `src/agent/session/manager.ts` |
| 配置扩展（LLM API Key、模型选择） | 0.5 | 扩展后的 configs.ts + .env |
| 数据库方言适配（确保新表在 4 种方言下可用） | 1 | 迁移脚本兼容 SQLite/PG/MySQL |

**验收标准**：
- `pnpm build` 通过
- 现有测试全部通过
- 可通过代码调用 LLM Provider 获得响应
- Session Manager 可创建/查询/删除会话

---

### Phase 2：Agent 核心（1.5 周）

**目标**：实现 Agent 执行循环 + Tool 框架

| 任务 | 天数 | 交付物 |
|------|------|--------|
| Tool 基类 + ToolRegistry | 1 | `src/agent/tools/tool.ts` + `registry.ts` |
| 内置工具：db_query, db_insert, db_update, db_delete | 1 | `src/agent/tools/db_*.ts` |
| 内置工具：http_get, http_post | 0.5 | `src/agent/tools/http_*.ts` |
| Agent 基类 + AgentRegistry | 1 | `src/agent/core/agent.ts` + `registry.ts` |
| Agent Executor（执行循环） | 2 | `src/agent/core/executor.ts` |
| Prompt Manager + 模板 | 1 | `src/agent/prompt/manager.ts` + `templates/` |
| 内置 Agent：通用助手 | 0.5 | 默认 Agent 配置 |

**验收标准**：
- Agent 可通过 Tool Calling 执行数据库查询
- 多轮 Tool Calling 正确执行
- 会话上下文正确传递

---

### Phase 3：API 层（1 周）

**目标**：暴露 RESTful API + SSE 流式输出

| 任务 | 天数 | 交付物 |
|------|------|--------|
| SSE 中间件 | 1 | `src/middlewares/sse.ts` |
| Agent API 路由 | 1.5 | `src/routers/router_agent.ts` |
| Chat API 路由（简化版） | 0.5 | `src/routers/router_chat.ts` |
| 流式输出实现 | 1.5 | Agent Executor 流式模式 |
| API 鉴权集成 | 0.5 | Agent API 的 JWT 鉴权 |

**验收标准**：
- `POST /api/agent/sessions` 创建会话
- `POST /api/agent/sessions/:id/messages` 同步返回
- `POST /api/agent/sessions/:id/messages { stream: true }` SSE 流式返回
- `GET /api/agent/sessions/:id/messages` 获取历史
- 未认证请求被拒绝

---

### Phase 4：增强功能（1 周）

**目标**：生产级可用性

| 任务 | 天数 | 交付物 |
|------|------|--------|
| Claude Provider 实现 | 1 | `src/agent/llm/claude.ts` |
| 本地模型 Provider（Ollama） | 1 | `src/agent/llm/local.ts` |
| 异步任务支持 | 1.5 | 任务创建/查询/取消 API |
| 会话过期清理 | 0.5 | 定时任务 |
| 内置工具：sql_query（受限） | 0.5 | `src/agent/tools/sql_query.ts` |
| 内置工具：code_eval（沙箱） | 1 | `src/agent/tools/code_exec.ts` |
| 日志与调用链路追踪 | 0.5 | Agent 调用日志 |

**验收标准**：
- 至少 2 个 LLM Provider 可用
- 长时间任务可通过 API 轮询状态
- Agent 调用链路可追踪

---

### Phase 5：质量与文档（0.5 周）

**目标**：测试覆盖 + API 文档 + 部署指南

| 任务 | 天数 | 交付物 |
|------|------|--------|
| Agent API 集成测试 | 1 | `test/agent.api.test.ts` |
| Tool 单元测试 | 0.5 | `test/tools.test.ts` |
| LLM Provider Mock 测试 | 0.5 | `test/llm.test.ts` |
| OpenAPI 规范文档 | 0.5 | `docs/openapi.yaml` |
| 部署指南 | 0.5 | `docs/deployment.md` |

**验收标准**：
- 测试覆盖率 > 60%（Agent 核心模块）
- API 文档可直接导入 Swagger UI
- 新用户可按部署指南完成部署

---

## 八、配置设计

### 8.1 新增配置项

```typescript
// src/config/configs.ts 扩展

export default {
  // ... 现有配置

  agent: {
    default_model: 'gpt-4o',
    max_turns: 10,
    default_temperature: 0.7,
    session_max_age: 86400,
    session_cleanup_interval: 3600,
  },

  llm: {
    openai: {
      api_key: process.env.OPENAI_API_KEY || '',
      base_url: process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1',
      models: ['gpt-4o', 'gpt-4o-mini', 'gpt-3.5-turbo'],
    },
    claude: {
      api_key: process.env.ANTHROPIC_API_KEY || '',
      models: ['claude-sonnet-4-20250514', 'claude-3-5-haiku-20241022'],
    },
    local: {
      base_url: process.env.OLLAMA_BASE_URL || 'http://localhost:11434',
      models: ['qwen2.5:7b', 'llama3:8b'],
    },
  },

  tools: {
    enabled: ['db_query', 'db_insert', 'db_update', 'db_delete', 'http_get', 'http_post'],
    sql_query: {
      allowed: true,
      read_only: true,
      max_rows: 1000,
    },
    code_eval: {
      allowed: false,
      timeout: 5000,
    },
  },
}
```

### 8.2 环境变量模板（.env.example）

```bash
# Database
DB_HOST=localhost
DB_PORT=3306
DB_NAME=gels
DB_USER=root
DB_PASS=

# JWT
JWT_SECRET=
JWT_EXPIRES=36000

# LLM Providers
OPENAI_API_KEY=
OPENAI_BASE_URL=https://api.openai.com/v1
ANTHROPIC_API_KEY=
OLLAMA_BASE_URL=http://localhost:11434

# Agent
AGENT_DEFAULT_MODEL=gpt-4o
```

---

## 九、风险与缓解

| 风险 | 影响 | 缓解措施 |
|------|------|----------|
| LLM API 不稳定 | 请求超时或失败 | 重试机制 + 超时配置 + 降级策略（切换 Provider） |
| Tool 执行安全 | 恶意指令执行危险操作 | 工具白名单 + 参数校验 + 操作审计 + SQL 只读模式 |
| Token 消耗过高 | 成本失控 | max_tokens 限制 + 用量统计 + 用户级配额 |
| 会话数据增长 | 数据库膨胀 | 会话过期清理 + 消息归档 |
| 并发 LLM 调用 | 资源耗尽 | 请求队列 + 并发限制 + 超时取消 |
| 全局 G 对象耦合 | 新代码难以测试 | Agent 模块完全通过 import 获取依赖，不使用 G |
| Phase 0 遗留问题未修复 | 安全漏洞带入生产 | Phase 0 为强制前置条件，不完成不进入 Phase 1 |

---

## 十、里程碑与交付

| 阶段 | 预计时间 | 里程碑 | 依赖 |
|------|----------|--------|------|
| Phase 0 | 第 1 周 | 安全加固完成 + 架构基础就绪 | 无 |
| Phase 1 | 第 2 周 | LLM 可调用 + 会话管理可用 | Phase 0 |
| Phase 2 | 第 3-4 周 | Agent 执行循环完成 + Tool Calling 可用 | Phase 1 |
| Phase 3 | 第 5 周 | RESTful API 可用 + SSE 流式输出 | Phase 2 |
| Phase 4 | 第 6 周 | 多 Provider + 异步任务 + 生产增强 | Phase 3 |
| Phase 5 | 第 7 周 | 测试覆盖 + 文档完整 | Phase 4 |

**最小可用产品（MVP）**：Phase 0-3 完成后即可提供基本的 AI Agent RESTful API 服务。

---

## 十一、与现有系统的兼容性

1. **现有 REST API 不变**：`/rs/*` 和 `/op/*` 路由完全保留
2. **Agent API 独立前缀**：`/api/agent/*` 和 `/api/chat` 不影响现有路由
3. **DAO 层复用**：Agent 的数据库操作复用现有 BaseDao
4. **鉴权统一**：Agent API 使用现有 JWT 鉴权中间件
5. **配置扩展**：新增配置项不影响现有配置
6. **中间件兼容**：SSE 中间件仅对特定路由生效
7. **SDK 客户端**：refer/ 目录下的项目通过 HTTP 调用本项目的 Agent API

---

## 十二、其他待办事项（长期）

以下问题不阻塞 AI Agent 开发，但应在后续迭代中逐步解决：

| 任务 | 优先级 | 说明 |
|------|--------|------|
| TypeScript 升级 5.x | P3 | 需修复编译错误，非阻塞 |
| DAO 查询逻辑重构（M8） | P3 | 抽取共享 QueryBuilder + Dialect 适配器 |
| 全局 G 对象解耦（M3） | P3 | 渐进式重构，新功能先行 |
| ESLint 规则收紧（L5） | P3 | 逐步将 off 改为 warn 再改为 error |
| API 文档（L7） | P3 | OpenAPI/Swagger 规范 |
| 测试覆盖扩展（L1） | P3 | 中间件、DAO、边界条件测试 |
| mysql2 升级验证 | P3 | 已升级到 3.x，需完整回归测试 |
| postgresDao 字段大小写（M10） | P3 | 引号策略兼容性评估 |

---

**编制人**：AI Architecture Review
**版本**：v3.0（2026-04-10 更新，明确服务定位为 SDK 后端平台）
**变更记录**：
- v1.0（2026-04-09）：初始版本
- v2.0（2026-04-10）：基于源码实际状态全面复核，修正已完成/未完成项状态，细化 Phase 0 任务及修复方案，增加长期待办清单
- v3.0（2026-04-10）：明确项目定位为"为 refer/ 目录下的 SDK 项目提供 LLM 交互服务"，调整愿景与目标描述，使文档更符合 B2B/SDK 服务场景，Phase 0 改为建议完成项以支持快速启动 AI 功能

# Gels AI Agent 开发计划

> 编制日期：2026-04-09
> 基于项目评审报告（docs/review-report.md）
> 目标：将 gels 框架升级为 RESTful API 形式的 AI Agent 平台

---

## 一、愿景与目标

### 愿景

在现有 REST 微服务框架基础上，构建一个轻量级 AI Agent 平台，让用户通过标准 RESTful API 与 AI Agent 交互，Agent 能够理解自然语言指令、调用工具（数据库查询、外部 API 等）、执行多步骤任务，并返回结构化结果。

### 核心目标

1. **AI Agent 作为一等公民**：Agent 是框架的核心抽象，不是附加功能
2. **RESTful API 原生支持**：所有 Agent 能力通过 RESTful API 暴露，兼容现有接口
3. **工具调用框架**：Agent 可调用预定义工具（数据库查询、HTTP 请求、代码执行等）
4. **多轮对话支持**：会话级上下文管理，支持连续交互
5. **流式输出**：SSE 支持长文本生成场景
6. **可扩展架构**：支持自定义 Agent、自定义工具、自定义提示词模板

---

## 二、前置条件（Phase 0）

在开始 AI Agent 开发之前，必须先完成以下加固工作。这些是评审报告中标识的 P0/P1 问题。

### 0.1 安全加固（1-2 天）

| 任务 | 说明 | 优先级 |
|------|------|--------|
| 修复登录密码校验 | 引入 bcrypt，注册用 hash，登录用 compare | P0 |
| 配置外部化 | 引入 dotenv，敏感配置从环境变量读取 | P0 |
| MySQL 查询参数化 | 修复模糊搜索和 sort/group 的 SQL 拼接 | P1 |
| 统一连接池初始化 | 所有 DAO 改为懒加载连接池 | P1 |

### 0.2 架构准备（2-3 天）

| 任务 | 说明 | 优先级 |
|------|------|--------|
| 抽取查询构建器 | 将 DAO 查询逻辑重构为 QueryBuilder + Dialect 适配器 | P2 |
| 统一错误处理 | DAO 层 catch 改为 throw，统一由 globalError 处理 | P2 |
| 移除 require-dir | inits/index.ts 改为 fs.readdirSync + 动态 import | P2 |
| 新模块不再依赖 G | 新增代码通过 import 获取 config/logger/tools | P2 |

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

### 3.2 目录结构扩展

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
  // 创建新会话
  async create(agentId: string, userId: string, metadata?: object): Promise<AgentSession>

  // 获取会话
  async get(sessionId: string): Promise<AgentSession | null>

  // 获取会话消息历史
  async getMessages(sessionId: string, page?: number, size?: number): Promise<Message[]>

  // 追加消息
  async addMessage(message: Message): Promise<void>

  // 删除会话及其消息
  async delete(sessionId: string): Promise<void>

  // 清理过期会话
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

### Phase 1：基础设施（1 周）

**目标**：完成前置加固 + Agent 数据模型 + LLM Provider 抽象层

| 任务 | 天数 | 交付物 |
|------|------|--------|
| P0 安全加固（bcrypt、dotenv） | 1 | 可编译运行的安全版本 |
| 统一错误处理 + 连接池懒加载 | 1 | 重构后的 DAO 层 |
| 新增数据库表（agent_sessions, agent_messages, agent_tasks） | 0.5 | 迁移脚本 |
| LLM Provider 接口 + OpenAI 实现 | 1.5 | `src/agent/llm/provider.ts` + `openai.ts` |
| Agent Session Manager | 1 | `src/agent/session/manager.ts` |
| 配置扩展（LLM API Key、模型选择） | 0.5 | 扩展后的 configs.ts |

**验收标准**：
- `pnpm build` 通过
- 现有测试全部通过
- 可通过代码调用 LLM Provider 获得响应

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
    session_max_age: 86400,          // 会话最大存活时间（秒）
    session_cleanup_interval: 3600,  // 清理间隔（秒）
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
      read_only: true,              // 仅允许 SELECT
      max_rows: 1000,
    },
    code_eval: {
      allowed: false,               // 默认关闭
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

---

## 十、里程碑与交付

| 阶段 | 预计时间 | 里程碑 |
|------|----------|--------|
| Phase 0 + 1 | 第 1-2 周 | 安全加固完成 + LLM 可调用 + 会话管理可用 |
| Phase 2 | 第 3-4 周 | Agent 执行循环完成 + Tool Calling 可用 |
| Phase 3 | 第 5 周 | RESTful API 可用 + SSE 流式输出 |
| Phase 4 | 第 6 周 | 多 Provider + 异步任务 + 生产增强 |
| Phase 5 | 第 7 周 | 测试覆盖 + 文档完整 |

**最小可用产品（MVP）**：Phase 1-3 完成后即可提供基本的 AI Agent RESTful API 服务。

---

## 十一、与现有系统的兼容性

1. **现有 REST API 不变**：`/rs/*` 和 `/op/*` 路由完全保留
2. **Agent API 独立前缀**：`/api/agent/*` 和 `/api/chat` 不影响现有路由
3. **DAO 层复用**：Agent 的数据库操作复用现有 BaseDao
4. **鉴权统一**：Agent API 使用现有 JWT 鉴权中间件
5. **配置扩展**：新增配置项不影响现有配置
6. **中间件兼容**：SSE 中间件仅对特定路由生效

---

**编制人**：AI Architecture Review
**版本**：v1.0

# 功能文档

## 1. 概述

本项目提供一套面向 MySQL 的 REST API 服务框架。它的主要特点是：

- 自动化 REST CRUD
- 统一响应格式
- JWT 认证
- 目录初始化、日志和缓存中间件

## 2. 启动与运行

### 启动流程

1. 读取 `src/config/configs.ts`
2. 初始化全局对象、日志和 Promise 环境
3. 装载中间件
4. 执行初始化模块
5. 监听配置端口

### 主要配置项

- `port`：HTTP 服务端口
- `dbconfig`：MySQL 连接配置
- `jwt.secret`：JWT 密钥
- `jwt.expires_max`：token 过期时间
- `inits.directory.run`：是否创建目录
- `inits.socket.run`：是否初始化 socket

## 3. REST 功能

### 3.1 通用 CRUD

路由前缀是：

- `/rs/:table`
- `/rs/:table/:id`

请求方法和行为对应如下：

- `GET`：查询
- `POST`：新增
- `PUT`：更新
- `DELETE`：删除

请求参数规则：

- `GET` 和 `DELETE` 主要使用 query 参数和路径参数
- `POST` 和 `PUT` 使用 body 参数
- `fields` 可用于控制返回字段

### 3.2 查询能力

`BaseDao` 和 `MysqlDao` 支持的查询能力包括：

- 普通字段等值查询
- `null` 判断
- `in` 查询
- `like` 查询
- `or` 组合条件
- 范围条件，如大于、小于、介于等
- `count` 和 `sum`
- 排序、分页、分组

### 3.3 返回格式

接口统一通过 `G.jsResponse()` 输出，返回体包含：

- `status`
- `message`
- `data`

这使前端或调用方可以按统一协议解析结果。

## 4. 登录与认证

### 4.1 登录接口

登录路由位于 `/op/login`。

行为：

1. 从 `users` 表查询用户名
2. 校验成功后签发 JWT
3. 返回 token

### 4.2 token 规则

- token 从请求头的 `token` 字段读取
- 解析成功后写入 `ctx.session`
- 非 GET 请求访问 `/rs` 类接口时会进行鉴权
- token 过期或无效会返回统一错误码

## 5. 初始化功能

### 6.1 目录初始化

`initDirectory` 会按配置创建目录，例如：

- `public/upload`
- `public/temp`

### 6.2 其他初始化模块

以下模块目前是预留入口：

- `initSchedule`
- `initSocket`
- `initMemery`

它们已经接入启动流程，但当前主要输出调试日志，功能还没有完全展开。

## 7. 日志与错误

### 7.1 日志

日志由 `log4js` 管理，默认输出到控制台。当前配置更适合开发和排错，生产环境可以再拆分为文件日志或集中式日志。

### 7.2 错误处理

全局错误中间件会把异常统一转成响应体，避免直接把未处理异常暴露给调用方。

## 8. 工具函数

全局工具对象 `G.tools` 提供了若干通用方法，包括：

- UUID 生成
- 数组解析
- 字符串辅助处理

这些工具被 DAO 层和路由层直接使用。

## 9. 已知限制

- `token` 认证头不是标准的 `Authorization`，集成第三方网关时要额外适配
- `moment`、`bluebird`、`tslint` 都属于老组件，适合后续逐步替换
- 当前缺少自动化测试脚本，功能验证主要靠手工请求

## 10. 快速使用示例

### 查询列表

```http
GET /rs/users?page=1&size=10
```

### 新增数据

```http
POST /rs/users
Content-Type: application/json

{"username":"alice","password":"123456"}
```

### 登录

```http
POST /op/login
Content-Type: application/json

{"username":"alice","password":"123456"}
```

## 10. 备注

本项目的功能设计重点是“快速拼装服务”，不是严格分层的企业级架构。如果后续业务扩大，建议优先补测试、收敛全局状态，再逐步迁移掉过时依赖。

# Generic Chat View / Server Design

> Status: **Design Draft**  
> Scope: 通用单上下文 `<chat-view>` Web Component、WebSocket endpoint 边界，以及对应 server 的职责。  
> Goal: 提供一个足够薄、可组合、可被 Hostra 或普通 Web 页面复用的 Chat capability。  
> Protocol status: **WebSocket 协议具体格式待定；本文只冻结职责边界与交互原则。**

## 1. 定位

本设计定义一套通用 Chat capability：

```text
<chat-view>
      |
      | one WebSocket URL
      v
WebSocket Chat Endpoint
      |
      v
business / agent / runtime
```

`<chat-view>` 不是完整聊天应用框架，也不负责 workspace、会话列表、导航、业务状态管理或后端选择。

核心原则：

> `<chat-view>` 是一个由 WebSocket endpoint 完全驱动的 single-context chat viewport。

组件只接收一个 WebSocket URL。连接建立后，标题、状态、消息、streaming、输入发送、取消能力以及恢复所需数据都通过该 WebSocket 交互。

WebSocket connection / endpoint 本身就是当前 Chat context 的 binding。

## 2. 与 Editor Capability 的一致性

该设计沿用仓库现有 editor capability 的基本方式：

```text
<code-editor>
      |
      | lsp-url
      v
lsp-ws-server
      |
      v
language server
```

对应 Chat：

```text
<chat-view>
      |
      | ws-url
      v
chat endpoint
      |
      v
business backend
```

两者共同遵循：

```text
Web Component
  = browser-side capability view

WebSocket URL
  = capability binding

Server / endpoint
  = capability implementation boundary

Hostra
  = local window / process orchestrator
```

组件不需要理解 endpoint 背后的具体实现。

## 3. V1 目标

V1 只解决四件事：

```text
标题栏 / 状态栏
对话消息列表
输入窗口
通过单一 WebSocket endpoint 进行实时交互
```

组件应可直接复用于不同业务，例如：

```text
AI assistant
Dayloom
客服
代码 Agent
NPC / game conversation
运维助手
其他基于对话的工具
```

这些业务可以拥有完全不同的 runtime，只要其 endpoint 实现 `<chat-view>` 所需的 Chat WebSocket Protocol。

## 4. 非目标

V1 明确不实现：

```text
session list
session switch
new chat / delete chat / rename chat
workspace navigation
history browser
backend selector
model selector
业务设置页
业务工具栏
业务状态机
业务领域对象
```

尤其不应因为某个业务需要多会话，就把 session manager 加进 `<chat-view>`。

如果产品需要多个 conversation，应由外部 shell、页面布局或 Hostra window composition 负责组织多个 binding。

## 5. 组件结构

UI 保持极简：

```text
┌──────────────────────────────┐
│ 标题栏 / 状态栏              │
├──────────────────────────────┤
│                              │
│        对话消息列表          │
│                              │
├──────────────────────────────┤
│          输入窗口            │
└──────────────────────────────┘
```

### 5.1 标题栏 / 状态栏

只显示当前 endpoint 提供的可见信息，例如：

```text
title
status text
busy / ready
connected / disconnected
```

标题和业务状态不通过宿主页面单独配置，而由 WebSocket 数据驱动。

浏览器侧的物理连接状态可以由组件自身推导。

标题栏不是 navigation bar，也不是 session toolbar。

### 5.2 对话消息列表

负责：

```text
消息渲染
不同消息角色的基础展示
streaming 增量渲染
滚动行为
当前生成状态
基础错误 / 断线提示
```

消息列表只理解最终冻结的通用 Chat Protocol，不理解业务内部对象。

### 5.3 输入窗口

V1 composer 只负责：

```text
text input
send
busy / disabled
可选 cancel
```

是否允许发送、是否允许取消等能力同样由 WebSocket endpoint 驱动。

输入区不负责模型、Agent mode、知识库、World mode 等业务配置。

## 6. Web Component 公共边界

组件名冻结为：

```html
<chat-view></chat-view>
```

V1 的核心公共输入只有一个 WebSocket URL：

```html
<chat-view ws-url="ws://127.0.0.1:8081/chat"></chat-view>
```

对应概念上的 JavaScript API 也应保持极小：

```ts
chatView.wsUrl = "ws://127.0.0.1:8081/chat";
```

实现可以提供必要的生命周期辅助方法，例如重新连接或等待初始化完成，但不应再增加业务配置对象。

明确不提供：

```text
chatView.backend
chatView.context
chatView.session
chatView.messages = ...
chatView.title = ...
chatView.status = ...
```

这些数据都应来自 WebSocket。

因此 `<chat-view>` 的宿主不需要知道当前 endpoint 对应 Dayloom、客服系统还是其他业务。

## 7. WebSocket URL 即 Chat Binding

一个 `<chat-view>` instance 在任意时刻绑定一个 WebSocket URL：

```text
<chat-view>
    |
    | ws-url
    v
one endpoint
    =
one current chat context
```

组件不额外发送“切换 session”之类的业务控制请求。

如果需要切换上下文，由外部组合层改变 `ws-url`、销毁组件或创建新的组件实例：

```text
old ws-url
   |
   v
close old connection
   |
   v
new ws-url
   |
   v
connect new endpoint
```

因此 Chat Protocol 不需要承担 conversation discovery 或 session switching。

## 8. 所有 Chat 数据都通过 WebSocket

连接建立后，Chat view 所需的数据统一通过 WebSocket 传输。

包括但不限于：

```text
initial visible state / snapshot
标题
状态
消息历史或当前可见消息
新消息
streaming 增量
发送能力
取消能力
操作状态
错误状态
恢复 / 重连后的重新同步数据
```

客户端产生的 Chat 交互也通过同一连接发送：

```text
用户输入
发送操作
取消操作
未来经确认属于通用 Chat 的交互
```

不设计第二条 REST 数据通道，也不要求宿主页面另外注入 transcript、title 或业务状态。

如未来确需 HTTP，它应服务于静态资源、health check 等非 Chat 数据面，不应形成第二套 Chat state transport。

## 9. WebSocket 协议：待定

本阶段**不冻结具体 WebSocket message schema**。

因此本文不规定：

```text
具体 message type 名称
request / response envelope
JSON-RPC 或自定义 event protocol
message id 格式
stream delta 格式
snapshot 格式
error envelope
cancel message 格式
版本协商方式
```

这些内容应在实现 `<chat-view>` 前单独设计并形成 Chat Protocol V1 文档。

当前只冻结以下协议层原则：

1. 一个连接对应一个当前 Chat binding。
2. 连接建立后，server 必须能够驱动完整可见 UI。
3. server 是 Chat visible state 的来源；组件不维护业务 canonical state。
4. streaming 必须作为协议的一等能力考虑。
5. cancellation 是否支持由 endpoint 表达，组件不得假定所有 backend 都可取消。
6. reconnect 后必须存在重新建立 UI projection 的明确机制。
7. 协议不得暴露特定业务内部对象。
8. 协议不得承担 session list / switch / rename / delete。

## 10. Reconnect 与恢复原则

`<chat-view>` 可以负责 WebSocket 物理重连，但不能把浏览器本地 transcript 当成业务事实源。

推荐语义：

```text
WebSocket disconnected
        |
        v
chat-view 显示断线状态
        |
        v
reconnect same ws-url
        |
        v
endpoint 提供恢复当前可见状态所需的数据
        |
        v
chat-view 重建 projection
```

具体采用完整 snapshot、event replay、revision cursor 或其他机制，留给 Chat Protocol V1 决定。

关键约束是：

> reconnect recovery 由 server-side authoritative state 驱动，而不是由组件猜测。

## 11. Server / Endpoint 定位

`<chat-view>` 不要求所有业务都经过一个中央通用 server。

任何实现 Chat WebSocket Protocol 的 endpoint 都可以直接驱动组件：

```text
                 <chat-view>
                     |
                     v
            Chat WebSocket Protocol
                     |
        +------------+-------------+
        |            |             |
        v            v             v
     Dayloom      AI Agent      Support
     server        server        server
```

仓库可以提供一个通用 `chat-server` package，作为：

```text
协议实现参考
WebSocket transport helper
connection lifecycle helper
backend adapter scaffold
测试 backend / demo server
```

但它不应成为所有业务必须经过的中央 runtime 或 plugin registry。

## 12. Server 不拥有业务事实

无论具体业务直接实现 endpoint，还是使用通用 `chat-server` helper，都必须保持以下边界。

Server / transport 层可以负责：

```text
HTTP / WebSocket endpoint
protocol parse / validation
connection lifecycle
stream forwarding
cancel plumbing
serialization
```

它不应为了方便复制一套业务 canonical state：

```text
业务 conversation database
业务状态机
World / Draft / Archive
任务 canonical state
业务 publication state
```

这些事实属于具体业务 runtime。

## 13. Dayloom 示例

Dayloom 是 `<chat-view>` 的一个使用方，而不是组件的内建业务。

可以形成：

```text
<chat-view>
      |
      | ws-url
      v
Dayloom Chat Endpoint
      |
      v
@dayloom/core
```

Dayloom endpoint 负责把 Dayloom Core 的可观察 Chat 行为转换成未来冻结的通用 Chat Protocol。

以下 Dayloom 内部概念不应直接进入组件：

```text
World
Draft
Candidate
Archive
Publication
Aggregate Head
Core internal state machine
```

如果产品需要展示 World、Draft 或文件，应使用其他 Web Component / window capability 组合，而不是扩大 `<chat-view>`。

## 14. Hostra 组合

Hostra 只负责物理宿主和编排：

```text
spawn business/chat server
observe subprocess lifecycle
open BrowserWindow
close BrowserWindow
```

例如：

```text
Hostra
 |
 +-- process: Dayloom chat endpoint
 |
 +-- window A
 |    +-- <chat-view ws-url=".../chat/a">
 |
 +-- window B
      +-- <chat-view ws-url=".../chat/b">
```

多个 chat context 如何组织是应用组合问题，不是 `<chat-view>` 的职责。

WebSocket URL 可以由 Hostra 启动的业务进程动态生成，再传给对应窗口。

## 15. Endpoint 与认证

`ws-url` 应被视为 capability binding，而不只是网络地址。

对于 Hostra 本地应用，推荐优先考虑由业务 server 产生不可预测、短生命周期的 endpoint / capability URL，而不是让 `<chat-view>` 额外理解 token、backend id、world id 等字段。

概念上：

```text
ws://127.0.0.1:<port>/chat/<opaque-binding>
```

具体 endpoint discovery、认证、token 或 capability URL 规则暂不在本文冻结，应与 Chat Protocol / Hostra integration 一起设计。

## 16. 推荐包结构

第一版可以按以下形式组织：

```text
packages/
  chat-view/
    src/
      component/
      index.ts

  chat-server/
    src/
      server.ts
      connection.ts
      backend.ts
      cli.ts
```

如果协议开始稳定，并且 client/server 确实需要共享 schema，再抽出：

```text
packages/chat-protocol/
```

协议尚未冻结前，不为了理论分层提前固化大量类型。

## 17. V1 实现约束

V1 应保持：

1. `<chat-view>` 的核心输入只有 `ws-url`。
2. 一个组件实例只绑定一个当前 Chat endpoint/context。
3. 标题、状态、消息、streaming、能力等 Chat 数据全部经 WS 传输。
4. WC 不实现 session discovery / list / switch / rename / delete。
5. WC 不理解具体业务 backend、session、World 或 runtime。
6. endpoint/server 不为了 UI 复制第二份业务 canonical state。
7. reconnect 后由 server-side state 驱动 UI 恢复。
8. Hostra 只负责 window/process physical lifecycle 和 endpoint composition。
9. 通用 `chat-server` 可以是 helper/reference implementation，但不是强制中央 server。
10. Chat WebSocket Protocol 的具体 wire format 在独立设计中冻结。

## 18. V1 成功标准

第一版完成时，至少应证明：

```text
普通浏览器页面可以加载 <chat-view>
只设置 ws-url 即可开始工作
endpoint 可以通过 WS 提供标题 / 状态 / 初始消息
用户输入通过 WS 发送
assistant 回复可以 streaming
send / cancel 等能力由 endpoint 驱动
断线后可以重新连接同一个 endpoint 并恢复可见状态
同一个 <chat-view> 无需修改即可接入两个不同业务 endpoint
Hostra 可以启动业务 server，并把动态 ws-url 交给窗口中的 <chat-view>
```

具体 WS message schema 不属于这一阶段的成功标准。

## 19. 一句话定义

> **`<chat-view>` 是一个由单一 WebSocket endpoint 完全驱动的、单上下文、业务无关的极薄 Chat viewport；WebSocket URL 即当前 Chat binding，会话管理、业务语义和应用编排全部位于组件之外。**

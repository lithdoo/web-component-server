# Generic Chat View / Server Design

> Status: **Design Draft**  
> Scope: 通用单上下文 `<chat-view>` Web Component、WebSocket endpoint 边界，以及对应 server 的职责。  
> Goal: 提供一个足够薄、可组合、可被 Hostra 或普通 Web 页面复用的 Chat capability。  
> Protocol status: **协议总体方向已明确为 JSON-RPC request/response + 独立 server push event；具体 wire schema 仍待单独冻结。**

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

这些业务可以拥有完全不同的 runtime，只要其 endpoint 实现 `<chat-view>` 所需的通用 Chat WebSocket Protocol。

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
消息结构渲染
不同消息角色的基础展示
消息内容渲染
streaming 增量渲染
消息局部状态展示
滚动行为
基础错误 / 断线提示
```

消息列表只理解通用 Chat Protocol，不理解业务内部对象。

### 5.3 输入窗口

V1 composer 只负责：

```text
text input
send
busy / disabled
可选 cancel
```

是否允许发送、是否允许取消等能力由 WebSocket endpoint 驱动。

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

因此 Chat Protocol 不承担 conversation discovery 或 session switching。

## 8. 所有 Chat 数据都通过 WebSocket

连接建立后，Chat view 所需的数据统一通过 WebSocket 传输。

包括但不限于：

```text
初始化数据
标题
Chat 状态
Message model
Message content
Message status
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

## 9. 协议分为两个 Plane

同一条 WebSocket 上的 Chat Protocol 分成两个语义不同的部分：

```text
WebSocket
  |
  +-- Request / Response Plane
  |     = JSON-RPC 2.0
  |
  +-- Server Push Event Plane
        = 独立事件协议
```

### 9.1 Request / Response Plane

用于表达：

```text
client 主动发起的请求
需要明确接受 / 拒绝结果的操作
读取当前结构数据
需要 request id 对应 response 的调用
```

这一部分采用标准 JSON-RPC 2.0。

### 9.2 Server Push Event Plane

用于表达 server 侧已经发生的可观察事实，例如：

```text
新消息出现
消息内容增量
消息状态变化
Chat 状态变化
operation 状态变化
```

Event 不承担 request / response 语义，也不要求强行表示成 JSON-RPC notification。

具体 event envelope、命名、顺序字段、replay / recovery 机制仍待后续 Chat Protocol V1 文档冻结。

## 10. Request / Response 初步范围

当前先冻结 request/response 的职责，不冻结最终 method 名称和字段。

结合 `<chat-view>` 的实际 UI 需求，候选能力为：

```text
initialize
getMessages
getMessageContents
sendMessage
cancelOperation
```

其中：

```text
initialize
  = 建立协议级初始化状态，必要时协商版本 / capability

getMessages
  = 获取当前 Chat 中的 Message model / ordering

getMessageContents
  = 按 message id 批量获取 Message content

sendMessage
  = 提交一条新的用户输入，并得到是否接受以及异步 operation identity

cancelOperation
  = 请求取消一个当前 operation
```

是否需要独立的 `getSnapshot`、`invokeAction` 或其他 method 暂不冻结，应由真实业务需求继续验证。

JSON-RPC response 只表达 request 是否成功被处理或异步 operation 是否成功建立，不等同于异步业务操作最终完成。

## 11. Message 数据模型分离

Message 不应设计成一个把身份、内容、运行状态全部嵌入的大对象。

当前设计决定将其拆成三个独立概念：

```text
Message Model
  = 这条消息是什么

Message Content
  = 这条消息显示什么

Message Status
  = 这条消息当前处于什么运行状态
```

这种拆分适合 Chat 的实际生命周期：Message identity / ordering 通常较稳定，而 Content 可能 streaming，Status 也可能独立变化。

### 11.1 Message Model

Message model 负责稳定结构信息，例如概念上：

```ts
interface MessageModel {
  id: string;
  role: string;
  createdAt?: string;
}
```

具体字段、role 枚举、ordering 表达方式仍待协议阶段冻结。

Message model 不直接内嵌完整 content 或 runtime status。

### 11.2 Message Content

Content 独立于 Message model 获取和更新。

V1 可以先从纯文本开始，但协议应允许以后在不改变 Message identity 模型的情况下扩展 content 表达。

概念上：

```ts
interface MessageContent {
  messageId: string;
  text: string;
}
```

未来如果出现真实跨业务需求，可以进一步演进为：

```text
text
markdown
image
file
structured block
```

是否让 content 自身拥有 `contentId`，以及一个 Message 是否允许多个 content part，当前暂不冻结。

### 11.3 Message Status

Message status 与 content 分离，并且与全局 Chat status 分离。

概念上的状态可能包括：

```text
pending
streaming
completed
failed
cancelled
```

最终状态集合待协议阶段根据真实 backend 行为冻结。

Message status 更接近 runtime projection，不应被当成 Message model 的稳定身份字段。

## 12. Message Model 与 Content 分开读取

初始化或重新同步时，不要求 server 返回一个包含所有字段的巨大 Message 数组。

推荐的数据读取方向：

```text
getMessages
    |
    v
MessageModel[]

getMessageContents(messageIds[])
    |
    v
MessageContent[]
```

`getMessageContents` 应优先支持批量读取，避免对每条消息产生一个 RPC，形成 N+1 请求模式。

这样 `<chat-view>` 可以先建立 transcript 的结构，再填充对应内容。

对于 Message Status，不要求为全部历史消息执行普通高频查询。历史稳定消息通常可以由服务端同步结果表达为 settled 状态；当前 active / exceptional message 的状态更适合通过 Event Plane 驱动。

如果恢复场景确实需要完整 status projection，再在协议设计阶段决定通过初始化结果、snapshot 或专门查询提供。

## 13. Message Content 与 Status 独立接收更新

Server push event 应保持和 normalized data model 一致。

概念上应能分别表达：

```text
Message model added / changed
Message content changed / appended
Message status changed
```

例如 streaming 不应要求 server 每次重发完整 Message object。

理想的数据流是：

```text
Message Model 建立
      |
      v
Status = streaming
      |
      +--> Content delta
      +--> Content delta
      +--> Content delta
      |
      v
Status = completed
```

具体 event 名称、delta 表达方式和 wire schema 当前仍待定。

## 14. Chat Status 与 Message Status 分离

必须区分：

```text
Chat Status
  = 当前整个 Chat view / endpoint 的可见状态

Message Status
  = 某一条 Message 的局部运行状态
```

例如：

```text
Chat Status:
  Ready
  Working
  Waiting for user
  Error

Message Status:
  streaming
  completed
  failed
```

`<chat-view>` 的标题栏主要消费 Chat Status；消息列表局部消费 Message Status。

两者不应共享同一个状态枚举，也不应把业务内部状态机直接暴露给组件。

## 15. `<chat-view>` 内部采用 Normalized Projection

协议模型分离后，组件内部状态也推荐 normalized，而不是把所有数据嵌套在 Message object 中。

概念上：

```ts
messages: Map<MessageId, MessageModel>
contents: Map<MessageId, MessageContent>
statuses: Map<MessageId, MessageStatus>
order: MessageId[]
```

如果未来 Content 自身拥有 identity，则 contents 可以进一步改成按 `contentId` 索引。

这种模型有利于：

```text
streaming 局部更新
避免重复复制完整 message
独立处理 content 与 status
恢复 / 重同步
协议 reducer 测试
未来扩展 rich content
```

这些只是内部 projection 原则，不要求把具体 TypeScript 数据结构冻结为公共 API。

## 16. Reconnect 与恢复原则

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

具体采用重新读取 Message model/content、完整 snapshot、event replay、revision cursor 或其他机制，留给 Chat Protocol V1 决定。

关键约束是：

> reconnect recovery 由 server-side authoritative state 驱动，而不是由组件猜测。

## 17. Server / Endpoint 定位

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
JSON-RPC dispatch helper
event push helper
backend adapter scaffold
测试 backend / demo server
```

但它不应成为所有业务必须经过的中央 runtime 或 plugin registry。

## 18. Server 不拥有业务事实

无论具体业务直接实现 endpoint，还是使用通用 `chat-server` helper，都必须保持以下边界。

Server / transport 层可以负责：

```text
HTTP / WebSocket endpoint
protocol parse / validation
JSON-RPC dispatch
connection lifecycle
server event forwarding
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

## 19. Dayloom 示例

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

Dayloom endpoint 负责把 Dayloom Core 的可观察 Chat 行为转换成通用 Chat Protocol。

例如概念上的映射可能是：

```text
getMessages           -> 当前 Conversation 的 Message model projection
getMessageContents    -> 当前 Conversation 的可见 content projection
sendMessage           -> Session turn / send
cancelOperation       -> Core cancel
server push events    <- Core observable events
```

具体映射仍应服从 Dayloom 自己的 authority / Session 语义，不进入通用协议定义。

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

## 20. Hostra 组合

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

## 21. Endpoint 与认证

`ws-url` 应被视为 capability binding，而不只是网络地址。

对于 Hostra 本地应用，推荐优先考虑由业务 server 产生不可预测、短生命周期的 endpoint / capability URL，而不是让 `<chat-view>` 额外理解 token、backend id、world id 等字段。

概念上：

```text
ws://127.0.0.1:<port>/chat/<opaque-binding>
```

具体 endpoint discovery、认证、token 或 capability URL 规则暂不在本文冻结，应与 Chat Protocol / Hostra integration 一起设计。

## 22. 推荐包结构

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
      rpc.ts
      events.ts
      backend.ts
      cli.ts
```

如果协议开始稳定，并且 client/server 确实需要共享 schema，再抽出：

```text
packages/chat-protocol/
```

协议尚未冻结前，不为了理论分层提前固化大量类型。

## 23. 当前冻结的设计决定

当前阶段冻结以下决定：

1. `<chat-view>` 的核心输入只有 `ws-url`。
2. 一个组件实例只绑定一个当前 Chat endpoint/context。
3. 标题、Chat status、Message model、Message content、Message status、streaming 和 capability 等数据全部经 WS 传输。
4. request/response 使用 JSON-RPC 2.0。
5. server push event 使用独立 Event Plane；具体 event wire schema 待定。
6. Message model、Message content、Message status 分离建模和同步。
7. Message model/content 的读取应支持批量方式，避免 N+1 RPC。
8. Chat status 与 Message status 分离。
9. WC 不实现 session discovery / list / switch / rename / delete。
10. WC 不理解具体业务 backend、session、World 或 runtime。
11. endpoint/server 不为了 UI 复制第二份业务 canonical state。
12. reconnect 后由 server-side state 驱动 UI 恢复。
13. Hostra 只负责 window/process physical lifecycle 和 endpoint composition。
14. 通用 `chat-server` 可以是 helper/reference implementation，但不是强制中央 server。
15. 最终 JSON-RPC method 名称、参数、结果以及 Event schema 在 Chat Protocol V1 中单独冻结。

## 24. V1 成功标准

第一版完成时，至少应证明：

```text
普通浏览器页面可以加载 <chat-view>
只设置 ws-url 即可开始工作
endpoint 可以通过 WS 提供标题 / Chat status
可以分别获取 Message model 与 Message content
可以独立接收 Message content / Message status 更新
用户输入通过 JSON-RPC request 发送
assistant 回复可以通过 server push event streaming
send / cancel 等能力由 endpoint 驱动
断线后可以重新连接同一个 endpoint 并恢复可见状态
同一个 <chat-view> 无需修改即可接入两个不同业务 endpoint
Hostra 可以启动业务 server，并把动态 ws-url 交给窗口中的 <chat-view>
```

具体 JSON-RPC method 字段和 Event wire schema 不属于这一阶段的冻结内容。

## 25. 一句话定义

> **`<chat-view>` 是一个由单一 WebSocket endpoint 完全驱动的、单上下文、业务无关的极薄 Chat viewport；Request/Response 使用 JSON-RPC，Server Push 使用独立 Event Plane，Message 的 model、content 和 status 分离同步，而会话管理、业务语义和应用编排全部位于组件之外。**

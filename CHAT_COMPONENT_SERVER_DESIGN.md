# Generic Chat Web Component / Server Design

> Status: **Design Draft**  
> Scope: 通用单上下文 Chat Web Component、对应的本地 Chat Server，以及业务 Adapter 边界。  
> Goal: 提供一个足够薄、可组合、可被 Hostra 或普通 Web 页面复用的 Chat capability。

## 1. 定位

本设计定义一套通用 Chat capability：

```text
<chat-component>
      |
      | WebSocket Chat Protocol
      v
  chat-server
      |
      | Chat Backend Interface
      v
 business adapter
```

它不是完整聊天应用框架，也不负责 workspace、会话列表、导航或业务状态管理。

核心原则：

> `<chat-component>` 是一个 single-context chat viewport。它只展示并操作当前绑定的对话上下文，不拥有 conversation/session discovery、navigation 或 session switching。

一个组件实例在任意时刻只对应一个当前 Chat context。需要切换业务上下文时，由外部宿主销毁、重建或重新绑定组件，而不是由组件内部维护会话列表。

## 2. 目标

V1 只解决四件事：

```text
标题栏 / 状态栏
对话消息列表
输入窗口
与 chat-server 的单上下文实时通信
```

组件应当能够用于不同业务，例如：

```text
AI assistant
Dayloom
客服
代码 Agent
NPC / game conversation
运维助手
其他基于对话的本地工具
```

这些业务共享同一套 UI 和 transport，但各自拥有自己的后端语义。

## 3. 非目标

V1 明确不实现：

```text
session list
session switch
new chat / delete chat / rename chat
workspace navigation
history browser
业务设置页
模型选择策略
业务工具栏
业务状态机
World / Draft / Archive 等领域对象
```

这些能力属于外部宿主或具体业务。

组件也不应逐渐膨胀成完整的 Chat application shell。

## 4. 组件结构

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

### 4.1 标题栏 / 状态栏

只表达当前上下文的可见状态，例如：

```text
title
status text
busy / connected / disconnected
optional minimal host-provided action slot
```

它不是 navigation bar，也不是 session toolbar。

不在组件内加入：

```text
session selector
model selector
workspace selector
settings menu
history menu
```

如业务确实需要额外按钮，应优先通过 slot 或外部布局组合，而不是扩展组件的业务 API。

### 4.2 对话列表

负责：

```text
消息渲染
用户 / assistant 消息区分
streaming delta 渲染
滚动行为
当前生成状态
基础错误提示
```

消息列表只理解通用 Chat message，不理解业务领域对象。

### 4.3 输入窗口

V1 composer 只负责：

```text
text input
send
busy / disabled
optional cancel
```

不负责模型、Agent mode、知识库、业务操作模式等配置。

## 5. Web Component 边界

推荐组件名：

```html
<lithdoo-chat></lithdoo-chat>
```

组件只拥有 presentation 和当前连接的交互状态。

它不拥有业务 canonical state。

推荐的最小配置形态：

```html
<lithdoo-chat
  server-url="ws://127.0.0.1:8081/chat"
></lithdoo-chat>
```

复杂配置通过 property 传入，而不是不断增加 HTML attribute：

```ts
chat.connection = {
  url,
  token,
};

chat.context = {
  backend: "some-backend",
  params: {...},
};
```

`context.params` 对组件本身应当是 opaque data。组件不得解析具体业务字段。

组件可暴露少量通用 DOM event，例如：

```text
chat-ready
chat-state-change
chat-error
chat-close
```

组件内部的 token/delta 流不要求宿主页面逐条处理；组件自己消费协议事件并更新 transcript。

## 6. 单上下文模型

组件和 server 都不提供 session switching API。

推荐模型：

```text
一个 <lithdoo-chat>
        =
一个当前 connection/context binding
```

业务切换由外部控制：

```text
close / dispose current binding
            |
            v
open / bind another context
```

这意味着 Chat Protocol V1 不需要：

```text
session.list
session.switch
session.rename
session.delete
```

如果未来某个产品需要会话列表，应当由产品自己的 shell、sidebar、launcher 或 Hostra window composition 实现。

## 7. Chat Server 定位

`chat-server` 是通用 transport / application adapter host，不是业务 runtime。

它负责：

```text
HTTP / WebSocket endpoint
protocol validation
connection lifecycle
当前 chat binding
operation cancellation plumbing
event serialization
backend adapter 调用
```

它不负责：

```text
业务 canonical state
业务状态机
第二份 conversation store
业务 publication
业务 domain validation
```

业务事实必须留在具体 backend 中。

## 8. Chat Backend Interface

server 通过一个稳定的 backend interface 接入不同业务。

示意接口：

```ts
export interface ChatBackend {
  open(input: unknown): Promise<ChatBinding>;
}

export interface ChatBinding {
  snapshot(): Promise<ChatSnapshot>;

  send(
    input: ChatInput,
    context: ChatOperationContext,
  ): AsyncIterable<ChatEvent>;

  cancel?(operationId: string): Promise<void>;

  close(): Promise<void>;
}
```

如果业务需要少量额外操作，可以后续增加通用 `action.invoke` 机制，而不是把业务命令写进协议本身。

例如 Dayloom 的 `submit` 不应该成为 `dayloom.submit` 协议方法；它可以由 Dayloom adapter 暴露为一个 generic action。

## 9. Chat Protocol V1

协议目标是描述用户可观察的 Chat 行为，而不是暴露后端内部对象。

### 9.1 Client -> Server

V1 建议只包含：

```text
chat.open
message.send
operation.cancel
chat.close
```

其中 `chat.open` 携带 backend 和 opaque context：

```json
{
  "type": "chat.open",
  "backend": "dayloom",
  "context": {}
}
```

### 9.2 Server -> Client

V1 建议只包含：

```text
chat.snapshot
message.added
message.delta
message.completed
operation.started
operation.completed
operation.failed
chat.updated
chat.closed
```

组件不应直接接收具体 backend runtime 的内部对象。

例如以下对象不应进入通用协议：

```text
Dayloom CoreState
DraftSnapshot
ArchiveCommit
Aggregate Head
业务 transaction object
```

## 10. 通用消息模型

V1 可以从最小文本消息开始：

```ts
export interface ChatMessage {
  id: string;
  role: "user" | "assistant" | "system";
  content: ChatContent[];
  createdAt?: string;
}

export type ChatContent = {
  type: "text";
  text: string;
};
```

未来如果确有跨业务需求，再扩展：

```text
image
file
structured block
```

不要提前把特定业务 payload 混入核心 message schema。

## 11. 状态模型

Chat UI 只需要非常有限的状态：

```ts
export interface ChatSnapshot {
  title?: string;
  status?: {
    text?: string;
    busy?: boolean;
    connected?: boolean;
  };
  messages: ChatMessage[];
  capabilities?: {
    send?: boolean;
    cancel?: boolean;
  };
}
```

业务可以决定这些状态的语义，但 WC 只负责显示和执行通用能力。

例如：

```text
"Thinking..."
"Waiting for user"
"Disconnected"
```

均可以作为纯展示状态，而不要求组件理解业务状态机。

## 12. Streaming

streaming 是通用 Chat capability，应由协议原生支持。

典型流程：

```text
message.send
    |
    v
operation.started
    |
    v
message.added
    |
    +--> message.delta
    +--> message.delta
    +--> message.delta
    |
    v
message.completed
    |
    v
operation.completed
```

组件维护当前 streaming message，并负责将 delta 合并到可见 transcript。

外部宿主不需要处理每个 token。

## 13. Cancellation

cancel 是 Chat 交互中少数值得进入通用协议的 operation capability。

组件只知道：

```text
当前 operation 是否可取消
operation.cancel(operationId)
```

取消的真正语义由 backend 决定。

如果 backend 不支持 cancel，snapshot/capabilities 中不暴露该能力。

## 14. Reconnect

V1 不要求客户端拥有复杂的 session recovery manager。

推荐原则：

```text
WebSocket reconnect
      |
      v
重新 chat.open 当前 context
      |
      v
server/backend 返回新的 chat.snapshot
```

snapshot 是重新建立 UI projection 的唯一依据。

组件不应通过猜测本地 transcript 来恢复业务 canonical state。

## 15. Hostra 组合

Hostra 只负责物理宿主能力：

```text
spawn chat-server
open BrowserWindow
close BrowserWindow
observe subprocess lifecycle
```

Hostra 不需要知道 Chat backend 的业务语义。

例如：

```text
Hostra
 |
 +-- process: chat-server
 |
 +-- window A
 |    +-- <lithdoo-chat> -> business context A
 |
 +-- window B
      +-- <lithdoo-chat> -> business context B
```

多个 conversation 可以表现为多个窗口，也可以由更高层业务 shell 决定如何组织。

`<lithdoo-chat>` 本身仍然只处理一个 context。

## 16. Dayloom Adapter 示例

Dayloom 只是通用 Chat Backend 的一个实现。

```text
<lithdoo-chat>
      |
      v
chat-server
      |
      v
Dayloom ChatBackend adapter
      |
      v
@dayloom/core
```

映射可以类似：

```text
chat.open          -> open/create Dayloom Session binding
message.send       -> session send / turn
message.delta      <- Core turn delta
message.completed  <- accepted assistant reply
operation.cancel   -> Core cancel
chat.snapshot      <- Core projection
```

以下 Dayloom 内部概念不进入通用 WC/server 协议：

```text
World
Draft
Candidate
Archive
Publication
Aggregate Head
```

如果产品需要展示这些内容，应通过其他 Web Component 或窗口组合，而不是扩大 Chat component 职责。

## 17. 与 Editor Capability 的一致性

该设计沿用仓库现有 editor capability 的基本结构：

```text
<code-editor>
      |
      v
lsp-ws-server
      |
      v
language server
```

对应 Chat：

```text
<lithdoo-chat>
      |
      v
chat-server
      |
      v
business ChatBackend
```

共同原则是：

```text
Web Component = browser-side capability viewport
Server        = thin transport / process bridge
Backend       = authoritative capability implementation
Hostra        = local window / process orchestrator
```

## 18. 推荐包结构

第一版可以按以下形式组织：

```text
packages/
  chat-component/
    src/
      component/
      protocol/
      index.ts

  chat-server/
    src/
      server.ts
      connection.ts
      backend.ts
      protocol.ts
      cli.ts
```

如果 client/server 之间共享的 protocol schema 逐渐稳定且确有独立复用需求，再抽出：

```text
packages/chat-protocol/
```

第一版不必为了理论分层提前增加 package。

## 19. V1 实现约束

V1 应保持以下约束：

1. 一个 component instance 只绑定一个当前 Chat context。
2. WC 不实现 session discovery / list / switch / rename / delete。
3. server 不保存第二份业务 canonical state。
4. server 不依赖任何具体业务；具体业务通过 ChatBackend adapter 接入。
5. protocol 只描述通用 Chat 可观察行为。
6. streaming 和 cancel 属于通用 operation 能力。
7. title/status 是 display projection，不是业务状态机。
8. 业务专属功能优先通过外部组合或 generic capability/action 扩展。
9. Hostra 只管理 window/process physical lifecycle。
10. 不为了未来假设提前增加 session manager、workspace manager 或 application shell。

## 20. V1 成功标准

第一版完成时，应至少能够证明：

```text
普通浏览器页面可以加载 <lithdoo-chat>
组件可以连接通用 chat-server
chat-server 可以加载一个测试 ChatBackend
用户可以发送文本消息
assistant 回复可以 streaming
可以显示 title/status
支持 backend-declared send/cancel capability
断线重连后可以通过 snapshot 恢复可见状态
同一个组件无需修改即可接入两个不同 ChatBackend
Hostra 可以启动 server 并在窗口中承载组件
```

达到这些条件后，再根据真实业务需求决定 attachment、generic action、rich content 等扩展。

## 21. 一句话定义

> **Lithdoo Chat 是一个单上下文、业务无关、极薄的 Web chat viewport；它通过通用 Chat Protocol 连接薄 server，并由业务 ChatBackend 提供真实语义。会话管理、导航和应用编排属于组件之外。**

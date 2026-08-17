# AGENTS.md — @swifty.js/a2ui 项目记忆

本仓库是 A2UI 官方 monorepo（本机路径 `/Users/hangtiancheng/Documents/a2ui`）中
restaurant-finder 示例的 TypeScript 全栈移植：

- 上游 React 前端：`samples/client/react/shell` → `packages/client`
- 上游 Lit 前端：`samples/client/lit/shell` → `packages/client-lit`
- 上游 Python ADK 后端：`samples/agent/adk/restaurant_finder` → `packages/server`

协议版本固定为 **A2UI v0.9**（catalogId `https://a2ui.org/specification/v0_9/catalogs/basic/catalog.json`）。
`postinstall` 会把官方 basic catalog 下载到根目录 `catalog.json` 备用。

## 结构与运行

- pnpm workspace：`packages/{client,client-lit,server}`；根脚本 `pnpm react` / `pnpm lit`
  （`tsx start.ts`，先起 server 再起客户端）。
- 端口：server `10002`；React dev `5003`（strictPort）；Lit dev `5004`（strictPort）。
- server 需要 `packages/server/.env`（`OPENAI_API_KEY` / `OPENAI_BASE_URL` / `OPENAI_MODEL`），
  参照 `.env.example`；当前指向 OpenAI 兼容端点，接入是真实 LLM，勿改成 mock。

## 协议链路（手写简化版 A2A，未用 @a2a-js/sdk）

- `GET /.well-known/agent-card.json`（`agent-card.ts`，声明 a2ui v0.9 extension）。
- `POST /a2a`：请求体为 A2A message envelope `{message:{messageId, contextId?, role, parts, kind}}`；
  文本查询是 `{kind:"text"}` part，UI 动作是 `{kind:"data", data:{version:"v0.9", action}, mimeType:"application/a2ui+json"}` part。
- 响应统一为 SSE：每个事件 `data: <JSON parts 数组>`；A2UI 消息是 `kind:"data"` part，
  末尾附 `kind:"status-update"`（`input-required`，`submit_booking` 后为 `completed`+final）。
- A2UI 模式由请求头 `X-A2A-Extensions` 包含 `a2ui` 触发；否则走纯文本模式。
- 会话：server 按 `message.contextId` 维护 LLM 对话历史（LRU 100 会话、20 条截断，`handler.ts`）；
  客户端从 status-update 捕获 contextId 并在后续请求回传（React 经 `X-A2A-Context-Id` 头由
  vite middleware 写入 envelope；Lit 直接写入 envelope）。
- React 客户端浏览器只发裸文本/裸 action JSON 到相对路径 `/a2a`，由
  `packages/client/middleware/a2a.ts`（已在 `vite.config.ts` 注册）包 envelope、加扩展头并代理到 10002；
  Lit 客户端自己包 envelope 直连 10002（依赖 server CORS，origin 正则须保持锚定 `/^http:\/\/localhost:\d+$/`）。

## LLM 直出 A2UI（`llm.ts`，核心设计）

- LLM 通过 few-shot 直接生成 `<a2ui-json>...</a2ui-json>` 包裹的 A2UI v0.9 消息数组，
  **没有服务端 UI 模板路径**；booking/确认也经 `buildQueryFromAction` 转成文本 query 走 LLM。
- few-shot 示例由 `a2ui-messages.ts` 的三个 builder（列表/预订表单/确认页）动态生成——
  改 UI 结构改 builder 即可，prompt 会跟着变。
- 输出经结构校验（version/exactly-one-key/surfaceId/catalogId/components 等），失败纠错重试 1 次，
  再失败回退诚实文本道歉；**禁止**回退到硬编码假数据。
- 工具 `get_restaurants(cuisine, location, count)`（`tools.ts`）：数据集仅纽约中餐 8 家，
  location 不含 new york/ny 时返回 `[]`（与上游一致，勿放宽）。
- 已知缺陷（明确不修，注释已标）：LLM 调用非流式，SSE 单事件一次性写出。

## 静态资产

- 餐厅图片不落盘：`GET /static/:name` 由 `image.ts` 按文件名种子确定性生成 identicon SVG。
- hero 图为各客户端 `public/hero.svg` / `hero-dark.svg`（手绘 SVG 资产文件，允许存在）。
- Lit local 预览样例在 `packages/client-lit/public/samples/*.json`。

## 前端编码约定（用户明确要求，必须遵守）

- **Tailwind CSS v4**（`@tailwindcss/vite` 插件）。CSS 文件零手写样式：
  `App.css`/`index.css` 仅含 `@import "tailwindcss"` 与 `@custom-variant dark/light`；
  一切样式用类名表达（含 `index.html` 的 `<body>`：`bg-(image:--background)`、`scheme-light-dark` 等）。
- 暗色模式：JS 切换 `body.dark`/`body.light` 类，配合 `@custom-variant`；
  页面背景渐变经 `--background` 变量注入（React 在 `App.tsx` 设 documentElement；
  Lit 在 `theme/restaurant-theme.ts` 经 adoptedStyleSheets 设 `:root`，其中的 `--a2ui-*`
  变量用于主题化外部 @a2ui/lit 渲染器，需保留且只用具体色值，不引用不存在的 token）。
- **图标只用 lucide**：React 用 `lucide-react` 组件；Lit 用 vanilla `lucide` 的
  `createElement(IconNode)`。禁止手写内联 SVG、禁止 Material Symbols/Google Fonts 外链字体。
  已知后果：`a2ui-surface` 内部（外部渲染器 shadow DOM）的 ligature 图标会显示为文字，接受。
- **Lit 组件用 light DOM**（`createRenderRoot() { return this; }`），删除 `static styles`，
  这样全局 Tailwind 类可直接作用；宿主类名在 `connectedCallback` 里设置（类名字符串写在
  源码里才能被 Tailwind 扫描到）。
- 无障碍（aria/sr-only/role/motion-reduce）**不做要求**，不要主动添加。
- 避免 `transition-all`，用 `transition` 或具体属性变体。

## 验证方式

- 无后端 UI 冒烟：React `http://localhost:5003/?mock=true`；Lit `http://localhost:5004/?app=local`
  （内置样例按钮加载 `public/samples`）。
- 真实链路：起 server 后 curl `POST /a2a`（带 `X-A2A-Extensions: https://a2ui.org/a2a-extension/a2ui/v0.9`），
  依次验证列表 → `book_restaurant` → `submit_booking`（复用 status-update 里的 contextId）；
  非纽约地点应返回"无结果"文案而非捏造数据。每次请求都是真实 LLM 计费调用，注意次数。
- UI 用 playwright-cli 截图核对亮/暗两种模式。

## 其他约定

- git 提交走根脚本 `pnpm git:commit` / `git:push`（固定 message），由用户自行执行。
- 上游对照：探索协议细节时优先读官方仓库 `specification/v0_9/`、
  `renderers/{web_core,react,lit}` 与 `samples/`，勿凭记忆猜测消息结构。

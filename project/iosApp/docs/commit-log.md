# iOS App 提交日志

## 2026-05-09

- 提交: `6da6890` `feat(ios): bootstrap react native baseline`
- 范围: React Native iOS 基础架构与后端连通性冒烟验证
- 说明: 将临时 Swift demo 替换为 `project/iosApp` 下的 React Native 工程，新增一个最小 iOS 页面用于请求 `http://wlzy.online:8090/healthz`，配置 ATS 例外以允许当前 HTTP 域名访问，并调整 Xcode 构建流程，让 Debug 模拟器构建时自动内嵌 JS bundle，不再强依赖 Metro。
- 验证: 已执行 `npm install`、`pod install`；iOS 模拟器 `xcodebuild` 构建成功；App 内成功请求 `/healthz`，返回了 `app=expense-statistics-server`、`env=development` 和服务端时间戳。
- 后续: 等待你确认这个 React Native 基线方案后，再开始正式的 App 模块开发，并继续按提交粒度记录日志。

## 2026-05-09

- 提交: `38bdd73` `chore(ios): restore metro debug workflow`
- 范围: iOS Debug 开发流切回标准 Metro 模式
- 说明: 恢复 `Debug + Metro` 的标准 React Native 开发方式，让 `App.tsx` 等 JS/TS 改动可以通过 Metro 实时刷新；同时补充中文 README，并新增一份“如何切回内嵌 bundle 调试模式”的文档。
- 验证: 已执行 iOS Debug 模拟器 `xcodebuild` 构建，构建成功；构建日志明确显示 Debug + Simulator 跳过内嵌 bundle，改由 Metro 提供 JS bundle。
- 后续: 你确认 Metro 开发流正常后，再开始正式业务开发。

## 2026-05-09

- 提交: 与模块 0 基础架构同次提交
- 范围: iOS 端开发计划文档
- 说明: 阅读前端页面、共享 `api-client` / `domain`、后端 `/api/v1` 路由与现有 iOS 提交日志后，整理出一份简洁的 iOS 开发计划，按接近前端页面的顺序列出模块、开发顺序与每个模块的完成要点。
- 验证: 已人工核对前端路由、页面职责、共享接口定义和后端模块路由。
- 后续: 以这份计划作为正式开发的阶段拆分基础，后续每完成一个模块或一组模块即提交并记录日志。

## 2026-05-09

- 提交: `feat(ios): scaffold module 0 foundation`
- 范围: 模块 0 基础架构
- 说明: 将 `iosApp` 从单文件 demo 入口整理为正式开发结构，建立 `src` 目录、导航骨架、认证上下文、会话持久化、共享 API client 接入、多语言上下文、全局 Toast、Jest 基础测试配置，以及用于后续模块接入的占位页面。
- 验证: 已执行 `npm install`、`pod install`、`npm run lint -- --quiet`、`npm test -- --runInBand --watchman=false`；已执行 iOS Debug 模拟器 `xcodebuild` 构建，目标为 `iPhone 17`，构建成功。
- 后续: 模块 0 提交后，按计划进入模块 1，开始接入真实登录、注册与邀请接受流程。

## 2026-05-09

- 提交: `feat(ios): implement module 1 auth and invitation flow`
- 范围: 模块 1 认证与邀请入口
- 说明: 将登录、三步注册、邀请详情与接受流程替换为真实页面，实现邮箱验证码、验证码验证、注册补全、邀请 token/链接解析、登录后回跳和邀请接受；同时补齐模块 1 所需的多语言文案与基础表单组件。
- 验证: 已执行 `npx tsc --noEmit`、`npm run lint -- --quiet`、`npm test -- --runInBand --watchman=false`；已执行 iOS Debug 模拟器 `xcodebuild` 构建，目标为 `iPhone 17`，构建成功。
- 后续: 按计划进入模块 2，开始实现账本列表。

## 2026-05-09

- 提交: `feat(ios): implement module 2 account book list`
- 范围: 模块 2 账本列表
- 说明: 将 `AccountBooks` tab 替换为真实账本列表页，支持创建账本、设为默认账本、删除账本、退出账本和进入账本详情；补齐模块 2 所需的多语言文案，并把进入详情的导航接到根导航。
- 验证: 已执行 `npx tsc --noEmit`、`npm run lint -- --quiet`、`npm test -- --runInBand --watchman=false`；已执行 iOS Debug 模拟器 `xcodebuild` 构建，目标为 `iPhone 17`，构建成功。
- 后续: 按计划进入模块 3，开始实现个人资料。

## 2026-05-09

- 提交: `4e1cbbe` `feat(ios): implement module 3 profile`
- 范围: 模块 3 个人资料
- 说明: 将个人资料占位页替换为真实编辑页，支持修改用户名、偏好货币、语言、头像路径与默认账本；接入 `updateProfile` / `updateDefaultAccountBook`，并在保存后同步更新会话与语言状态。
- 验证: 已执行 `npx tsc --noEmit`、`npm run lint -- --quiet`、`npm test -- --runInBand --watchman=false`；iOS Debug 模拟器 `xcodebuild` 在当前命令行环境里因 CoreSimulatorService 连接问题未能完成，后续需在本机 Xcode 环境再核验一次。
- 后续: 本模块验证通过后，继续按计划进入模块 4 账本详情与消费列表。

## 2026-05-09

- 提交: `789adc4` `feat(ios): refine theme and book list interactions`
- 范围: iOS 主题与账本列表交互优化
- 说明: 将已完成页面的整体色调调整为更接近 Web 的暖橙主题，新增共享 `colors` 主题文件；优化账本列表交互，改为在列表区域内展开“新建账本”表单，并把删除/退出入口收进账本卡片右上角；同时接入最小 iOS 原生桥接，使用 SF Symbols 显示系统图标。
- 验证: 已执行 `npx tsc --noEmit`、`npm run lint -- --quiet`；原生图标已在本机重新编译后完成显示验证。
- 后续: 提交这轮 UI 收口后，按计划进入模块 4，开始实现账本详情与消费列表。

## 2026-05-10

- 提交: `3ece08f` `feat(ios): implement module 4 account book detail`
- 范围: 模块 4 账本详情与消费列表
- 说明: 将账本详情占位页替换为真实工作台，接入账本详情、成员、分类与消费列表接口；实现账本元信息编辑、删除/退出账本、消费分页、关键词/成员/币种/金额/日期/分类筛选，以及普通消费/合并消费入口和分类快照卡片。
- 验证: 已执行 `npx tsc --noEmit`、`npm run lint -- --quiet`、`npm test -- --runInBand --watchman=false`；命令行环境下尝试 `xcodebuild` 时仍受 CoreSimulator 连接和 DerivedData 权限限制影响，未能完成构建验证，需在本机 Xcode 内再核验一次。
- 后续: 模块 4 提交后，按计划进入模块 5 分类管理。

## 2026-05-10

- 提交: `365bfb7` `fix(ios): refine module 4 expense workspace interactions`
- 范围: 模块 4 账本详情与消费记录交互收口
- 说明: 修复按类别筛选后消费列表重复触发请求、持续显示“加载消费中...”的问题；将消费记录编辑和删除入口改为右上角 SF Symbols 图标；合并账本顶部信息区与消费记录区，压缩顶部垂直高度，并把货币与账本名放到同一行；新增可折叠的“筛选条件”区域，默认收起以缩短页面长度。
- 验证: 已执行 `npx tsc --noEmit`、`npm run lint -- --quiet`。
- 后续: 这轮模块 4 交互修复提交后，继续按计划进入模块 5 分类管理。

## 2026-05-10

- 提交: `feat(ios): implement module 5 expense category management`
- 范围: 模块 5 分类管理
- 说明: 新增从账本详情进入的独立分类管理页，支持普通类别与合并类别分组展示、查看系统预置标记、创建类别、编辑类别、删除类别、颜色预览和类型选择；同时补齐三语文案，并让账本详情在从分类页返回后自动刷新类别快照。
- 验证: 已执行 `npx tsc --noEmit`、`npm run lint -- --quiet`、`npm test -- --runInBand --watchman=false`。
- 后续: 模块 5 提交后，按计划进入模块 6 普通消费。

## 2026-05-10

- 提交: `fix(ios): stabilize expense filters and refine header actions`
- 范围: 账本详情页交互修正
- 说明: 调整消费列表请求触发逻辑，避免相同筛选参数下反复抬起“加载消费中...”提示；将账本详情顶部标题改为账本名，并把货币标记移到标题右侧；把新增普通/合并消费入口合并为单个“新增消费记录”按钮，移动到筛选条件按钮左侧，并新增中转选择页。
- 验证: 已执行 `npx tsc --noEmit`、`npm run lint -- --quiet`、`npm test -- --runInBand --watchman=false`。
- 后续: 等待本机验证这轮交互修正后，再继续模块 6 普通消费。

## 2026-05-10

- 提交: `fix(ios): add in-book navigation and compact expense cards`
- 范围: 账本内导航与详情页交互优化
- 说明: 将账本相关页面重组到“账本”底部 tab 内部栈导航，进入账本详情后保留底部 `账本 / 我的`，并新增账本内的 `消费记录 / 类别管理 / 分析` 导航；同时移除账本详情页重复的大标题行，把货币标记紧贴账本名显示；将消费卡片的币种标记挪到消费名称右侧；删除确认按钮文案统一调整为“确定删除”，以降低误触风险并增强危险操作辨识度。
- 验证: 已执行 `npx tsc --noEmit`、`npm run lint -- --quiet`、`npm test -- --runInBand --watchman=false`。
- 后续: 这轮导航与交互调整确认后，继续按计划进入模块 6 普通消费。

## 2026-05-10

- 提交: `fix(ios): disable empty book tabs and refine profile actions`
- 范围: 底部账本 tab 状态、个人页会话操作与消费卡片紧凑度
- 说明: 基于当前账本会话补全底部五个 tab 的交互逻辑，在未选择账本时将 `消费记录 / 类别管理 / 分析` 置灰并禁用；补上“我的”页面的退出账号按钮，并在退出账号、删除账本、退出账本后同步清空当前账本会话；将“清空全部筛选”文案改为“重制全部筛选条件”；继续压缩消费记录卡片的字号、间距和标签尺寸，减少垂直占用。
- 验证: 已执行 `npx tsc --noEmit`、`npm run lint -- --quiet`、`npm test -- --runInBand --watchman=false`。
- 后续: 这轮交互收口确认后，继续按计划进入模块 6 普通消费。

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

## 2026-05-10

- 提交: `fix(ios): split category creation flow into dedicated screen`
- 范围: 分类管理导航与近期交互修正收口
- 说明: 修复底部账本 tab 的自定义禁用按钮布局问题，恢复与“账本 / 我的”同一行对齐；去掉消费记录卡片底部无内容时残留的空白信息行，并调整合并消费子项为“类别标签 + 消费名”同一行展示；将分类管理页右上角误接到“新增消费记录”的加号按钮删除，把“新建普通类别 / 新建合并类别”合并为单个“新增类别”入口，并将类别新增/编辑表单拆到独立页面，保留底部“类别管理”激活状态，同时在新页面顶部加入返回箭头。
- 验证: 已执行 `npx tsc --noEmit`、`npm run lint -- --quiet`、`npm test -- --runInBand --watchman=false`。
- 后续: 这轮分类管理导航重构提交后，按计划进入模块 6 普通消费。

## 2026-05-10

- 提交: `feat(ios): implement module 6 normal expense editor`
- 范围: 模块 6 普通消费
- 说明: 将普通消费编辑器从占位页替换为真实表单，接入账本详情、普通类别列表、消费详情、创建普通消费和更新普通消费接口；支持新增、编辑、表单校验、创建后返回账本，以及“创建并继续下一条”的连续录入模式；同时补齐普通消费相关的中英日文案和录入提示。
- 验证: 已执行 `npx tsc --noEmit`、`npm run lint -- --quiet`、`npm test -- --runInBand --watchman=false`。
- 后续: 模块 6 提交后，按计划进入模块 7 合并消费。

## 2026-05-10

- 提交: `fix(ios): refine category colors and expense form alerts`
- 范围: 普通消费和类别编辑体验优化
- 说明: 将普通消费里的类别选择改为带颜色点的胶囊按钮；把普通消费表单字段级错误提示改成更鲜红、更醒目的红色；在类别新增/编辑页移除预设色与十六进制输入，改接 iOS 原生 `UIColorWell` 取色器，并补上对应 React Native 原生桥与 Xcode 工程注册。
- 验证: 已执行 `npx tsc --noEmit`、`npm run lint -- --quiet`、`npm test -- --runInBand --watchman=false`。
- 后续: 这轮颜色与表单体验优化提交后，继续按计划进入模块 7 合并消费。

## 2026-05-10

- 提交: `feat(ios): implement module 7 merged expense editor`
- 范围: 模块 7 合并消费
- 说明: 将消费类型入口页精简为选择器，并把普通消费编辑器正式拆到独立文件；新增真实的合并消费编辑页，接入账本详情、类别列表、消费详情、创建合并消费和更新合并消费接口；支持父项与子项表单、税前/税后模式切换、子项动态增删、创建并继续、金额预览与差额提示；同时补齐合并消费相关的中英日文案。
- 验证: 已执行 `npx tsc --noEmit`、`npm run lint -- --quiet`、`npm test -- --runInBand --watchman=false`。
- 后续: 模块 7 提交后，按计划进入模块 8 协作与邀请管理。

## 2026-05-10

- 提交: `fix(ios): polish expense entry and category workflows`
- 范围: 消费录入与分类管理体验收口
- 说明: 将新增消费改为单页内通过单选切换普通消费和合并消费，不再经过独立中转页；新增保存消费后自动刷新消费列表；将普通消费和合并消费的类别选择统一改为下拉式；补充 iOS 原生日历选框桥接，并把消费录入页和消费筛选页的日期输入改成日历选框，同时让日历语言跟随当前 App 语言；类别编辑页禁止修改普通/合并类型并补上底部“保存类别 / 取消”按钮；类别管理列表页新增笔和垃圾桶图标按钮，支持更直观地编辑和删除类别。
- 验证: 已执行 `npx tsc --noEmit`、`npm run lint -- --quiet`、`npm test -- --runInBand --watchman=false`；日期控件语言切换和日历样式需在本机 Xcode 重新编译后验证。
- 后续: 这轮消费录入与分类管理体验收口提交后，按计划进入模块 8 协作与邀请管理。

## 2026-05-10

- 提交: `feat(ios): implement module 8 collaboration management`
- 范围: 模块 8 协作与邀请管理
- 说明: 新增账本协作管理页，并从类别管理页提供“协作管理”入口；接入账本成员、邀请列表、创建邀请、删除邀请、复制邀请链接、转移 owner、移除成员、非 owner 退出账本等完整流程；补齐中英日三语文案，并新增 iOS 原生剪贴板桥接，保证 App 内复制邀请链接可直接用于外部分享。
- 验证: 已执行 `npx tsc --noEmit`、`npm run lint -- --quiet`、`npm test -- --runInBand --watchman=false`；新增原生剪贴板模块后，需要在本机 Xcode 重新编译一次以使复制功能生效。
- 后续: 模块 8 提交后，按计划进入模块 9 数据分析。

## 2026-05-10

- 提交: `feat(ios): implement module 9 analytics`
- 范围: 模块 9 数据分析
- 说明: 将分析 tab 从占位页替换为真实页面，接入类别占比与消费趋势接口；支持按日/按月切换、日期范围切换、最近 30 天/前 30 天/最近 12 个月预设，以及按类别筛选；新增分析页所需的多语言文案与时间范围工具，并用更贴近 iOS 的卡片式条形图和占比条展示结果。
- 验证: 已执行 `npx tsc --noEmit`、`npm run lint -- --quiet`、`npm test -- --runInBand --watchman=false`。
- 后续: 模块 9 提交后，继续进入收尾与发布准备阶段，补齐文档、验证和剩余体验收口。

## 2026-05-10

- 提交: `docs(ios): add release readiness checklist`
- 范围: 模块 10 收尾与发布准备第一轮
- 说明: 更新 `README.md`，把工程现状从基础架构阶段改为当前 0-9 模块已完成状态，并补充关键入口文件说明；新增中文 `release-readiness-checklist.md`，集中整理当前运行方式、ATS/HTTP 现状、真机与模拟器检查项、发布前建议和不应提交的本地文件提醒。
- 验证: 已执行 `npx tsc --noEmit`、`npm run lint -- --quiet`、`npm test -- --runInBand --watchman=false`。
- 后续: 继续模块 10 的体验收口和发布准备，包括空态/错误态统一、真机异常场景复核，以及 App 基础元信息整理。

## 2026-05-10

- 提交: `fix(ios): relocate collaboration entry and redesign analytics`
- 范围: 协作入口、邀请复制链路与分析页重构
- 说明: 将“协作管理”入口从类别管理页挪到账本选择页的每个账本卡片中，并补上根导航直达协作页；修复创建邀请后“复制链接”失败的问题，保留原生剪贴板桥优先，并在原生模块未生效时退化到系统分享；为分析页引入 `react-native-svg`，把类别占比区域改为“预设按钮 + 饼图 + 列表”，把分析筛选并入消费趋势区域且支持折叠/展开，并将消费趋势改为折线图。
- 验证: 已执行 `pod install`、`npx tsc --noEmit`、`npm run lint -- --quiet`、`npm test -- --runInBand --watchman=false`。
- 后续: 由于新增了 `react-native-svg`，需要在本机 Xcode 中重新编译一次，再确认协作入口跳转、邀请链接复制/分享，以及分析页图表显示效果。

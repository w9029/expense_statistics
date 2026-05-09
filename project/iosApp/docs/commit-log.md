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

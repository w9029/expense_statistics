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

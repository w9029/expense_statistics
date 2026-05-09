# iOS 收尾与发布准备清单

本文档用于模块 10 的收尾阶段，帮助你在继续开发或准备 TestFlight 前，快速检查当前 React Native iOS 工程的关键状态。

## 当前功能状态

截至当前提交，`project/iosApp` 已完成：

- 模块 0 基础架构
- 模块 1 认证与邀请入口
- 模块 2 账本列表
- 模块 3 个人资料
- 模块 4 账本详情与消费列表
- 模块 5 分类管理
- 模块 6 普通消费
- 模块 7 合并消费
- 模块 8 协作与邀请管理
- 模块 9 数据分析

最近两个提交：

- `aa90827` `feat(ios): implement module 8 collaboration management`
- `201c8bf` `feat(ios): implement module 9 analytics`

## 当前运行方式

正式开发默认使用 Metro：

```sh
cd project/iosApp
npm install
cd ios && pod install && cd ..
npm start
```

然后在 Xcode 打开：

```text
project/iosApp/ios/ExpenseStatisticsMobile.xcworkspace
```

再选择 `ExpenseStatisticsMobile` scheme，运行到模拟器或真机。

## 已确认的关键工程点

- iOS 端使用 React Native，不是 SwiftUI 页面工程
- 当前已接入共享 `api-client` / `domain`
- 当前支持 `zh-CN` / `en` / `ja`
- 当前已包含少量 iOS 原生桥：
  - `SFSymbolViewManager`
  - `ColorWellViewManager`
  - `DateFieldViewManager`
  - `ClipboardModule`

说明：

- 新增原生桥后，必须在 Xcode 里重新编译一次，不能只靠 Metro 热更新。

## HTTP / ATS 现状

当前 `Info.plist` 已保留对 `wlzy.online` 的 ATS 例外：

- 允许 `wlzy.online` 及其子域名走非 HTTPS
- 没有开启全局任意 HTTP 放行

这意味着当前开发环境可以访问：

- `http://wlzy.online:8090/api/v1`

但发布前仍建议尽快改为 HTTPS，原因：

- Apple 对明文 HTTP 一直更敏感
- 登录、注册、token 刷新、邀请接受都属于敏感流量
- 真机在复杂网络环境下，HTTP 更容易被劫持或拦截

结论：

- 不是“现在完全不能开发”
- 但如果准备长期使用、外部测试或上架，后端最好改成 HTTPS

## 真机 / 模拟器检查清单

每次做较大改动后，建议至少检查一次：

- 登录
- 注册三步流程
- 邀请链接接受
- 账本创建 / 删除 / 退出 / 默认账本
- 普通消费新增 / 编辑 / 删除
- 合并消费新增 / 编辑 / 删除
- 分类新增 / 编辑 / 删除
- 协作邀请创建 / 复制 / 删除
- owner 转移 / 成员移除 / 非 owner 退出账本
- 分析页按日 / 按月切换
- 中文 / 英文 / 日文切换

建议特别关注的异常场景：

- 后端返回 401 后的自动刷新 token
- 弱网下重复点击按钮
- HTTP 接口超时
- 真机从后台切回前台后的页面刷新
- 新增原生桥后的首次重新编译

## 发布前还建议补的内容

- App 名称与图标改为正式品牌名
- 启动图与 Launch Screen 调整为正式版本
- `CFBundleDisplayName` 改为最终展示名称
- 补一轮真机回归，重点看：
  - 剪贴板复制邀请链接
  - 原生日历控件语言
  - 原生取色器
  - SF Symbols 图标显示
- 如果切到 HTTPS，复核：
  - `apiBaseUrl`
  - `Info.plist`
  - 邀请链接复制逻辑

## 当前未提交文件提醒

当前工作区里通常不应提交这些本地文件：

- `project/iosApp/build_ios_app_pack.sh`
- `project/iosApp/ios/ExpenseStatisticsMobile.xcworkspace/xcuserdata/`

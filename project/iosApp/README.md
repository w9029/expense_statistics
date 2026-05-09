# Expense Statistics iOS App

这是当前项目的 React Native iOS 工程，目录在 `project/iosApp`。

目前这个工程已经完成了模块 0 的基础架构整理，并且已经切回标准 React Native 开发模式：

- Debug 模式通过 Metro 提供实时 JS 代码
- 可以在 Xcode 中运行到 iOS 模拟器或真机
- 已建立 `src` 目录与基础分层
- 已接入导航、认证状态、多语言与全局 Toast 骨架
- 已接入共享 `api-client` / `domain`

## 你现在最关心的：怎么在 Xcode 里运行

### 第一次运行前

先进入工程目录：

```sh
cd project/iosApp
```

如果是第一次拉这个 React Native 工程，先安装依赖：

```sh
npm install
cd ios
pod install
cd ..
```

### 在 Xcode 里打开工程

不要打开 `.xcodeproj`，要打开这个文件：

```text
project/iosApp/ios/ExpenseStatisticsMobile.xcworkspace
```

你可以在 Finder 里双击它，也可以在终端里执行：

```sh
open ios/ExpenseStatisticsMobile.xcworkspace
```

### 正式开发时的推荐启动方式

先在 `project/iosApp` 目录启动 Metro：

```sh
npm start
```

保持这个终端不要关。

然后再打开 Xcode：

```sh
open ios/ExpenseStatisticsMobile.xcworkspace
```

### 在 Xcode 里运行到模拟器或真机

1. 打开 `ExpenseStatisticsMobile.xcworkspace`
2. 等 Xcode 完成索引
3. 左上角选中 Scheme：`ExpenseStatisticsMobile`
4. 在 Scheme 右边选择一个模拟器，比如 `iPhone 17`，或者选择你的真机
5. 点击左上角运行按钮，或者按 `Cmd + R`
6. 等待编译完成，模拟器会自动启动并安装 App

如果一切正常，你会看到基础架构壳页面，页面上会显示：

- `Expense Statistics`
- 认证流 / 账本 / 个人资料占位页入口
- 请求成功后的后端返回值

## 当前工程的开发模式

当前已经恢复为标准 React Native 开发流：

- `Debug` 运行时连接 Metro
- 你修改 `App.tsx` 这类 JS/TS 文件后，保存即可触发刷新
- `Release` 仍然会使用打包进 App 的 JS bundle

这意味着现在开发时应当这样使用：

1. 先执行 `npm start`
2. 再用 Xcode `Cmd + R`
3. 修改代码后直接看模拟器或真机自动刷新

## 后续正式开发时的常用命令

在 `project/iosApp` 目录下：

启动 Metro：

```sh
npm start
```

命令行启动 iOS：

```sh
npm run ios
```

安装/更新 iOS 原生依赖后重新执行：

```sh
cd ios
pod install
cd ..
```

## 如果你改了代码但页面没更新

先检查这几项：

- Metro 终端是否还在运行
- 你是否改的是 `project/iosApp` 里的代码，而不是别的目录
- Xcode 当前跑的是 `Debug`，不是 `Release`
- 真机和电脑是否在同一个局域网
- 是否可以在模拟器里按 `R` 触发 reload

如果还是不更新，可以先：

```sh
npm start -- --reset-cache
```

然后重新在 Xcode 里运行一次。

## 如果 Xcode 里运行失败，先检查这几项

- 你打开的是 `.xcworkspace`，不是 `.xcodeproj`
- 你已经执行过 `npm install`
- 你已经执行过 `pod install`
- 当前选中的 Scheme 是 `ExpenseStatisticsMobile`
- 当前目标设备是 iPhone 模拟器或已经配置好的真机

## 切回“内嵌 bundle 调试模式”

如果你以后想回到“不启动 Metro 也能直接运行”的模式，请看：

- `project/iosApp/docs/debug-bundle-mode.md`

## 当前最小验证页面位置

如果你想看当前基础架构入口，主要看这些文件：

- `project/iosApp/App.tsx`
- `project/iosApp/src/app/app-root.tsx`
- `project/iosApp/src/app/providers.tsx`
- `project/iosApp/src/navigation/root-navigator.tsx`
- `project/iosApp/src/features/auth/auth-context.tsx`
- `project/iosApp/src/features/i18n/i18n-context.tsx`

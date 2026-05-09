# 切回内嵌 Bundle 调试模式

这个文档说明如何把当前 React Native iOS 工程，从标准的 `Debug + Metro` 开发模式，切回“Debug 时也直接读取包内 `main.jsbundle`”的模式。

## 什么时候会需要这个模式

这个模式适合下面几种情况：

- 你只是想快速验证 App 能不能独立启动
- 当前电脑网络环境让 Metro 不稳定
- 你想排查“到底是 Metro 问题，还是原生壳问题”

它不适合日常正式开发，因为你修改 `tsx/ts/js` 代码后不会实时更新。

## 需要改的地方

### 1. 修改 AppDelegate.swift

文件：

- `project/iosApp/ios/ExpenseStatisticsMobile/AppDelegate.swift`

把 `DEBUG` 分支改回读取包内 `main.jsbundle`。

当前标准开发模式是：

```swift
#if DEBUG
    RCTBundleURLProvider.sharedSettings().jsBundleURL(forBundleRoot: "index")
#else
    Bundle.main.url(forResource: "main", withExtension: "jsbundle")
#endif
```

切回内嵌 bundle 模式后改成：

```swift
#if DEBUG
    Bundle.main.url(forResource: "main", withExtension: "jsbundle")
#else
    Bundle.main.url(forResource: "main", withExtension: "jsbundle")
#endif
```

### 2. 修改 Xcode Build Phase

文件：

- `project/iosApp/ios/ExpenseStatisticsMobile.xcodeproj/project.pbxproj`

找到 `Bundle React Native code and images` 这个脚本阶段，在脚本前面加回：

```sh
export FORCE_BUNDLING=1
```

也就是改成类似这样：

```sh
set -e

export FORCE_BUNDLING=1

WITH_ENVIRONMENT="$REACT_NATIVE_PATH/scripts/xcode/with-environment.sh"
REACT_NATIVE_XCODE="$REACT_NATIVE_PATH/scripts/react-native-xcode.sh"

/bin/sh -c "\"$WITH_ENVIRONMENT\" \"$REACT_NATIVE_XCODE\""
```

这样即使是 Debug + Simulator，Xcode 也会强制生成并拷贝 `main.jsbundle`。

## 这个模式下怎么运行

1. 打开 Xcode
2. 打开 `ExpenseStatisticsMobile.xcworkspace`
3. 选择模拟器或真机
4. `Cmd + R`

这时即使不启动 Metro，App 也能运行。

## 这个模式的限制

- 你修改 `App.tsx` 后，不会自动刷新成最新内容
- 想看到代码改动，通常需要重新在 Xcode 里构建运行
- `npm start` 窗口里的 reload 对这种模式基本没有帮助

## 如何切回标准开发模式

把上面两个地方恢复即可：

- `DEBUG` 分支重新使用 `RCTBundleURLProvider.sharedSettings().jsBundleURL(forBundleRoot: "index")`
- 删除 `FORCE_BUNDLING=1`

标准模式更适合日常开发，因为它能配合 Metro 做实时刷新。

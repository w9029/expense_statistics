# iOS App Commit Log

## 2026-05-09

- Commit: React Native foundation milestone for iOS baseline verification
- Scope: React Native iOS foundation and backend connectivity smoke test
- Summary: Replaced the temporary Swift demo with a React Native workspace in `project/iosApp`, added a minimal iOS screen that calls `http://wlzy.online:8090/healthz`, configured App Transport Security to allow the current HTTP backend domain, and adjusted the Xcode build so Debug simulator builds embed the JS bundle instead of requiring Metro.
- Validation: `npm install`; `pod install`; `xcodebuild` for the iOS simulator completed successfully; in-app request to `/healthz` succeeded and returned `app=expense-statistics-server`, `env=development`, and a server timestamp.
- Follow-up: Wait for product confirmation on this React Native baseline before starting the real app modules, then begin the staged implementation with commit-by-commit logs.

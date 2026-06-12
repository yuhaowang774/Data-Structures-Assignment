# 西安地铁换乘路径计算器 — Flutter 移动端分支

本分支为 Flutter 移动端应用版本，使用 Dart 实现完整的 Dijkstra 最短路径算法，基于 flutter_map 构建地图可视化界面。

> **项目状态：半成品（WIP）** — 核心查询功能已实现，部分高级功能待开发。详见 [flutter_app/README.md](flutter_app/README.md)。

## 快速开始

### 环境要求

- Flutter 3.24.0+（Dart 3.5.0+）
- Android SDK（API 21+）或 Xcode（iOS 12+）

### 运行步骤

```bash
# 1. 进入 Flutter 工程目录
cd flutter_app

# 2. 安装依赖
flutter pub get

# 3. 运行应用（连接设备或启动模拟器）
flutter run
```

### 构建 APK

```bash
cd flutter_app
flutter build apk --release
```

### 运行测试

```bash
cd flutter_app
flutter test
```

## 项目结构

```
Data-Structures-Assignment/          # 本分支根目录
├── flutter_app/                     # Flutter 工程（主项目）
│   ├── lib/                         # Dart 源码
│   │   ├── main.dart                # 应用入口
│   │   ├── models/                  # 数据模型
│   │   ├── services/                # 算法与数据加载
│   │   ├── pages/                   # 页面
│   │   └── widgets/                 # UI 组件
│   ├── assets/data/                 # 内置数据文件
│   ├── test/                        # 单元测试
│   └── README.md                    # 详细项目文档
├── doc/                             # 设计文档
│   ├── 2026-05-11-flutter-app-design.md   # Flutter 分支设计方案
│   └── 2026-05-11-flutter-app-plan.md     # Flutter 分支实施计划
└── .gitignore
```

## 注意事项

- **主项目代码在 `flutter_app/` 目录下**，根目录下的其他文件（`metro_router/`、`compare/`、`*.json`、`*.py` 等）为 master 分支的遗留文件，不影响 Flutter 应用运行
- 数据文件 `graph.json` 和 `routes.json` 内嵌在 `flutter_app/assets/data/` 中，应用启动时自动加载，无需额外配置
- 地图使用高德瓦片服务，需要网络连接；离线状态下地图无法显示，但路径查询功能仍可使用
- 数据文件中站点坐标为 WGS84 坐标系，应用内置 WGS84→GCJ02 坐标转换，确保地图标注位置准确

## 分支体系

| 分支 | 定位 | 技术栈 | 状态 |
|------|------|--------|------|
| `master` | C + Python + Flask 全栈 Web 应用 | C (Dijkstra) + Flask + Leaflet | 功能完整 |
| `pure-frontend` | 纯前端静态版本 | JavaScript + Leaflet + 内置 JSON | 功能完整 |
| `flutter-app` | Flutter 移动端应用 | Flutter/Dart + flutter_map | 半成品 |

**分支间完全隔离，切换分支即切换项目形态。**

## 许可证

本项目仅供学习和教学使用。

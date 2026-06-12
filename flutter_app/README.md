# 西安地铁换乘路径计算器 — Flutter 移动端

基于 Flutter 框架的西安地铁换乘路径查询移动应用，使用 Dart 实现完整的 Dijkstra 最短路径算法、最小堆和图结构，集成地图显示和路线查询功能。支持 Android 和 iOS 平台。

> **项目状态：半成品（WIP）** — 核心功能已实现，部分高级功能待开发。详见[后续开发计划](#后续开发计划)。

## 主要功能

### 已实现

- **时间最短路径查询** — 以乘车时间为权重，Dijkstra 算法计算最快路线
- **换乘最少路径查询** — 以换乘次数为权重，计算换乘最少的路线
- **地图可视化** — 基于 flutter_map + 高德瓦片，显示全部地铁线路和站点
- **路径高亮** — 查询结果以红色虚线绘制在地图上，换乘站以橙色圆点标记
- **站点搜索** — 中文子串匹配，实时过滤，最多显示 8 条建议
- **WGS84→GCJ02 坐标转换** — 内置坐标转换，确保地图标注准确

### 未实现（对比 master 分支）

- 综合最优路径查询（mode=2）
- 备用方案生成
- 时段调度权重调整
- Dijkstra 算法过程可视化
- 高德地铁路径对比分析

## 技术架构

```
Flutter 3.24+ / Dart 3.5+
├── flutter_map ^7.0.0    # 地图渲染
├── latlong2 ^0.9.0       # 坐标处理
└── Material Design 3      # UI 框架
```

### 应用结构

```
全屏地图 + DraggableScrollableSheet 交互模式

┌────────────────┐
│                │
│   FlutterMap   │  ← TileLayer + PolylineLayer + CircleLayer
│   (全屏地图)    │
│                │
├────────────────┤
│ SearchPanel    │  ← 起点/终点输入 + 查询按钮
│ ResultPanel    │  ← 换乘详情展示
└────────────────┘
  BottomSheet (0.08 / 0.35 / 0.50 三档吸附)
```

### 数据流

```
assets/data/graph.json ──┐
assets/data/routes.json ──┤
                          ▼
                   DataLoader.loadData()
                    ┌─────┴─────┐
                    ▼           ▼
             deriveStations()  parseRoutes()
             → List<Station>   → List<Route>
                    │           │
                    │           └→ PolylineLayer（线路绘制）
                    └→ SearchPanel（搜索数据源）
                    │
                    ▼
             buildAdjList(nodes, edges)
                    │
                    ▼
             dijkstra(adjList, nodes, start, end, mode)
                    │
              ┌─────┼─────┐
              ▼     ▼     ▼
       buildSegments  │  MapView.updatePath()
       → PathSegment  │  (路径高亮 + 换乘标记)
              │       │
              ▼       ▼
        ResultPanel  (地图更新)
```

## 项目结构

```
flutter_app/
├── lib/
│   ├── main.dart                     # 应用入口
│   ├── models/
│   │   ├── station.dart              # Station 模型
│   │   └── route.dart                # Route / RoutePoint 模型
│   ├── services/
│   │   ├── data_loader.dart          # JSON 加载 + 站点派生 + 路线解析
│   │   ├── pathfinding.dart          # MinHeap + GraphEdge + Dijkstra + PathSegment
│   │   └── coord_transform.dart      # WGS84→GCJ02 坐标转换
│   ├── pages/
│   │   └── home_page.dart            # 主页面（地图 + BottomSheet 集成）
│   └── widgets/
│       ├── map_view.dart             # 地图组件（flutter_map 封装）
│       ├── search_panel.dart         # 搜索面板（起点/终点输入）
│       └── result_panel.dart         # 结果面板（换乘详情展示）
├── assets/
│   └── data/
│       ├── graph.json                # 图结构数据（289 节点 / 636 边）
│       └── routes.json               # 线路信息（13 条线路）
├── test/
│   ├── models/
│   │   ├── station_test.dart
│   │   └── route_test.dart
│   ├── services/
│   │   ├── data_loader_test.dart
│   │   └── pathfinding_test.dart
│   └── widgets/
│       └── search_panel_test.dart
├── pubspec.yaml
└── analysis_options.yaml
```

## 安装与运行

### 环境要求

- Flutter 3.24.0+（Dart 3.5.0+）
- Android Studio / VS Code + Flutter 插件
- Android SDK（API 21+）或 Xcode（iOS 12+）

### 安装步骤

```bash
# 1. 克隆仓库并切换到 flutter-app 分支
git clone https://github.com/<your-username>/Data-Structures-Assignment.git
cd Data-Structures-Assignment
git checkout flutter-app

# 2. 进入 Flutter 工程目录
cd flutter_app

# 3. 安装依赖
flutter pub get

# 4. 运行应用（连接设备或启动模拟器）
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

## 核心算法

### Dijkstra 路径搜索

| 模式 | 代价函数 | 说明 |
|------|----------|------|
| mode=0 | `cost = totalTime` | 时间最短，权重为乘车时间 |
| mode=1 | `cost = transferCount + totalTime × 1e-6` | 换乘最少，transferCount 优先 |

- 使用自定义 `MinHeap` 实现优先队列
- 支持多起点（换乘站有多个状态节点）
- 换乘边（`is_transfer=1`）权重为 0，mode=1 时通过代价函数施加惩罚

### 坐标转换

数据文件中站点坐标为 WGS84 坐标系，而高德地图瓦片使用 GCJ-02 坐标系。`coord_transform.dart` 实现了 WGS84→GCJ02 转换，确保地图标注位置准确。

## 分支体系

本项目包含三个分支，分别对应不同的技术方案：

| 分支 | 定位 | 技术栈 | 状态 |
|------|------|--------|------|
| `master` | C + Python + Flask 全栈 Web 应用 | C (Dijkstra) + Flask + Leaflet | 功能完整 |
| `pure-frontend` | 纯前端静态版本 | JavaScript + Leaflet + 内置 JSON | 功能完整 |
| `flutter-app` | Flutter 移动端应用 | Flutter/Dart + flutter_map | 半成品 |

**分支间完全隔离，切换分支即切换项目形态。**

### master 分支特点

- C 语言核心算法，性能最优
- Flask 后端提供 RESTful API
- 完整的对比测试系统（本地 vs 高德）
- 数据可从 Shapefile 重建
- Dijkstra 算法过程可视化
- 时段调度权重调整

### pure-frontend 分支特点

- 零后端依赖，打开 `index.html` 即可运行
- JavaScript 实现 Dijkstra 算法
- Node.js 版对比测试工具
- 适合快速演示和静态部署

## 后续开发计划

基于 master 和 pure-frontend 分支已实现的功能，flutter-app 分支的后续开发计划如下：

### 优先级高

1. **综合最优路径查询（mode=2）**
   - master 分支已实现：代价函数 `cost = time × 1000 + transfers`
   - 当前 `pathfinding.dart` 的 `dijkstra()` 函数仅支持 mode=0/1，需添加 mode=2 分支
   - SearchPanel 需增加"综合最优"按钮

2. **备用方案生成**
   - master 分支已实现：基于惩罚因子的 Dijkstra 生成多条备选路线
   - 需在 pathfinding.dart 中实现 `findAlternativePaths()` 函数
   - ResultPanel 需支持多路线切换展示

3. **时段调度权重调整**
   - master 分支已实现：5 个时段（早高峰/晚高峰/午间平峰/早间平峰/晚间平峰），peak/offpeak 两类系数
   - 需新增 ScheduleConfig 面板组件
   - 需在 Dijkstra 代价函数中集成时段权重乘数

### 优先级中

4. **Dijkstra 算法过程可视化**
   - master 分支已实现：前端逐步展示算法搜索过程
   - 需在 MapView 中添加动画层，逐步显示已访问节点和当前搜索边界
   - 需添加播放/暂停/步进控制

5. **高德地铁路径对比分析**
   - master 分支已实现：Python 版对比测试系统
   - 需在 Dart 中实现高德 API 调用和结果比较
   - 或采用混合方案：Flutter 调用后端 API 获取对比结果

### 优先级低

6. **地图点击选站**
   - 设计文档已规划：点击站点 Marker 弹出"设为起点/设为终点"对话框
   - 需在 MapView 中添加 MarkerLayer 和点击事件处理

7. **iOS 平台适配**
   - 当前工程已包含 iOS 配置文件，但未在真机测试
   - 需验证 flutter_map 在 iOS 上的表现

8. **离线地图缓存**
   - 提升弱网环境下的用户体验
   - 可使用 flutter_map 的缓存插件

## 许可证

本项目仅供学习和教学使用。

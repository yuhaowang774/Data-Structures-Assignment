# Flutter 移动端分支设计方案

> 日期：2026-05-11
> 状态：已确认

## 一、概述

在现有西安地铁换乘最优路径计算器项目中，新增一个独立的 Flutter 移动应用分支 `flutter-app`，将核心功能迁移到 Android 平台。

### 三分支体系

| 分支 | 定位 | 技术栈 |
|------|------|--------|
| `master` | 前后端一体 Web 应用 | Flask + C + Jinja2 + Leaflet |
| `pure-frontend` | 纯前端静态版本 | HTML/JS + Leaflet + 内置 JSON |
| `flutter-app` | 独立 Flutter 移动应用 | Flutter/Dart + flutter_map + 内置 JSON |

**关键原则：分支间完全隔离，切换分支即切换项目形态。**

---

## 二、分支与目录结构

```
flutter-app 分支：
c:\Users\WYH01\Desktop\数据结构课程作业\
├── flutter_app/                  # Flutter 工程根目录（flutter create 生成）
│   ├── pubspec.yaml
│   ├── analysis_options.yaml
│   ├── lib/
│   │   ├── main.dart
│   │   ├── models/
│   │   │   ├── station.dart
│   │   │   └── route.dart
│   │   ├── services/
│   │   │   ├── data_loader.dart
│   │   │   └── pathfinding.dart
│   │   ├── pages/
│   │   │   └── home_page.dart
│   │   └── widgets/
│   │       ├── search_panel.dart
│   │       └── result_panel.dart
│   ├── assets/
│   │   └── data/
│   │       ├── graph.json          # 从 pure-frontend 复用
│   │       └── routes.json         # 从 pure-frontend 复用
│   ├── android/
│   └── test/
│       └── widget_test.dart
└── .gitignore                      # Flutter 专用
```

---

## 三、模块职责

### 3.1 main.dart

- 入口，配置 `MaterialApp`
- 禁用原生 AppBar，全屏沉浸体验
- 路由到 `HomePage`

### 3.2 models/station.dart

```dart
class Station {
  final String name;
  final double lat, lon;
  final List<String> lines;
  final bool isTransfer;
}
```

- `lines`：从 `graph.json` 按 `station` 去重汇总，收集所有 `line` 字段
- `isTransfer`：`lines.length > 1` 推导

### 3.3 models/route.dart

```dart
class RoutePoint {
  final String name;
  final double lat, lon;
}

class Route {
  final String name;
  final String color;
  final List<RoutePoint> stations;
}
```

- `stations` 是有序坐标点序列，用于绘制线路 Polyline

### 3.4 services/data_loader.dart

```dart
class DataLoader {
  static Future<Map<String, dynamic>> loadData(BuildContext context) async {
    String graphStr = await DefaultAssetBundle.of(context)
        .loadString('assets/data/graph.json');
    String routesStr = await DefaultAssetBundle.of(context)
        .loadString('assets/data/routes.json');

    return {
      'graph': json.decode(graphStr),
      'routes': json.decode(routesStr),
    };
  }
}

/// 从 graph.json 的 nodes 数组按 station 字段去重派生站点列表
///
/// 去重规则：
///   - 按 station 字段 GroupBy，每个 group 生成一个 Station
///   - Station.lat/lon 取 group 中第一个节点的坐标（确定性行为，不依赖外部顺序）
///   - Station.lines 收集 group 中所有 line 字段，去重
///   - Station.isTransfer = lines.length > 1
List<Station> deriveStations(List<dynamic> graphNodes) { ... }
List<Route> parseRoutes(List<dynamic> routesData) { ... }
```

- 启动时在 `HomePage.initState` 中通过 `FutureBuilder` 调用
- `deriveStations`：遍历 `graph.json` 的 `nodes`，按 `station` 名去重，汇总 `lines`
- 坐标取 group 内**第一个节点**的值（消除"首次出现依赖 JSON 顺序"的歧义——虽然本质仍依赖 JSON 数组顺序，但已在规范中显式声明，测试可通过固定顺序的 fixture 数据覆盖）
- `parseRoutes`：解析 `routes.json`，生成 `Route` 对象列表

### 3.5 services/pathfinding.dart

合并了图结构和 Dijkstra 算法，单一文件承载：

```dart
class MinHeap<T> { ... }

/// 路径中的一个节点引用，映射 graph.json nodes 数组中的单条记录
class NodeRef {
  final int id;
  final String station;
  final String line;
  final double lon, lat;
}

class GraphEdge {
  final int to;
  final double weight;
  final String line;
  final int isTransfer;      // 0=普通边, 1=换乘边(weight=0)
}

List<List<GraphEdge>> buildAdjList(List<dynamic> nodes, List<dynamic> edges) { ... }

class PathResult {
  final List<NodeRef> path;            // 路径节点序列
  final double totalTime;              // 总耗时(分钟)
  final int transferCount;             // 换乘次数
  final List<String> transferStations; // 换乘站名列表
  final int stationCount;              // 去重站点数
  final String? error;
}

class PathSegment {
  final String fromStation;
  final String toStation;
  final String line;
  final double duration;   // 该段耗时(分钟)
}

PathResult dijkstra(
  List<List<GraphEdge>> adjList,
  List<dynamic> nodes,
  String startName,
  String endName,
  int mode,
) { ... }

/// 从 PathResult.path 推导分段列表
List<PathSegment> buildSegments(PathResult result) { ... }
```

- 算法逻辑与 `pure-frontend` 的 `script.js` 中 `dijkstra()` 保持一致
- `mode=0`（时间最短）：`cost = totalTime`，即普通边权重累积
- `mode=1`（换乘最少）：`cost = transferCount + totalTime * 1e-6`，transferCount 优先
- `transferStations` 推导规则：遍历 path，当 `station[i]==station[i-1] && line[i]!=line[i-1]` 时为换乘站（排除首尾）
- `buildSegments` 按 line 字段变化切分 path，连续同线路节点合并为一段 `PathSegment`
- `buildAdjList` 内部使用 `List<Map<String, dynamic>>`（原始 JSON 解码类型），不从 dynamic 访问字段名。测试需通过 fixture 数据覆盖 nodes/edges 的键名拼写，防止运行时类型错误

### 3.6 pages/home_page.dart

```
HomePage (StatefulWidget)
├── 持有全部数据（仅加载时 setState 一次）
├── 持有 DraggableScrollableController
├── 持有 MapController（通过 GlobalKey 访问 MapView）
│
├── FlutterMap (全屏)
│   └── MapView (StatefulWidget, GlobalKey)
│       ├── TileLayer（高德瓦片）
│       ├── PolylineLayer（所有线路 + 查询结果路径）
│       ├── CircleLayer（站点圆点）
│       └── MarkerLayer（换乘站标记）
│
└── DraggableScrollableSheet
    ├── snapSizes: [0.08, 0.35, 0.50]
    ├── snap: true
    └── child:
        ├── SearchPanel（起点/终点输入 + 查询按钮）
        └── ResultPanel（换乘详情展示）
```

**状态流转：**

| 阶段 | BottomSheet 高度 | 地图 |
|------|-----------------|------|
| 初始 | 0.08（仅手柄） | 显示全部线路，西安中心视口 |
| 输入 | 0.50（半屏） | 保持 |
| 结果 | 0.35 | 清除旧路径，绘制新路径，`fitCamera` 适配路径范围 |
| 收起 | 0.08 | 清除查询路径，恢复全景 |

**回调链：**

```
SearchPanel.onSearch(start, end, mode)
  → HomePage 调用 dijkstra(adjList, nodes, start, end, mode)
  → buildSegments(result)
  → MapView.updatePath(polyline, markers)   // 地图更新
  → setState(() { _result = result;
                   _segments = segments; })  // ResultPanel 更新
  → controller.animateTo(0.35)              // 收起面板
```

### 3.7 widgets/search_panel.dart

- 两个 `TextField`：起点站、终点站
- **过滤规则**：中文子串匹配（`station.name.contains(input)`），不区分外文大小写，不支持拼音首字母
- **空输入行为**：不显示下拉列表
- 输入时实时过滤站点列表（最多显示 8 条，超出可滚动），下拉覆盖在输入框下方
- 点击下拉项填入对应输入框并关闭下拉
- 两个 `ElevatedButton`："时间最短"/"换乘最少"
- **按钮点击前校验**：
  - 起点/终点为空 → `SnackBar`："请选择起点站/终点站"
  - 起点 = 终点 → `SnackBar`："起点和终点不能相同"

### 3.8 widgets/result_panel.dart

- 纯展示组件，无状态，接收 `PathResult` 和 `List<PathSegment>`
- 显示：总耗时（分钟）、换乘次数、换乘站列表、分段列表
- 分段列表来自 `buildSegments(result)`，每段显示"fromStation → toStation (line, duration分钟)"
- 无结果时（error != null）显示错误提示

---

## 四、数据流

```
assets/data/graph.json ──┐
assets/data/routes.json ──┤
                          │
                          ▼
                   DataLoader.loadData()
                          │
                  ┌───────┴───────┐
                  ▼               ▼
           deriveStations()  parseRoutes()
           → List<Station>    → List<Route>
                  │               │
                  │               └──→ PolylineLayer（初始线路）
                  │
                  └──→ SearchPanel 下拉数据源
                  │
                  ▼
           buildAdjList(graphNodes, graphEdges)
                  │
                  ▼
           dijkstra(adjList, nodes, start, end, mode)
                  │
                  ▼
           PathResult { path, totalTime, transferCount, transferStations, stationCount }
                  │
         ┌────────┼────────┐
         ▼        ▼        ▼
   buildSegments  │   MapView.updatePath()
   → List<PathSegment>
         │        │
         ▼        ▼
   ResultPanel   (Polyline + Marker)
```

- 无状态管理库，仅 `setState` + 回调
- `MapView` 独立管理自己的地图层状态，不因搜索面板操作而 rebuild

---

## 五、地图配置

### 5.1 瓦片

```dart
TileLayer(
  urlTemplate: 'https://webrd0{s}.is.autonavi.com/appmaptile'
               '?lang=zh_cn&size=1&scale=1&style=8&x={x}&y={y}&z={z}',
  subdomains: ['1', '2', '3', '4'],
)
```

- GCJ-02 坐标系，与数据文件一致，无需坐标转换

### 5.2 图层结构

```dart
FlutterMap(
  options: MapOptions(
    initialCenter: LatLng(34.261, 108.942),
    initialZoom: 12.0,
    minZoom: 10.0,
    maxZoom: 18.0,
  ),
  children: [
    TileLayer(...),                 // 底图瓦片
    PolylineLayer(polylines: [      // 所有地铁线路（始终显示）
      ...allRoutePolylines,
      ...queryResultPolyline,       // 查询结果高亮（动态）
    ]),
    CircleLayer(circles: [...]),    // 站点圆点
    MarkerLayer(markers: [...]),    // 换乘站特殊标记
  ],
)
```

### 5.3 依赖

```yaml
dependencies:
  flutter:
    sdk: flutter
  flutter_map: ^7.0.0
  latlong2: ^0.9.0
```

---

## 六、交互流程

```
初始状态                输入状态                 结果状态
全屏地图 + 小条手柄     半屏搜索面板             结果面板

┌────────────┐         ┌────────────┐          ┌────────────┐
│            │         │            │          │            │
│            │         │            │          │            │
│   🗺️ 地图  │         │  🗺️ 地图  │          │  🗺️ 地图  │
│            │         │            │          │  ═══路径═══│
│            │         ├────────────┤          ├────────────┤
│ ══════════ │         │[起点____▼]│          │35分钟 换乘2│
│ ═══  ═══  │         │[终点____▼]│          │1. 纺织城→北│
└────────────┘         │[最短][最少]│          │2. 北大街→小│
  0.08                  └────────────┘          │3. 小寨→航天│
                         0.50                   └────────────┘
                                                 0.35
```

### 搜索输入交互

| 操作 | 行为 |
|------|------|
| 输入文字 | 实时过滤站点，显示下拉列表 |
| 点击下拉项 | 填入输入框，关闭下拉 |
| 地图点击站点 Marker | 弹出 Dialog："设为起点 / 设为终点" |
| 切换输入框焦点 | 对应用户选中的输入框 |

### DraggableScrollableSheet

- `snap: true`
- `snapSizes: [0.08, 0.35, 0.50]`
- 查询完成后 `controller.animateTo(0.35)` 自动收起

---

## 七、错误处理

| 场景 | 处理方式 |
|------|----------|
| JSON 加载失败 | `ErrorWidget`："数据加载失败，请重新启动应用" |
| 起点/终点为空 | `SnackBar` 提示"请选择起点站/终点站" |
| 起点 = 终点 | `SnackBar` 提示"起点和终点不能相同" |
| 无路径可达 | 结果面板显示"未找到可达路径" |
| 无网络（瓦片加载失败） | 地图空白，`SnackBar` 提示"请检查网络连接" |

---

## 八、数据文件说明

### 8.1 graph.json（从 pure-frontend 复用）

```json
{
  "nodes": [
    {"id": 0, "station": "纺织城", "line": "地铁1号线", "lon": 109.078, "lat": 34.273}
  ],
  "edges": [
    {"from": 0, "to": 1, "weight": 1.85, "line": "地铁1号线", "is_transfer": 0}
  ]
}
```

- 用于：Dijkstra 计算 + 派生 Station 列表
- 换乘边（`is_transfer=1`）权重为 0，mode=1 时施加惩罚

### 8.2 routes.json（从 pure-frontend 复用）

```json
{
  "routes": [
    {
      "name": "地铁1号线",
      "color": "#0079C2",
      "stations": [
        {"name": "纺织城", "lat": 34.273, "lon": 109.078}
      ]
    }
  ]
}
```

- 用于：绘制地铁线路 Polyline（初始状态始终显示）
- 每条线路的颜色从 `color` 字段读取

### 8.3 Station 字段推导逻辑

```
graph.nodes 按 station 分组
  → Station.name = 该组的 station 名称
  → Station.lat  = 该组第一个节点的 lat
  → Station.lon  = 该组第一个节点的 lon
  → Station.lines = 收集该组所有节点的 line 字段，去重
  → Station.isTransfer = lines.length > 1
```

---

## 九、Git 分支创建流程

```
1. git checkout master              # 切换到 master
2. git checkout -b flutter-app      # 创建 flutter-app 分支
3. 删除除 doc/、.gitignore 外的所有文件
4. 在根目录创建 flutter_app/ 工程
5. git add flutter_app/ .gitignore
6. git commit -m "feat: init Flutter mobile app branch"
```

---

## 十、复用的现有资产

| 资产 | 来源 | 用途 |
|------|------|------|
| `graph.json` | `pure-frontend/data/graph.json` | Dijkstra 图数据 + 站点派生 |
| `routes.json` | `pure-frontend/data/routes.json` | 线路绘制 Polyline |
| 高德瓦片 URL | `pure-frontend/script.js` | 地图底图 |
| Dijkstra 算法逻辑 | `pure-frontend/script.js` | 路径计算 |

---

## 十一、不涉及的内容（YAGNI）

- ❌ 后端 API 调用
- ❌ Provider / Riverpod / BLoC 等状态管理库
- ❌ iOS 平台适配
- ❌ 离线地图缓存
- ❌ 多城市切换
- ❌ 用户定位
- ❌ 导航/路线引导

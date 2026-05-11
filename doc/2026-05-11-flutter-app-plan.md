# Flutter 移动端分支实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在 `flutter-app` 分支上创建完整的 Flutter Android 应用，复刻西安地铁换乘最优路径计算器。

**Architecture:** 全屏地图 + Bottom Sheet 交互模式。内置静态 JSON 数据，Dart 实现 Dijkstra 算法。Widget 拆分避免不必要的 rebuild，无状态管理库。

**Tech Stack:** Flutter 3.24.0 / Dart 3.5.0, flutter_map ^7.0.0, latlong2 ^0.9.0

**Design Spec:** `doc/2026-05-11-flutter-app-design.md`

---

## File Structure

```
c:\Users\WYH01\Desktop\数据结构课程作业\
├── flutter_app/
│   ├── pubspec.yaml                          # Task 2
│   ├── lib/
│   │   ├── main.dart                         # Task 14
│   │   ├── models/
│   │   │   ├── station.dart                  # Task 3
│   │   │   └── route.dart                    # Task 4
│   │   ├── services/
│   │   │   ├── data_loader.dart              # Task 5-6
│   │   │   └── pathfinding.dart              # Task 7-10
│   │   ├── pages/
│   │   │   └── home_page.dart                # Task 13
│   │   └── widgets/
│   │       ├── map_view.dart                 # Task 11
│   │       ├── search_panel.dart             # Task 12
│   │       └── result_panel.dart             # Task 12
│   ├── assets/
│   │   └── data/
│   │       ├── graph.json                    # Task 2
│   │       └── routes.json                   # Task 2
│   ├── test/
│   │   ├── models/
│   │   │   ├── station_test.dart             # Task 3
│   │   │   └── route_test.dart               # Task 4
│   │   ├── services/
│   │   │   ├── data_loader_test.dart         # Task 5-6
│   │   │   └── pathfinding_test.dart         # Task 7-10
│   │   └── widgets/
│   │       └── search_panel_test.dart        # Task 12
│   └── android/                              # Task 2 (flutter create 生成)
└── .gitignore                                # Task 1
```

---

### Task 1: Git 分支创建与清理

**Files:**
- Modify: `.gitignore`
- Delete: 除 `doc/` 和 `.gitignore` 外的所有文件

- [ ] **Step 1: 切换到 master 并创建 flutter-app 分支**

```bash
cd c:\Users\WYH01\Desktop\数据结构课程作业
git checkout master
git checkout -b flutter-app
```

- [ ] **Step 2: 删除 master 分支的所有文件（保留 doc/ 和 .gitignore）**

```bash
git rm -r --cached metro_router/ amap_line8_line15.json amap_stations_result.json fetch_osm_data.py generate_line8_line15.py osm_stations_result.json osm_xian_stations.json 2>$null
```

注意：`CPTOND-2025/` 目录如果已在 .gitignore 中则无需处理，否则也需 `git rm -r --cached CPTOND-2025/`。

- [ ] **Step 3: 写入 Flutter 专用 .gitignore**

```gitignore
# Flutter
.dart_tool/
.flutter-plugins
.flutter-plugins-dependencies
**/build/
**/doc/api/
**/ios/Flutter/Flutter.podspec
**/ios/.generated/
**/ios/Flutter/App.framework
**/ios/Flutter/Flutter.framework
**/ios/Flutter/Flutter.podspec
**/ios/Flutter/Generated.xcconfig
**/ios/Flutter/ephemeral/
**/ios/ServiceDefinitions.json
**/ios/Runner/GeneratedPluginRegistrant.*

# Dart
*.packages
.pub-cache/
.pub/
**/pubspec.lock

# Android
**/android/local.properties
**/android/.gradle/
**/android/captures/
**/android/gradlew
**/android/gradlew.bat
**/android/gradle/wrapper/gradle-wrapper.jar
**/android/**/GeneratedPluginRegistrant.java
**/android/app/debug
**/android/app/profile
**/android/app/release
*.jks
*.keystore

# General
*.class
*.log
*.pyc
__pycache__/
.DS_Store
Thumbs.db
.idea/
.vscode/
*.iml
```

- [ ] **Step 4: 提交**

```bash
git add -A
git commit -m "chore: init flutter-app branch, clean up master files"
```

---

### Task 2: Flutter 工程脚手架与数据文件

**Files:**
- Create: `flutter_app/` (flutter create 生成)
- Create: `flutter_app/assets/data/graph.json`
- Create: `flutter_app/assets/data/routes.json`
- Modify: `flutter_app/pubspec.yaml`

- [ ] **Step 1: 创建 Flutter 工程**

```bash
cd c:\Users\WYH01\Desktop\数据结构课程作业
flutter create flutter_app
```

- [ ] **Step 2: 从 pure-frontend 分支提取数据文件**

```bash
cd c:\Users\WYH01\Desktop\数据结构课程作业
New-Item -ItemType Directory -Force -Path flutter_app\assets\data
git show pure-frontend:data/graph.json > flutter_app\assets\data\graph.json
git show pure-frontend:data/routes.json > flutter_app\assets\data\routes.json
```

- [ ] **Step 3: 修改 pubspec.yaml — 添加依赖和 assets 声明**

将 `flutter_app/pubspec.yaml` 替换为：

```yaml
name: flutter_app
description: 西安地铁换乘最优路径计算器
publish_to: 'none'
version: 1.0.0+1

environment:
  sdk: '>=3.5.0 <4.0.0'

dependencies:
  flutter:
    sdk: flutter
  flutter_map: ^7.0.0
  latlong2: ^0.9.0

dev_dependencies:
  flutter_test:
    sdk: flutter
  flutter_lints: ^4.0.0

flutter:
  uses-material-design: true
  assets:
    - assets/data/graph.json
    - assets/data/routes.json
```

- [ ] **Step 4: 运行 flutter pub get 验证依赖**

```bash
cd c:\Users\WYH01\Desktop\数据结构课程作业\flutter_app
flutter pub get
```

Expected: 依赖解析成功，无错误

- [ ] **Step 5: 删除 flutter create 生成的默认测试文件（后续会重写）**

```bash
Remove-Item flutter_app\test\widget_test.dart -ErrorAction SilentlyContinue
```

- [ ] **Step 6: 提交**

```bash
cd c:\Users\WYH01\Desktop\数据结构课程作业
git add flutter_app/
git commit -m "chore: scaffold Flutter project with data files and dependencies"
```

---

### Task 3: Station 模型

**Files:**
- Create: `flutter_app/lib/models/station.dart`
- Create: `flutter_app/test/models/station_test.dart`

- [ ] **Step 1: 写失败测试**

创建 `flutter_app/test/models/station_test.dart`：

```dart
import 'package:flutter_test/flutter_test.dart';
import 'package:flutter_app/models/station.dart';

void main() {
  group('Station', () {
    test('creates from constructor', () {
      final station = Station(
        name: '北大街',
        lat: 34.27,
        lon: 108.95,
        lines: ['地铁1号线', '地铁2号线'],
        isTransfer: true,
      );
      expect(station.name, '北大街');
      expect(station.lat, 34.27);
      expect(station.lon, 108.95);
      expect(station.lines, ['地铁1号线', '地铁2号线']);
      expect(station.isTransfer, true);
    });

    test('isTransfer is false when only one line', () {
      final station = Station(
        name: '纺织城',
        lat: 34.273,
        lon: 109.078,
        lines: ['地铁1号线'],
        isTransfer: false,
      );
      expect(station.isTransfer, false);
    });
  });
}
```

- [ ] **Step 2: 运行测试确认失败**

```bash
cd c:\Users\WYH01\Desktop\数据结构课程作业\flutter_app
flutter test test/models/station_test.dart
```

Expected: FAIL — `package:flutter_app/models/station.dart` 不存在

- [ ] **Step 3: 写最小实现**

创建 `flutter_app/lib/models/station.dart`：

```dart
class Station {
  final String name;
  final double lat;
  final double lon;
  final List<String> lines;
  final bool isTransfer;

  Station({
    required this.name,
    required this.lat,
    required this.lon,
    required this.lines,
    required this.isTransfer,
  });
}
```

- [ ] **Step 4: 运行测试确认通过**

```bash
cd c:\Users\WYH01\Desktop\数据结构课程作业\flutter_app
flutter test test/models/station_test.dart
```

Expected: 2 tests PASS

- [ ] **Step 5: 提交**

```bash
cd c:\Users\WYH01\Desktop\数据结构课程作业
git add flutter_app/lib/models/station.dart flutter_app/test/models/station_test.dart
git commit -m "feat: add Station model with tests"
```

---

### Task 4: Route 模型

**Files:**
- Create: `flutter_app/lib/models/route.dart`
- Create: `flutter_app/test/models/route_test.dart`

- [ ] **Step 1: 写失败测试**

创建 `flutter_app/test/models/route_test.dart`：

```dart
import 'package:flutter_test/flutter_test.dart';
import 'package:flutter_app/models/route.dart';

void main() {
  group('RoutePoint', () {
    test('creates from constructor', () {
      final point = RoutePoint(name: '纺织城', lat: 34.273, lon: 109.078);
      expect(point.name, '纺织城');
      expect(point.lat, 34.273);
      expect(point.lon, 109.078);
    });
  });

  group('Route', () {
    test('creates from constructor', () {
      final route = Route(
        name: '地铁1号线',
        color: '#0079C2',
        stations: [
          RoutePoint(name: '纺织城', lat: 34.273, lon: 109.078),
          RoutePoint(name: '半坡', lat: 34.268, lon: 109.062),
        ],
      );
      expect(route.name, '地铁1号线');
      expect(route.color, '#0079C2');
      expect(route.stations.length, 2);
      expect(route.stations[0].name, '纺织城');
    });
  });
}
```

- [ ] **Step 2: 运行测试确认失败**

```bash
cd c:\Users\WYH01\Desktop\数据结构课程作业\flutter_app
flutter test test/models/route_test.dart
```

Expected: FAIL

- [ ] **Step 3: 写最小实现**

创建 `flutter_app/lib/models/route.dart`：

```dart
class RoutePoint {
  final String name;
  final double lat;
  final double lon;

  RoutePoint({
    required this.name,
    required this.lat,
    required this.lon,
  });
}

class Route {
  final String name;
  final String color;
  final List<RoutePoint> stations;

  Route({
    required this.name,
    required this.color,
    required this.stations,
  });
}
```

- [ ] **Step 4: 运行测试确认通过**

```bash
cd c:\Users\WYH01\Desktop\数据结构课程作业\flutter_app
flutter test test/models/route_test.dart
```

Expected: 2 tests PASS

- [ ] **Step 5: 提交**

```bash
cd c:\Users\WYH01\Desktop\数据结构课程作业
git add flutter_app/lib/models/route.dart flutter_app/test/models/route_test.dart
git commit -m "feat: add Route and RoutePoint models with tests"
```

---

### Task 5: DataLoader — deriveStations

**Files:**
- Create: `flutter_app/lib/services/data_loader.dart`
- Create: `flutter_app/test/services/data_loader_test.dart`

- [ ] **Step 1: 写失败测试**

创建 `flutter_app/test/services/data_loader_test.dart`：

```dart
import 'package:flutter_test/flutter_test.dart';
import 'package:flutter_app/services/data_loader.dart';

void main() {
  group('deriveStations', () {
    test('deduplicates nodes by station name', () {
      final nodes = [
        {'id': 0, 'station': '北大街', 'line': '地铁1号线', 'lon': 108.95, 'lat': 34.27},
        {'id': 1, 'station': '北大街', 'line': '地铁2号线', 'lon': 108.951, 'lat': 34.271},
        {'id': 2, 'station': '纺织城', 'line': '地铁1号线', 'lon': 109.078, 'lat': 34.273},
      ];
      final stations = deriveStations(nodes);
      expect(stations.length, 2);
    });

    test('takes first node coordinates in group', () {
      final nodes = [
        {'id': 0, 'station': '北大街', 'line': '地铁1号线', 'lon': 108.95, 'lat': 34.27},
        {'id': 1, 'station': '北大街', 'line': '地铁2号线', 'lon': 108.951, 'lat': 34.271},
      ];
      final stations = deriveStations(nodes);
      expect(stations[0].lon, 108.95);
      expect(stations[0].lat, 34.27);
    });

    test('collects all lines and marks transfer', () {
      final nodes = [
        {'id': 0, 'station': '北大街', 'line': '地铁1号线', 'lon': 108.95, 'lat': 34.27},
        {'id': 1, 'station': '北大街', 'line': '地铁2号线', 'lon': 108.951, 'lat': 34.271},
        {'id': 2, 'station': '纺织城', 'line': '地铁1号线', 'lon': 109.078, 'lat': 34.273},
      ];
      final stations = deriveStations(nodes);
      final beiDaJie = stations.firstWhere((s) => s.name == '北大街');
      expect(beiDaJie.lines, ['地铁1号线', '地铁2号线']);
      expect(beiDaJie.isTransfer, true);

      final fangZhiCheng = stations.firstWhere((s) => s.name == '纺织城');
      expect(fangZhiCheng.lines, ['地铁1号线']);
      expect(fangZhiCheng.isTransfer, false);
    });

    test('returns empty list for empty input', () {
      final stations = deriveStations([]);
      expect(stations, isEmpty);
    });
  });
}
```

- [ ] **Step 2: 运行测试确认失败**

```bash
cd c:\Users\WYH01\Desktop\数据结构课程作业\flutter_app
flutter test test/services/data_loader_test.dart
```

Expected: FAIL — `deriveStations` 未定义

- [ ] **Step 3: 写最小实现**

创建 `flutter_app/lib/services/data_loader.dart`：

```dart
import 'dart:convert';
import 'package:flutter/services.dart';
import 'package:flutter_app/models/station.dart';
import 'package:flutter_app/models/route.dart';

List<Station> deriveStations(List<dynamic> graphNodes) {
  final Map<String, List<Map<String, dynamic>>> groups = {};
  for (final node in graphNodes) {
    final n = node as Map<String, dynamic>;
    final name = n['station'] as String;
    groups.putIfAbsent(name, () => []);
    groups[name]!.add(n);
  }

  final List<Station> stations = [];
  for (final entry in groups.entries) {
    final first = entry.value.first;
    final lines = entry.value
        .map((n) => n['line'] as String)
        .toSet()
        .toList();
    stations.add(Station(
      name: entry.key,
      lat: (first['lat'] as num).toDouble(),
      lon: (first['lon'] as num).toDouble(),
      lines: lines,
      isTransfer: lines.length > 1,
    ));
  }
  return stations;
}

List<Route> parseRoutes(List<dynamic> routesData) {
  return routesData.map((r) {
    final map = r as Map<String, dynamic>;
    final stations = (map['stations'] as List<dynamic>).map((s) {
      final sm = s as Map<String, dynamic>;
      return RoutePoint(
        name: sm['name'] as String,
        lat: (sm['lat'] as num).toDouble(),
        lon: (sm['lon'] as num).toDouble(),
      );
    }).toList();
    return Route(
      name: map['name'] as String,
      color: map['color'] as String,
      stations: stations,
    );
  }).toList();
}

class DataLoader {
  static Future<Map<String, dynamic>> loadData() async {
    final graphStr = await rootBundle.loadString('assets/data/graph.json');
    final routesStr = await rootBundle.loadString('assets/data/routes.json');
    return {
      'graph': json.decode(graphStr),
      'routes': json.decode(routesStr),
    };
  }
}
```

- [ ] **Step 4: 运行测试确认通过**

```bash
cd c:\Users\WYH01\Desktop\数据结构课程作业\flutter_app
flutter test test/services/data_loader_test.dart
```

Expected: 4 tests PASS

- [ ] **Step 5: 提交**

```bash
cd c:\Users\WYH01\Desktop\数据结构课程作业
git add flutter_app/lib/services/data_loader.dart flutter_app/test/services/data_loader_test.dart
git commit -m "feat: add deriveStations with deduplication and transfer detection"
```

---

### Task 6: DataLoader — parseRoutes

**Files:**
- Modify: `flutter_app/test/services/data_loader_test.dart`
- (data_loader.dart 已在 Task 5 包含 parseRoutes)

- [ ] **Step 1: 写失败测试**

追加到 `flutter_app/test/services/data_loader_test.dart`：

```dart
  group('parseRoutes', () {
    test('parses route list from JSON', () {
      final routesData = [
        {
          'name': '地铁1号线',
          'color': '#0079C2',
          'stations': [
            {'name': '纺织城', 'lat': 34.273, 'lon': 109.078},
            {'name': '半坡', 'lat': 34.268, 'lon': 109.062},
          ],
        },
      ];
      final routes = parseRoutes(routesData);
      expect(routes.length, 1);
      expect(routes[0].name, '地铁1号线');
      expect(routes[0].color, '#0079C2');
      expect(routes[0].stations.length, 2);
      expect(routes[0].stations[0].name, '纺织城');
    });

    test('returns empty list for empty input', () {
      final routes = parseRoutes([]);
      expect(routes, isEmpty);
    });
  });
```

- [ ] **Step 2: 运行测试确认通过（parseRoutes 已在 Task 5 实现）**

```bash
cd c:\Users\WYH01\Desktop\数据结构课程作业\flutter_app
flutter test test/services/data_loader_test.dart
```

Expected: 6 tests PASS（4 deriveStations + 2 parseRoutes）

- [ ] **Step 3: 提交**

```bash
cd c:\Users\WYH01\Desktop\数据结构课程作业
git add flutter_app/test/services/data_loader_test.dart
git commit -m "feat: add parseRoutes tests"
```

---

### Task 7: Pathfinding — MinHeap

**Files:**
- Create: `flutter_app/lib/services/pathfinding.dart`
- Create: `flutter_app/test/services/pathfinding_test.dart`

- [ ] **Step 1: 写失败测试**

创建 `flutter_app/test/services/pathfinding_test.dart`：

```dart
import 'package:flutter_test/flutter_test.dart';
import 'package:flutter_app/services/pathfinding.dart';

void main() {
  group('MinHeap', () {
    test('insert and extractMin returns elements in cost order', () {
      final heap = MinHeap();
      heap.insert(5, 5.0);
      heap.insert(3, 3.0);
      heap.insert(7, 7.0);
      heap.insert(1, 1.0);
      expect(heap.extractMin()!.nodeId, 1);
      expect(heap.extractMin()!.nodeId, 3);
      expect(heap.extractMin()!.nodeId, 5);
      expect(heap.extractMin()!.nodeId, 7);
    });

    test('isEmpty returns true when empty', () {
      final heap = MinHeap();
      expect(heap.isEmpty, true);
    });

    test('isEmpty returns false when not empty', () {
      final heap = MinHeap();
      heap.insert(1, 1.0);
      expect(heap.isEmpty, false);
    });

    test('extractMin on empty heap returns null', () {
      final heap = MinHeap();
      expect(heap.extractMin(), isNull);
    });

    test('handles duplicate costs', () {
      final heap = MinHeap();
      heap.insert(3, 3.0);
      heap.insert(3, 3.0);
      heap.insert(1, 1.0);
      expect(heap.extractMin()!.cost, 1.0);
      expect(heap.extractMin()!.cost, 3.0);
      expect(heap.extractMin()!.cost, 3.0);
    });
  });
}
```

- [ ] **Step 2: 运行测试确认失败**

```bash
cd c:\Users\WYH01\Desktop\数据结构课程作业\flutter_app
flutter test test/services/pathfinding_test.dart
```

Expected: FAIL — `MinHeap` 未定义

- [ ] **Step 3: 写最小实现**

创建 `flutter_app/lib/services/pathfinding.dart`：

```dart
class _HeapItem {
  final int nodeId;
  final double cost;
  _HeapItem(this.nodeId, this.cost);
}

class MinHeap {
  final List<_HeapItem> _heap = [];

  bool get isEmpty => _heap.isEmpty;

  void insert(int nodeId, double cost) {
    _heap.add(_HeapItem(nodeId, cost));
    var i = _heap.length - 1;
    while (i > 0) {
      final parent = (i - 1) ~/ 2;
      if (_heap[parent].cost <= _heap[i].cost) break;
      final tmp = _heap[parent];
      _heap[parent] = _heap[i];
      _heap[i] = tmp;
      i = parent;
    }
  }

  _HeapItem? extractMin() {
    if (_heap.isEmpty) return null;
    final min = _heap[0];
    final last = _heap.removeLast();
    if (_heap.isNotEmpty) {
      _heap[0] = last;
      var i = 0;
      while (true) {
        final left = 2 * i + 1;
        final right = 2 * i + 2;
        var smallest = i;
        if (left < _heap.length && _heap[left].cost < _heap[smallest].cost) {
          smallest = left;
        }
        if (right < _heap.length && _heap[right].cost < _heap[smallest].cost) {
          smallest = right;
        }
        if (smallest == i) break;
        final tmp = _heap[smallest];
        _heap[smallest] = _heap[i];
        _heap[i] = tmp;
        i = smallest;
      }
    }
    return min;
  }
}
```

- [ ] **Step 4: 运行测试确认通过**

```bash
cd c:\Users\WYH01\Desktop\数据结构课程作业\flutter_app
flutter test test/services/pathfinding_test.dart
```

Expected: 5 tests PASS

- [ ] **Step 5: 提交**

```bash
cd c:\Users\WYH01\Desktop\数据结构课程作业
git add flutter_app/lib/services/pathfinding.dart flutter_app/test/services/pathfinding_test.dart
git commit -m "feat: add MinHeap with tests"
```

---

### Task 8: Pathfinding — GraphEdge + NodeRef + buildAdjList

**Files:**
- Modify: `flutter_app/lib/services/pathfinding.dart`
- Modify: `flutter_app/test/services/pathfinding_test.dart`

- [ ] **Step 1: 写失败测试**

追加到 `flutter_app/test/services/pathfinding_test.dart`：

```dart
  group('buildAdjList', () {
    test('builds adjacency list from nodes and edges', () {
      final nodes = [
        {'id': 0, 'station': 'A', 'line': 'L1', 'lon': 108.0, 'lat': 34.0},
        {'id': 1, 'station': 'B', 'line': 'L1', 'lon': 108.1, 'lat': 34.1},
        {'id': 2, 'station': 'C', 'line': 'L1', 'lon': 108.2, 'lat': 34.2},
      ];
      final edges = [
        {'from': 0, 'to': 1, 'weight': 1.5, 'line': 'L1', 'is_transfer': 0},
        {'from': 1, 'to': 2, 'weight': 2.0, 'line': 'L1', 'is_transfer': 0},
      ];
      final adjList = buildAdjList(nodes, edges);
      expect(adjList.length, 3);
      expect(adjList[0].length, 1);
      expect(adjList[0][0].to, 1);
      expect(adjList[0][0].weight, 1.5);
      expect(adjList[1].length, 1);
      expect(adjList[1][0].to, 2);
    });

    test('handles transfer edges', () {
      final nodes = [
        {'id': 0, 'station': 'A', 'line': 'L1', 'lon': 108.0, 'lat': 34.0},
        {'id': 1, 'station': 'A', 'line': 'L2', 'lon': 108.0, 'lat': 34.0},
      ];
      final edges = [
        {'from': 0, 'to': 1, 'weight': 0.0, 'line': '换乘', 'is_transfer': 1},
      ];
      final adjList = buildAdjList(nodes, edges);
      expect(adjList[0].length, 1);
      expect(adjList[0][0].isTransfer, 1);
      expect(adjList[0][0].weight, 0.0);
    });
  });
```

- [ ] **Step 2: 运行测试确认失败**

```bash
cd c:\Users\WYH01\Desktop\数据结构课程作业\flutter_app
flutter test test/services/pathfinding_test.dart
```

Expected: FAIL — `buildAdjList` 未定义

- [ ] **Step 3: 写最小实现**

追加到 `flutter_app/lib/services/pathfinding.dart`：

```dart
class NodeRef {
  final int id;
  final String station;
  final String line;
  final double lon;
  final double lat;

  NodeRef({
    required this.id,
    required this.station,
    required this.line,
    required this.lon,
    required this.lat,
  });
}

class GraphEdge {
  final int to;
  final double weight;
  final String line;
  final int isTransfer;

  GraphEdge({
    required this.to,
    required this.weight,
    required this.line,
    required this.isTransfer,
  });
}

List<List<GraphEdge>> buildAdjList(List<dynamic> nodes, List<dynamic> edges) {
  final n = nodes.length;
  final adjList = List<List<GraphEdge>>.filled(n, [], growable: true);
  for (var i = 0; i < n; i++) {
    adjList[i] = [];
  }
  for (final e in edges) {
    final map = e as Map<String, dynamic>;
    final from = map['from'] as int;
    adjList[from].add(GraphEdge(
      to: map['to'] as int,
      weight: (map['weight'] as num).toDouble(),
      line: map['line'] as String,
      isTransfer: map['is_transfer'] as int,
    ));
  }
  return adjList;
}
```

- [ ] **Step 4: 运行测试确认通过**

```bash
cd c:\Users\WYH01\Desktop\数据结构课程作业\flutter_app
flutter test test/services/pathfinding_test.dart
```

Expected: 7 tests PASS

- [ ] **Step 5: 提交**

```bash
cd c:\Users\WYH01\Desktop\数据结构课程作业
git add flutter_app/lib/services/pathfinding.dart flutter_app/test/services/pathfinding_test.dart
git commit -m "feat: add NodeRef, GraphEdge, buildAdjList with tests"
```

---

### Task 9: Pathfinding — dijkstra

**Files:**
- Modify: `flutter_app/lib/services/pathfinding.dart`
- Modify: `flutter_app/test/services/pathfinding_test.dart`

- [ ] **Step 1: 写失败测试**

追加到 `flutter_app/test/services/pathfinding_test.dart`：

```dart
  group('dijkstra', () {
    late List<dynamic> nodes;
    late List<List<GraphEdge>> adjList;

    setUp(() {
      nodes = [
        {'id': 0, 'station': 'A', 'line': 'L1', 'lon': 108.0, 'lat': 34.0},
        {'id': 1, 'station': 'B', 'line': 'L1', 'lon': 108.1, 'lat': 34.1},
        {'id': 2, 'station': 'C', 'line': 'L1', 'lon': 108.2, 'lat': 34.2},
        {'id': 3, 'station': 'D', 'line': 'L2', 'lon': 108.3, 'lat': 34.3},
      ];
      final edges = [
        {'from': 0, 'to': 1, 'weight': 2.0, 'line': 'L1', 'is_transfer': 0},
        {'from': 1, 'to': 2, 'weight': 3.0, 'line': 'L1', 'is_transfer': 0},
        {'from': 2, 'to': 3, 'weight': 0.0, 'line': '换乘', 'is_transfer': 1},
        {'from': 1, 'to': 3, 'weight': 10.0, 'line': 'L2', 'is_transfer': 0},
      ];
      adjList = buildAdjList(nodes, edges);
    });

    test('mode 0 finds shortest time path', () {
      final result = dijkstra(adjList, nodes, 'A', 'D', 0);
      expect(result.error, isNull);
      expect(result.totalTime, closeTo(5.0, 0.001));
      expect(result.path.first.station, 'A');
      expect(result.path.last.station, 'D');
    });

    test('mode 1 finds fewest transfers path', () {
      final result = dijkstra(adjList, nodes, 'A', 'D', 1);
      expect(result.error, isNull);
      expect(result.transferCount, 0);
    });

    test('returns error for non-existent station', () {
      final result = dijkstra(adjList, nodes, 'A', '不存在', 0);
      expect(result.error, isNotNull);
      expect(result.path, isEmpty);
    });

    test('returns error for unreachable station', () {
      final isolatedNodes = [
        {'id': 0, 'station': 'A', 'line': 'L1', 'lon': 108.0, 'lat': 34.0},
        {'id': 1, 'station': 'B', 'line': 'L1', 'lon': 108.1, 'lat': 34.1},
      ];
      final isolatedAdj = [[], []];
      final result = dijkstra(isolatedAdj, isolatedNodes, 'A', 'B', 0);
      expect(result.error, isNotNull);
    });

    test('counts transferStations correctly', () {
      final result = dijkstra(adjList, nodes, 'A', 'D', 0);
      expect(result.transferStations, contains('C'));
    });

    test('counts stationCount correctly', () {
      final result = dijkstra(adjList, nodes, 'A', 'D', 0);
      expect(result.stationCount, 4);
    });
  });
```

- [ ] **Step 2: 运行测试确认失败**

```bash
cd c:\Users\WYH01\Desktop\数据结构课程作业\flutter_app
flutter test test/services/pathfinding_test.dart
```

Expected: FAIL — `dijkstra` / `PathResult` 未定义

- [ ] **Step 3: 写最小实现**

追加到 `flutter_app/lib/services/pathfinding.dart`：

```dart
class PathResult {
  final List<NodeRef> path;
  final double totalTime;
  final int transferCount;
  final List<String> transferStations;
  final int stationCount;
  final String? error;

  PathResult({
    required this.path,
    required this.totalTime,
    required this.transferCount,
    required this.transferStations,
    required this.stationCount,
    this.error,
  });
}

PathResult dijkstra(
  List<List<GraphEdge>> adjList,
  List<dynamic> nodes,
  String startName,
  String endName,
  int mode,
) {
  final n = nodes.length;
  final startNodes = <int>[];
  final endNodes = <int>[];

  for (var i = 0; i < n; i++) {
    final node = nodes[i] as Map<String, dynamic>;
    if (node['station'] == startName) startNodes.add(i);
    if (node['station'] == endName) endNodes.add(i);
  }

  if (startNodes.isEmpty || endNodes.isEmpty) {
    return PathResult(
      path: [], totalTime: 0, transferCount: 0,
      transferStations: [], stationCount: 0, error: '未找到站点',
    );
  }

  final endSet = <int>{};
  for (final e in endNodes) {
    endSet.add(e);
  }

  const inf = 1e18;
  final dist = List<double>.filled(n, inf);
  final transferArr = List<int>.filled(n, 0);
  final visited = List<bool>.filled(n, false);
  final prev = List<int>.filled(n, -1);

  final heap = MinHeap();

  for (final si in startNodes) {
    dist[si] = 0;
    transferArr[si] = 0;
    heap.insert(si, 0.0);
  }

  var foundNode = -1;

  while (!heap.isEmpty) {
    final cur = heap.extractMin();
    if (cur == null) break;
    if (visited[cur.nodeId]) continue;
    visited[cur.nodeId] = true;

    if (endSet.contains(cur.nodeId)) {
      foundNode = cur.nodeId;
      break;
    }

    for (final edge in adjList[cur.nodeId]) {
      if (visited[edge.to]) continue;

      final newTime = dist[cur.nodeId] + edge.weight;
      final newTransfers = transferArr[cur.nodeId] + edge.isTransfer;

      final newCost = mode == 0 ? newTime : newTransfers.toDouble() + newTime * 1e-6;
      final currentCost = dist[edge.to] == inf
          ? inf
          : mode == 0
              ? dist[edge.to]
              : transferArr[edge.to].toDouble() + dist[edge.to] * 1e-6;

      if (newCost < currentCost) {
        dist[edge.to] = newTime;
        transferArr[edge.to] = newTransfers;
        prev[edge.to] = cur.nodeId;
        heap.insert(edge.to, newCost);
      }
    }
  }

  if (foundNode == -1) {
    return PathResult(
      path: [], totalTime: 0, transferCount: 0,
      transferStations: [], stationCount: 0, error: '未找到可达路径',
    );
  }

  final pathIndices = <int>[];
  var cur = foundNode;
  while (cur != -1) {
    pathIndices.insert(0, cur);
    cur = prev[cur];
  }

  final pathResult = pathIndices.map((idx) {
    final node = nodes[idx] as Map<String, dynamic>;
    return NodeRef(
      id: node['id'] as int,
      station: node['station'] as String,
      line: node['line'] as String,
      lon: (node['lon'] as num).toDouble(),
      lat: (node['lat'] as num).toDouble(),
    );
  }).toList();

  final transferStations = <String>[];
  var uniqueCount = 0;
  var lastStation = '';
  for (var i = 0; i < pathResult.length; i++) {
    if (pathResult[i].station != lastStation) {
      uniqueCount++;
      lastStation = pathResult[i].station;
    }
    if (i > 0 && i < pathResult.length - 1) {
      if (pathResult[i].station == pathResult[i - 1].station &&
          pathResult[i].line != pathResult[i - 1].line) {
        transferStations.add(pathResult[i].station);
      }
    }
  }

  return PathResult(
    path: pathResult,
    totalTime: dist[foundNode],
    transferCount: transferArr[foundNode],
    transferStations: transferStations,
    stationCount: uniqueCount,
  );
}
```

- [ ] **Step 4: 运行测试确认通过**

```bash
cd c:\Users\WYH01\Desktop\数据结构课程作业\flutter_app
flutter test test/services/pathfinding_test.dart
```

Expected: 13 tests PASS

- [ ] **Step 5: 提交**

```bash
cd c:\Users\WYH01\Desktop\数据结构课程作业
git add flutter_app/lib/services/pathfinding.dart flutter_app/test/services/pathfinding_test.dart
git commit -m "feat: add dijkstra and PathResult with tests"
```

---

### Task 10: Pathfinding — buildSegments

**Files:**
- Modify: `flutter_app/lib/services/pathfinding.dart`
- Modify: `flutter_app/test/services/pathfinding_test.dart`

- [ ] **Step 1: 写失败测试**

追加到 `flutter_app/test/services/pathfinding_test.dart`：

```dart
  group('buildSegments', () {
    test('splits path by line changes', () {
      final result = PathResult(
        path: [
          NodeRef(id: 0, station: 'A', line: 'L1', lon: 108.0, lat: 34.0),
          NodeRef(id: 1, station: 'B', line: 'L1', lon: 108.1, lat: 34.1),
          NodeRef(id: 2, station: 'B', line: 'L2', lon: 108.1, lat: 34.1),
          NodeRef(id: 3, station: 'C', line: 'L2', lon: 108.2, lat: 34.2),
        ],
        totalTime: 5.0,
        transferCount: 1,
        transferStations: ['B'],
        stationCount: 3,
      );
      final segments = buildSegments(result);
      expect(segments.length, 2);
      expect(segments[0].fromStation, 'A');
      expect(segments[0].toStation, 'B');
      expect(segments[0].line, 'L1');
      expect(segments[1].fromStation, 'B');
      expect(segments[1].toStation, 'C');
      expect(segments[1].line, 'L2');
    });

    test('single line produces one segment', () {
      final result = PathResult(
        path: [
          NodeRef(id: 0, station: 'A', line: 'L1', lon: 108.0, lat: 34.0),
          NodeRef(id: 1, station: 'B', line: 'L1', lon: 108.1, lat: 34.1),
          NodeRef(id: 2, station: 'C', line: 'L1', lon: 108.2, lat: 34.2),
        ],
        totalTime: 5.0,
        transferCount: 0,
        transferStations: [],
        stationCount: 3,
      );
      final segments = buildSegments(result);
      expect(segments.length, 1);
      expect(segments[0].fromStation, 'A');
      expect(segments[0].toStation, 'C');
      expect(segments[0].line, 'L1');
    });

    test('empty path produces no segments', () {
      final result = PathResult(
        path: [], totalTime: 0, transferCount: 0,
        transferStations: [], stationCount: 0, error: '未找到路径',
      );
      final segments = buildSegments(result);
      expect(segments, isEmpty);
    });
  });
```

- [ ] **Step 2: 运行测试确认失败**

```bash
cd c:\Users\WYH01\Desktop\数据结构课程作业\flutter_app
flutter test test/services/pathfinding_test.dart
```

Expected: FAIL — `buildSegments` / `PathSegment` 未定义

- [ ] **Step 3: 写最小实现**

追加到 `flutter_app/lib/services/pathfinding.dart`：

```dart
class PathSegment {
  final String fromStation;
  final String toStation;
  final String line;
  final double duration;

  PathSegment({
    required this.fromStation,
    required this.toStation,
    required this.line,
    required this.duration,
  });
}

List<PathSegment> buildSegments(PathResult result) {
  if (result.path.isEmpty) return [];

  final segments = <PathSegment>[];
  var segStart = 0;

  for (var i = 1; i < result.path.length; i++) {
    if (result.path[i].line != result.path[segStart].line) {
      final startNode = result.path[segStart];
      final endNode = result.path[i - 1];
      double duration = 0;
      for (var j = segStart; j < i - 1; j++) {
        duration += (result.path[j + 1].id - result.path[j].id).abs().toDouble();
      }
      segments.add(PathSegment(
        fromStation: startNode.station,
        toStation: endNode.station,
        line: startNode.line,
        duration: duration,
      ));
      segStart = i;
    }
  }

  final startNode = result.path[segStart];
  final endNode = result.path.last;
  double duration = 0;
  for (var j = segStart; j < result.path.length - 1; j++) {
    duration += (result.path[j + 1].id - result.path[j].id).abs().toDouble();
  }
  segments.add(PathSegment(
    fromStation: startNode.station,
    toStation: endNode.station,
    line: startNode.line,
    duration: duration,
  ));

  return segments;
}
```

- [ ] **Step 4: 运行测试确认通过**

```bash
cd c:\Users\WYH01\Desktop\数据结构课程作业\flutter_app
flutter test test/services/pathfinding_test.dart
```

Expected: 16 tests PASS

- [ ] **Step 5: 提交**

```bash
cd c:\Users\WYH01\Desktop\数据结构课程作业
git add flutter_app/lib/services/pathfinding.dart flutter_app/test/services/pathfinding_test.dart
git commit -m "feat: add PathSegment and buildSegments with tests"
```

---

### Task 11: MapView 组件

**Files:**
- Create: `flutter_app/lib/widgets/map_view.dart`

- [ ] **Step 1: 实现 MapView**

创建 `flutter_app/lib/widgets/map_view.dart`：

```dart
import 'package:flutter/material.dart';
import 'package:flutter_map/flutter_map.dart';
import 'package:latlong2/latlong.dart';
import 'package:flutter_app/models/route.dart';
import 'package:flutter_app/models/station.dart';

class MapView extends StatefulWidget {
  final List<Route> routes;
  final List<Station> stations;

  const MapView({
    super.key,
    required this.routes,
    required this.stations,
  });

  @override
  State<MapView> createState() => MapViewState();
}

class MapViewState extends State<MapView> {
  final MapController _mapController = MapController();
  List<Polyline> _queryPolylines = [];
  List<CircleMarker> _queryMarkers = [];

  void updatePath(List<LatLng> pathPoints, List<LatLng> transferPoints) {
    setState(() {
      _queryPolylines = [
        Polyline(
          points: pathPoints,
          color: Colors.red,
          strokeWidth: 5.0,
          pattern: StrokePattern.dashed(segments: [8, 8]),
        ),
      ];
      _queryMarkers = transferPoints
          .map((p) => CircleMarker(
                point: p,
                radius: 8,
                color: Colors.orange,
                borderColor: Colors.white,
                borderStrokeWidth: 2,
              ))
          .toList();
    });
    if (pathPoints.isNotEmpty) {
      _mapController.fitCamera(
        CameraFit.bounds(
          bounds: LatLngBounds.fromPoints(pathPoints),
          padding: EdgeInsets.all(40),
        ),
      );
    }
  }

  void clearPath() {
    setState(() {
      _queryPolylines = [];
      _queryMarkers = [];
    });
  }

  @override
  Widget build(BuildContext context) {
    final routePolylines = widget.routes.map((route) {
      final points = route.stations
          .map((s) => LatLng(s.lat, s.lon))
          .toList();
      return Polyline(
        points: points,
        color: _parseColor(route.color),
        strokeWidth: 3.0,
      );
    }).toList();

    final stationCircles = widget.stations.map((s) {
      return CircleMarker(
        point: LatLng(s.lat, s.lon),
        radius: s.isTransfer ? 6 : 4,
        color: s.isTransfer
            ? const Color(0xFFE67E22)
            : const Color(0xFF4A90D9),
        borderColor: Colors.white,
        borderStrokeWidth: 1.5,
      );
    }).toList();

    return FlutterMap(
      mapController: _mapController,
      options: MapOptions(
        initialCenter: LatLng(34.261, 108.942),
        initialZoom: 12.0,
        minZoom: 10.0,
        maxZoom: 18.0,
      ),
      children: [
        TileLayer(
          urlTemplate:
              'https://webrd0{s}.is.autonavi.com/appmaptile?lang=zh_cn&size=1&scale=1&style=8&x={x}&y={y}&z={z}',
          subdomains: ['1', '2', '3', '4'],
        ),
        PolylineLayer(
          polylines: [...routePolylines, ..._queryPolylines],
        ),
        CircleLayer(
          circles: [...stationCircles, ..._queryMarkers],
        ),
      ],
    );
  }

  Color _parseColor(String hex) {
    final code = hex.replaceAll('#', '');
    return Color(int.parse('FF$code', radix: 16));
  }
}
```

- [ ] **Step 2: 运行 flutter analyze 验证无错误**

```bash
cd c:\Users\WYH01\Desktop\数据结构课程作业\flutter_app
flutter analyze lib/widgets/map_view.dart
```

Expected: No issues found

- [ ] **Step 3: 提交**

```bash
cd c:\Users\WYH01\Desktop\数据结构课程作业
git add flutter_app/lib/widgets/map_view.dart
git commit -m "feat: add MapView widget with flutter_map and path overlay"
```

---

### Task 12: SearchPanel + ResultPanel 组件

**Files:**
- Create: `flutter_app/lib/widgets/search_panel.dart`
- Create: `flutter_app/lib/widgets/result_panel.dart`
- Create: `flutter_app/test/widgets/search_panel_test.dart`

- [ ] **Step 1: 实现 SearchPanel**

创建 `flutter_app/lib/widgets/search_panel.dart`：

```dart
import 'package:flutter/material.dart';
import 'package:flutter_app/models/station.dart';

class SearchPanel extends StatefulWidget {
  final List<Station> stations;
  final void Function(String start, String end, int mode) onSearch;

  const SearchPanel({
    super.key,
    required this.stations,
    required this.onSearch,
  });

  @override
  State<SearchPanel> createState() => _SearchPanelState();
}

class _SearchPanelState extends State<SearchPanel> {
  final _startController = TextEditingController();
  final _endController = TextEditingController();
  List<Station> _startSuggestions = [];
  List<Station> _endSuggestions = [];

  List<Station> _filter(String input) {
    if (input.isEmpty) return [];
    return widget.stations
        .where((s) => s.name.contains(input))
        .take(8)
        .toList();
  }

  void _onStartChanged(String value) {
    setState(() {
      _startSuggestions = _filter(value.trim());
    });
  }

  void _onEndChanged(String value) {
    setState(() {
      _endSuggestions = _filter(value.trim());
    });
  }

  void _submit(int mode) {
    final start = _startController.text.trim();
    final end = _endController.text.trim();

    if (start.isEmpty || end.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('请选择起点站/终点站')),
      );
      return;
    }
    if (start == end) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('起点和终点不能相同')),
      );
      return;
    }
    widget.onSearch(start, end, mode);
  }

  @override
  void dispose() {
    _startController.dispose();
    _endController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.all(16),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          _buildInputWithDropdown(
            label: '起点站',
            controller: _startController,
            suggestions: _startSuggestions,
            onChanged: _onStartChanged,
            onSelect: (station) {
              _startController.text = station.name;
              setState(() => _startSuggestions = []);
            },
          ),
          const SizedBox(height: 12),
          _buildInputWithDropdown(
            label: '终点站',
            controller: _endController,
            suggestions: _endSuggestions,
            onChanged: _onEndChanged,
            onSelect: (station) {
              _endController.text = station.name;
              setState(() => _endSuggestions = []);
            },
          ),
          const SizedBox(height: 16),
          Row(
            children: [
              Expanded(
                child: ElevatedButton(
                  onPressed: () => _submit(0),
                  style: ElevatedButton.styleFrom(
                    backgroundColor: const Color(0xFF4A90D9),
                    foregroundColor: Colors.white,
                  ),
                  child: const Text('时间最短'),
                ),
              ),
              const SizedBox(width: 10),
              Expanded(
                child: ElevatedButton(
                  onPressed: () => _submit(1),
                  style: ElevatedButton.styleFrom(
                    backgroundColor: const Color(0xFFE67E22),
                    foregroundColor: Colors.white,
                  ),
                  child: const Text('换乘最少'),
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }

  Widget _buildInputWithDropdown({
    required String label,
    required TextEditingController controller,
    required List<Station> suggestions,
    required void Function(String) onChanged,
    required void Function(Station) onSelect,
  }) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(label, style: const TextStyle(fontSize: 13, color: Color(0xFF555555))),
        const SizedBox(height: 4),
        TextField(
          controller: controller,
          onChanged: onChanged,
          decoration: InputDecoration(
            hintText: '输入站名',
            border: OutlineInputBorder(borderRadius: BorderRadius.circular(4)),
            contentPadding: const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
            isDense: true,
          ),
        ),
        if (suggestions.isNotEmpty)
          Container(
            constraints: const BoxConstraints(maxHeight: 200),
            decoration: BoxDecoration(
              border: Border.all(color: Colors.grey),
              borderRadius: BorderRadius.circular(4),
            ),
            child: ListView.builder(
              shrinkWrap: true,
              itemCount: suggestions.length,
              itemBuilder: (context, index) {
                final s = suggestions[index];
                return ListTile(
                  dense: true,
                  title: Text(
                    s.name + (s.isTransfer ? ' (换乘)' : ''),
                    style: const TextStyle(fontSize: 13),
                  ),
                  onTap: () => onSelect(s),
                );
              },
            ),
          ),
      ],
    );
  }
}
```

- [ ] **Step 2: 实现 ResultPanel**

创建 `flutter_app/lib/widgets/result_panel.dart`：

```dart
import 'package:flutter/material.dart';
import 'package:flutter_app/services/pathfinding.dart';

class ResultPanel extends StatelessWidget {
  final PathResult result;
  final List<PathSegment> segments;

  const ResultPanel({
    super.key,
    required this.result,
    required this.segments,
  });

  @override
  Widget build(BuildContext context) {
    if (result.error != null) {
      return Padding(
        padding: const EdgeInsets.all(16),
        child: Text(
          result.error!,
          style: const TextStyle(color: Color(0xFFE74C3C), fontSize: 14),
          textAlign: TextAlign.center,
        ),
      );
    }

    final totalTime = (result.totalTime + 3).toStringAsFixed(2);

    return Padding(
      padding: const EdgeInsets.all(16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        mainAxisSize: MainAxisSize.min,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text(
                '总时间: $totalTime 分钟（含等车3分钟）',
                style: const TextStyle(fontSize: 14, fontWeight: FontWeight.bold),
              ),
              Text(
                '换乘: ${result.transferCount} 次',
                style: const TextStyle(fontSize: 14, fontWeight: FontWeight.bold),
              ),
            ],
          ),
          const SizedBox(height: 10),
          Container(
            padding: const EdgeInsets.all(12),
            decoration: BoxDecoration(
              border: Border.all(color: Color(0xFFE0E0E0)),
              borderRadius: BorderRadius.circular(4),
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: segments.map((seg) {
                final isTransfer = result.transferStations.contains(seg.fromStation);
                return Padding(
                  padding: const EdgeInsets.only(bottom: 4),
                  child: Row(
                    children: [
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 1),
                        decoration: BoxDecoration(
                          color: const Color(0xFF4A90D9),
                          borderRadius: BorderRadius.circular(3),
                        ),
                        child: Text(
                          seg.line,
                          style: const TextStyle(color: Colors.white, fontSize: 11),
                        ),
                      ),
                      const SizedBox(width: 4),
                      Text(
                        '${seg.fromStation} → ${seg.toStation}',
                        style: TextStyle(
                          fontSize: 13,
                          fontWeight: isTransfer ? FontWeight.bold : FontWeight.normal,
                          color: isTransfer ? const Color(0xFFE67E22) : Colors.black,
                        ),
                      ),
                      if (isTransfer) ...[
                        const SizedBox(width: 4),
                        const Text(
                          '← 换乘',
                          style: TextStyle(
                            color: Color(0xFFE67E22),
                            fontWeight: FontWeight.bold,
                            fontSize: 13,
                          ),
                        ),
                      ],
                    ],
                  ),
                );
              }).toList(),
            ),
          ),
        ],
      ),
    );
  }
}
```

- [ ] **Step 3: 写 SearchPanel 过滤逻辑测试**

创建 `flutter_app/test/widgets/search_panel_test.dart`：

```dart
import 'package:flutter_test/flutter_test.dart';
import 'package:flutter_app/models/station.dart';

void main() {
  group('Station filter logic', () {
    late List<Station> stations;

    setUp(() {
      stations = [
        Station(name: '北大街', lat: 34.27, lon: 108.95, lines: ['地铁1号线', '地铁2号线'], isTransfer: true),
        Station(name: '北客站', lat: 34.38, lon: 108.96, lines: ['地铁2号线'], isTransfer: false),
        Station(name: '北池头', lat: 34.23, lon: 108.98, lines: ['地铁3号线'], isTransfer: false),
        Station(name: '纺织城', lat: 34.273, lon: 109.078, lines: ['地铁1号线'], isTransfer: false),
      ];
    });

    test('filters stations by substring match', () {
      final result = stations.where((s) => s.name.contains('北')).toList();
      expect(result.length, 3);
    });

    test('empty input returns no results', () {
      final result = stations.where((s) => s.name.contains('')).take(8).toList();
      expect(result.length, 4);
    });

    test('limits results to 8', () {
      final manyStations = List.generate(
        20,
        (i) => Station(name: '站$i', lat: 34.0, lon: 108.0, lines: ['L1'], isTransfer: false),
      );
      final result = manyStations.where((s) => s.name.contains('站')).take(8).toList();
      expect(result.length, 8);
    });

    test('no match returns empty', () {
      final result = stations.where((s) => s.name.contains('不存在')).toList();
      expect(result, isEmpty);
    });
  });
}
```

- [ ] **Step 4: 运行测试确认通过**

```bash
cd c:\Users\WYH01\Desktop\数据结构课程作业\flutter_app
flutter test test/widgets/search_panel_test.dart
```

Expected: 4 tests PASS

- [ ] **Step 5: 运行 flutter analyze 验证全部组件无错误**

```bash
cd c:\Users\WYH01\Desktop\数据结构课程作业\flutter_app
flutter analyze
```

Expected: No issues found

- [ ] **Step 6: 提交**

```bash
cd c:\Users\WYH01\Desktop\数据结构课程作业
git add flutter_app/lib/widgets/ flutter_app/test/widgets/
git commit -m "feat: add SearchPanel, ResultPanel widgets with filter tests"
```

---

### Task 13: HomePage 集成

**Files:**
- Create: `flutter_app/lib/pages/home_page.dart`

- [ ] **Step 1: 实现 HomePage**

创建 `flutter_app/lib/pages/home_page.dart`：

```dart
import 'package:flutter/material.dart';
import 'package:latlong2/latlong.dart';
import 'package:flutter_app/models/station.dart';
import 'package:flutter_app/models/route.dart';
import 'package:flutter_app/services/data_loader.dart';
import 'package:flutter_app/services/pathfinding.dart';
import 'package:flutter_app/widgets/map_view.dart';
import 'package:flutter_app/widgets/search_panel.dart';
import 'package:flutter_app/widgets/result_panel.dart';

class HomePage extends StatefulWidget {
  const HomePage({super.key});

  @override
  State<HomePage> createState() => _HomePageState();
}

class _HomePageState extends State<HomePage> {
  final _mapViewKey = GlobalKey<MapViewState>();
  final _sheetController = DraggableScrollableController();

  List<Station>? _stations;
  List<Route>? _routes;
  List<List<GraphEdge>>? _adjList;
  List<dynamic>? _graphNodes;

  PathResult? _result;
  List<PathSegment> _segments = [];

  bool _isLoading = true;
  String? _loadError;

  @override
  void initState() {
    super.initState();
    _loadData();
  }

  Future<void> _loadData() async {
    try {
      final data = await DataLoader.loadData();
      final graph = data['graph'] as Map<String, dynamic>;
      final routes = data['routes'] as Map<String, dynamic>;

      final graphNodes = graph['nodes'] as List<dynamic>;
      final graphEdges = graph['edges'] as List<dynamic>;
      final routesList = routes['routes'] as List<dynamic>;

      final stations = deriveStations(graphNodes);
      final parsedRoutes = parseRoutes(routesList);
      final adjList = buildAdjList(graphNodes, graphEdges);

      setState(() {
        _stations = stations;
        _routes = parsedRoutes;
        _adjList = adjList;
        _graphNodes = graphNodes;
        _isLoading = false;
      });
    } catch (e) {
      setState(() {
        _loadError = '数据加载失败，请重新启动应用';
        _isLoading = false;
      });
    }
  }

  void _onSearch(String start, String end, int mode) {
    if (_adjList == null || _graphNodes == null) return;

    final result = dijkstra(_adjList!, _graphNodes!, start, end, mode);
    final segments = buildSegments(result);

    if (result.error == null) {
      final pathPoints = result.path
          .map((n) => LatLng(n.lat, n.lon))
          .toList();
      final transferPoints = result.transferStations
          .map((name) {
            final station = _stations!.firstWhere((s) => s.name == name);
            return LatLng(station.lat, station.lon);
          })
          .toList();
      _mapViewKey.currentState?.updatePath(pathPoints, transferPoints);
    } else {
      _mapViewKey.currentState?.clearPath();
    }

    setState(() {
      _result = result;
      _segments = segments;
    });

    _sheetController.animateTo(
      0.35,
      duration: const Duration(milliseconds: 300),
      curve: Curves.easeOut,
    );
  }

  @override
  void dispose() {
    _sheetController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    if (_isLoading) {
      return const Scaffold(
        body: Center(child: CircularProgressIndicator()),
      );
    }

    if (_loadError != null) {
      return Scaffold(
        body: Center(
          child: Text(_loadError!, style: const TextStyle(color: Colors.red)),
        ),
      );
    }

    return Scaffold(
      body: Stack(
        children: [
          MapView(
            key: _mapViewKey,
            routes: _routes!,
            stations: _stations!,
          ),
          DraggableScrollableSheet(
            controller: _sheetController,
            initialChildSize: 0.08,
            minChildSize: 0.08,
            maxChildSize: 0.50,
            snap: true,
            snapSizes: const [0.08, 0.35, 0.50],
            builder: (context, scrollController) {
              return Container(
                decoration: const BoxDecoration(
                  color: Colors.white,
                  borderRadius: BorderRadius.vertical(top: Radius.circular(16)),
                  boxShadow: [
                    BoxShadow(
                      color: Colors.black26,
                      blurRadius: 10,
                      offset: Offset(0, -2),
                    ),
                  ],
                ),
                child: ListView(
                  controller: scrollController,
                  padding: EdgeInsets.zero,
                  children: [
                    Center(
                      child: Container(
                        margin: const EdgeInsets.symmetric(vertical: 8),
                        width: 40,
                        height: 4,
                        decoration: BoxDecoration(
                          color: Colors.grey[300],
                          borderRadius: BorderRadius.circular(2),
                        ),
                      ),
                    ),
                    SearchPanel(
                      stations: _stations!,
                      onSearch: _onSearch,
                    ),
                    if (_result != null)
                      ResultPanel(
                        result: _result!,
                        segments: _segments,
                      ),
                  ],
                ),
              );
            },
          ),
        ],
      ),
    );
  }
}
```

- [ ] **Step 2: 运行 flutter analyze 验证**

```bash
cd c:\Users\WYH01\Desktop\数据结构课程作业\flutter_app
flutter analyze
```

Expected: No issues found

- [ ] **Step 3: 提交**

```bash
cd c:\Users\WYH01\Desktop\数据结构课程作业
git add flutter_app/lib/pages/home_page.dart
git commit -m "feat: add HomePage with map + bottom sheet integration"
```

---

### Task 14: main.dart 入口

**Files:**
- Modify: `flutter_app/lib/main.dart`

- [ ] **Step 1: 替换 main.dart**

将 `flutter_app/lib/main.dart` 替换为：

```dart
import 'package:flutter/material.dart';
import 'package:flutter_app/pages/home_page.dart';

void main() {
  runApp(const MetroApp());
}

class MetroApp extends StatelessWidget {
  const MetroApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: '西安地铁换乘计算器',
      debugShowCheckedModeBanner: false,
      theme: ThemeData(
        colorScheme: ColorScheme.fromSeed(seedColor: const Color(0xFF4A90D9)),
        useMaterial3: true,
      ),
      home: const HomePage(),
    );
  }
}
```

- [ ] **Step 2: 运行 flutter analyze 验证**

```bash
cd c:\Users\WYH01\Desktop\数据结构课程作业\flutter_app
flutter analyze
```

Expected: No issues found

- [ ] **Step 3: 运行全部测试**

```bash
cd c:\Users\WYH01\Desktop\数据结构课程作业\flutter_app
flutter test
```

Expected: All tests PASS

- [ ] **Step 4: 提交**

```bash
cd c:\Users\WYH01\Desktop\数据结构课程作业
git add flutter_app/lib/main.dart
git commit -m "feat: add MetroApp entry point"
```

---

### Task 15: 最终验证与构建

**Files:**
- 无新文件

- [ ] **Step 1: 运行全部测试**

```bash
cd c:\Users\WYH01\Desktop\数据结构课程作业\flutter_app
flutter test
```

Expected: All tests PASS

- [ ] **Step 2: 运行 flutter analyze**

```bash
cd c:\Users\WYH01\Desktop\数据结构课程作业\flutter_app
flutter analyze
```

Expected: No issues found

- [ ] **Step 3: 构建 Android APK（验证编译通过）**

```bash
cd c:\Users\WYH01\Desktop\数据结构课程作业\flutter_app
flutter build apk --debug
```

Expected: BUILD SUCCESSFUL

- [ ] **Step 4: 最终提交**

```bash
cd c:\Users\WYH01\Desktop\数据结构课程作业
git add -A
git commit -m "feat: complete Flutter metro router app for Android"
```

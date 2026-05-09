# 西安地铁换乘最优路径计算器 — 设计方案

## 1. 项目概述

基于CPTOND-2025数据集，构建西安地铁换乘最优路径计算系统，支持**时间最短**和**换乘最少**两种方案，通过Web界面交互，地图可视化展示路径。

### 功能要求

- 输入起终点站名，输出最优路径方案
- 支持「时间最短」和「换乘最少」两种优化目标
- 清晰展示换乘点、经过站点、总耗时、换乘次数
- 地图可视化：Leaflet.js展示线路、站点、路径高亮

### 必须提交内容

- 自行实现的最小堆代码（C语言）
- 西安地铁数据文件（含换乘站标注）
- 至少3条不同起终点的测试路径及结果截图

---

## 2. 整体架构

```
┌────────────────────────────────────────────────┐
│         前端 (Leaflet.js + HTML/CSS/JS)        │
│   地图展示 | 站点选择 | 路径高亮 | 换乘标注     │
└───────────────────┬────────────────────────────┘
                    │ HTTP API
┌───────────────────▼────────────────────────────┐
│              Flask 后端 (Python)                │
│  数据预处理: Shapefile → graph.txt + JSON      │
│  API路由: /api/routes, /api/stations, /api/path│
│  调用C程序: subprocess → 解析JSON结果           │
└───────────────────┬────────────────────────────┘
                    │ subprocess调用
┌───────────────────▼────────────────────────────┐
│           C 核心算法程序                         │
│  输入: graph.txt + 起终点 + 模式                │
│  ├── 邻接表 (数组+链表) 存储图                  │
│  ├── 最小堆 (自实现, 二叉堆)                    │
│  └── 扩展Dijkstra (时间最短/换乘最少)           │
│  输出: JSON路径结果(含坐标)                     │
└────────────────────────────────────────────────┘
```

### 数据流

1. **预处理阶段**（一次性）：Python读取Shapefile → 构建图 → 输出graph.txt + stations.json + routes.json
2. **启动阶段**：Flask加载stations.json和routes.json，提供API
3. **查询阶段**：用户选择起终点 → Flask调用C程序 → C读取graph.txt执行Dijkstra → 输出JSON → Flask返回前端 → 地图展示

---

## 3. 数据来源与预处理

### 数据集：CPTOND-2025

路径：`CPTOND-2025/dataset/metro/shapefiles/sian/`

| 文件 | 内容 | 关键字段 |
|------|------|----------|
| sian_metro_stops.shp | 478条站点记录（11线×2方向） | name_cn, stop_id, route_cn, sequence, geometry |
| sian_metro_stops_unique.shp | 217个去重站点 | stop_cn, stop_id, num(经过方向数), geometry |
| sian_metro_segments.shp | 456条站间路段（228对双向） | s_stop_cn, e_stop_cn, distance(km), geometry |
| sian_metro_routes.shp | 22条线路记录 | route_cn, start_time, end_time, basic_prc, total_prc |

### 数据特征（已验证）

- **segments无线路归属字段**：需通过stops的sequence推导边与线路的关系
- **segments完全双向**：456/228=2.0，去重后228条无向边
- **stops_unique的num**：表示经过的方向数（每条线2个方向），实际线路数=num/2
- **距离单位**：km，范围0.512-6.610
- **坐标范围**：Lon 108.65-109.23, Lat 34.11-34.52

### 西安地铁线路清单（去重后11条）

| 线路 | 唯一站点数 | 起止站 |
|------|-----------|--------|
| 1号线 | 30 | 纺织城—咸阳西 |
| 2号线 | 25 | 草滩—常宁宫 |
| 3号线 | 26 | 保税区—鱼化寨 |
| 4号线 | 29 | 航天新城—西安北 |
| 5号线 | 34 | 创新港—西安东 |
| 6号线 | 32 | 纺织城—西安南 |
| 9号线 | 15 | 纺织城—秦陵西 |
| 10号线 | 17 | 昭慧广场—井上村 |
| 14号线 | 18 | 贺韶—机场西 |
| 16号线 | 9 | 秦创原中心—诗经里 |
| 智轨1号线 | 4 | 昆明池—斗门 |

### 预处理逻辑（Python data_loader.py）

1. 读取stops数据，提取线路短名（如`地铁2号线(草滩--常宁宫)` → `地铁2号线`）
2. 合并同一线路两个方向：只保留正方向（route_cn中第一个方向），确保sequence单调递增
3. 按(站名, 线路短名)创建图节点，分配整数ID，记录经纬度
4. 同线相邻站（按sequence排序）→ 行驶边，权重 = distance / 40(km/h) × 60(分钟)
   - distance从segments表查找（按起止站名匹配）
   - 若segments中无匹配，按相邻站平均站距2分钟估算
5. 同名站不同线路 → 换乘边，权重 = 2分钟
6. 输出graph.txt（含坐标）、stations.json、routes.json

> **⚠ 方向合并策略**：不能使用`drop_duplicates`，因为两个方向的sequence值互为反序，混合后排序会乱序。必须只保留一个方向的所有站点。方法：按`route_cn`分组，取第一个方向（正方向），确保sequence单调递增。

### graph.txt格式

```
<节点数> <边数>
<节点ID> <站名> <线路名> <经度> <纬度>
...（每个节点一行）
<起点ID> <终点ID> <权重(分钟)> <线路名> <是否换乘(0/1)>
...（每条边一行）
```

### stations.json格式

```json
{
  "stations": [
    {"name": "小寨", "lat": 34.2244, "lon": 108.9421, "lines": ["地铁2号线", "地铁3号线"], "is_transfer": true},
    ...
  ]
}
```

### routes.json格式

```json
{
  "routes": [
    {
      "name": "地铁2号线",
      "color": "#FF0000",
      "stations": [{"name": "草滩", "lat": 34.40, "lon": 108.95}, ...]
    },
    ...
  ]
}
```

---

## 4. C语言核心实现

### 4.1 数据结构

#### 邻接表（数组+链表）

```c
typedef struct Edge {
    int to;
    char line_name[50];
    double weight;
    int is_transfer;
    struct Edge* next;
} Edge;

typedef struct GraphNode {
    char station[80];
    char line[50];
    double lon;
    double lat;
    Edge* adj_list;
} GraphNode;

typedef struct Graph {
    GraphNode* nodes;
    int node_count;
    int edge_count;
} Graph;
```

**设计说明**：将同一换乘站拆为多个节点（按线路），如"小寨"在2号线和3号线各一个节点，换乘变成一条显式的边，Dijkstra自然处理换乘惩罚。

#### 最小堆

```c
typedef struct HeapNode {
    int node_id;
    double cost;         // 优先级：mode=0时为total_time, mode=1时为transfers+time*1e-6
    double total_time;   // 实际累计时间(分钟)
    int transfers;       // 换乘次数
} HeapNode;

typedef struct MinHeap {
    HeapNode* data;
    int size;
    int capacity;
} MinHeap;
```

**核心操作**：

| 操作 | 实现 | 时间复杂度 |
|------|------|-----------|
| `insert(heap, node)` | 插入数组末尾，上浮(sift_up)调整 | O(log n) |
| `extract_min(heap)` | 交换首尾，删除末尾，下沉(sift_down)调整 | O(log n) |
| `peek(heap)` | 返回data[0] | O(1) |

**上浮(sift_up)**：将新插入节点与父节点比较（按cost字段），若更小则交换，直到满足堆性质。

**下沉(sift_down)**：将根节点与较小子节点比较（按cost字段），若更大则交换，直到满足堆性质。

> **⚠ 关键设计决策**：HeapNode中`cost`字段是堆排序的依据。mode=0时cost=total_time，mode=1时cost=transfers+time×1⁻⁶。这确保了堆始终按正确的优先级弹出节点。如果堆按total_time排序（旧版设计的Bug），mode=1下会错误地优先探索短时间多换乘路径，导致结果错误（已通过测试验证）。

### 4.2 扩展Dijkstra算法

#### 状态定义

```
状态 = (当前节点ID, 累计时间, 换乘次数)
```

#### 两种优化策略

| | 时间最短 (mode=0) | 换乘最少 (mode=1) |
|---|---|---|
| 行驶边权重 | 行驶时间(分钟) | 行驶时间(分钟) |
| 换乘边权重 | 2(分钟) | 2(分钟) |
| dist[]存储的cost | total_time | transfers + total_time × 1e-6 |
| 堆排序字段 | cost (= total_time) | cost (= transfers + time×1e-6) |
| 优化目标 | min(总时间) | min(换乘次数)，同换乘次数下min(时间) |

> **⚠ 为什么两种模式都使用实际时间作为边权重？** 因为dist[]和cost的计算方式已经区分了两种优化目标。mode=1下cost=transfers+time×1e-6，换乘边会使transfers+1（cost增加约1.0），而行驶边只使time增加（cost增加约0.00x），自然实现了"换乘最少优先、时间次优"。

#### 算法伪代码

```
function dijkstra(graph, start_name, end_name, mode):
    for each node where node.station == start_name:
        cost = 0
        insert (node_id, cost=0, time=0, transfers=0) into min_heap
        dist[node_id] = 0

    while min_heap is not empty:
        current = extract_min(min_heap)  // 按cost字段弹出最小

        if current.node is already visited: continue
        mark current.node as visited

        if current.node.station == end_name:
            return backtrack(prev, current.node)

        for each edge from current.node:
            next_node = edge.to
            if visited[next_node]: continue

            new_time = current.total_time + edge.weight
            new_transfers = current.transfers + edge.is_transfer

            if mode == 0:
                new_cost = new_time
            else:
                new_cost = new_transfers + new_time * 1e-6

            if new_cost < dist[next_node]:
                dist[next_node] = new_cost
                prev[next_node] = current.node
                insert (next_node, cost=new_cost, time=new_time, transfers=new_transfers) into min_heap

    return "无路径"
```

#### 路径回溯

记录每个节点的前驱节点ID，从终点逆向追踪到起点，还原完整路径。同时记录每条边所属线路，用于标注换乘点。

### 4.3 C程序接口

```
命令行: metro_router.exe <graph_file> <mode>
stdin: <start_station>\n<end_station>\n
  mode: 0=时间最短, 1=换乘最少

输出(JSON到stdout):
{
  "path": [
    {"station": "小寨", "line": "地铁3号线", "lon": 108.9421, "lat": 34.2244},
    {"station": "咸宁路", "line": "地铁3号线", "lon": 108.9919, "lat": 34.2526},
    {"station": "咸宁路", "line": "地铁6号线", "lon": 108.9919, "lat": 34.2526},
    ...
  ],
  "total_time": 35.5,
  "transfers": 2,
  "transfer_stations": ["咸宁路", "纺织城"],
  "station_count": 12
}
```

> **⚠ 为什么站名通过stdin而非argv传递？** Windows下C运行时将`argv`从UTF-16转换为系统默认编码（中文Windows为GBK），而graph.txt是UTF-8编码。`strcmp(GBK字符串, UTF-8字符串)`对中文必定失败（如"小寨"的GBK为`d0a1d5af`，UTF-8为`e5b08fe5afa8`）。通过stdin传递可由C程序自行控制编码读取，避免此问题。

---

## 5. Flask后端设计

### API接口

| 路由 | 方法 | 功能 | 返回 |
|------|------|------|------|
| `/api/routes` | GET | 获取所有线路及站点 | routes.json内容 |
| `/api/stations` | GET | 获取所有站点（去重） | stations.json内容 |
| `/api/path` | GET | 计算最优路径 | 路径JSON |
| `/` | GET | 前端页面 | HTML |

### `/api/path` 参数

```
start: 起点站名 (如 "小寨")
end: 终点站名 (如 "华清池")
mode: 0=时间最短, 1=换乘最少
```

### 调用C程序

```python
import subprocess, json

def query_path(graph_file, start, end, mode):
    result = subprocess.run(
        [EXE_PATH, graph_file, str(mode)],
        input=f"{start}\n{end}\n",
        capture_output=True, text=True, encoding='utf-8', timeout=10
    )
    if result.returncode != 0:
        return {"error": result.stderr}
    return json.loads(result.stdout)
```

> **⚠ 站名通过stdin传递**：避免Windows argv编码问题（GBK vs UTF-8）。

---

## 6. 前端设计

### 技术栈

- Leaflet.js：地图展示
- OpenStreetMap瓦片：底图
- 原生JS：交互逻辑

### 页面布局

```
┌─────────────────────────────────────────────┐
│  西安地铁换乘最优路径计算器                    │
├──────────┬──────────────────────────────────┤
│ 控制面板  │                                  │
│          │                                  │
│ 起点:[ ] │         地图区域                   │
│ 终点:[ ] │    (Leaflet.js 渲染)              │
│          │                                  │
│ [时间最短]│                                  │
│ [换乘最少]│                                  │
│          │                                  │
│ ─────── │                                  │
│ 路径详情  │                                  │
│ 总时间:  │                                  │
│ 换乘:    │                                  │
│ 站点列表  │                                  │
└──────────┴──────────────────────────────────┘
```

### 地图展示

- 所有线路用不同颜色折线绘制
- 站点用圆点标记，换乘站用大圆点+特殊样式
- 查询路径高亮显示（加粗+闪烁动画）
- 换乘点标注换乘图标

---

## 7. 文件结构

```
数据结构课程作业/
├── doc/
│   └── design.md              # 本设计文档
├── metro_router/
│   ├── core/                  # C语言核心算法
│   │   ├── main.c             # 主程序入口+IO+JSON输出
│   │   ├── min_heap.h         # 最小堆头文件
│   │   ├── min_heap.c         # 最小堆实现
│   │   ├── graph.h            # 图结构头文件
│   │   ├── graph.c            # 图结构实现(邻接表)
│   │   ├── dijkstra.h         # Dijkstra头文件
│   │   ├── dijkstra.c         # Dijkstra实现(双模式)
│   │   └── Makefile           # 编译脚本(gcc)
│   ├── app.py                 # Flask主程序
│   ├── data_loader.py         # Shapefile→graph.txt预处理
│   ├── data/
│   │   ├── graph.txt          # 预处理后的图数据(含坐标)
│   │   ├── stations.json      # 站点数据(前端用)
│   │   └── routes.json        # 线路数据(前端用)
│   ├── templates/
│   │   └── index.html         # 前端页面
│   └── static/
│       ├── style.css
│       └── script.js
└── CPTOND-2025/               # 原始数据集
```

---

## 8. 答辩关键问题

### 8.1 最小堆是怎么实现的？insert和extract-min的时间复杂度？

**实现方式**：二叉堆，用动态数组存储。

- **insert(heap, node)**：将新元素插入数组末尾，然后执行上浮操作（sift_up）——与父节点比较，若更小则交换，直到满足堆性质。时间复杂度 **O(log n)**。
- **extract_min(heap)**：将堆顶（最小元素）与末尾元素交换，删除末尾，然后对堆顶执行下沉操作（sift_down）——与较小子节点比较，若更大则交换，直到满足堆性质。时间复杂度 **O(log n)**。

### 8.2 为什么不能直接用BFS找最优路径？BFS能找到换乘最少的路径吗？

**BFS不能找时间最短路径**：
- BFS适用于等权图（所有边权重相同），它找到的是边数最少的路径
- 地铁网络中，站间行驶时间不同（距离差异大），BFS找到的"站数最少"路径不一定是"时间最短"路径
- 例：3站长距离路径可能比5站短距离路径耗时更多

**BFS不能直接找换乘最少路径**：
- 标准BFS中每条边权重相同，无法区分"坐一站"和"换乘一次"
- 若将换乘边权重设为1、同线边权重设为0，则需要0-1 BFS（双端队列BFS），这已是Dijkstra的特例
- Dijkstra更通用，统一处理两种优化目标

### 8.3 小寨→华清池，系统给出的方案

**预计路径**：

```
小寨(乘3号线) → 咸宁路(换乘6号线) → 纺织城(换乘9号线) → 华清池
```

- 换乘次数：2次（咸宁路、纺织城）
- 预计总时间：约35-40分钟

**备选路径**：

```
小寨(乘3号线) → 通化门(换乘1号线) → 纺织城(换乘9号线) → 华清池
```

- 换乘次数：2次（通化门、纺织城）
- 具体哪个更优取决于站间距离/时间

系统将根据实际数据自动计算最优方案。

---

## 9. 实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 实现西安地铁换乘最优路径计算器，C语言核心算法 + Flask Web界面 + Leaflet地图可视化

**Architecture:** Python预处理Shapefile数据为graph.txt，C程序实现最小堆+邻接表+扩展Dijkstra，Flask通过subprocess调用C程序，前端Leaflet.js地图展示

**Tech Stack:** C(gcc), Python 3.10, Flask, Leaflet.js, OpenStreetMap

---

### Task 1: 项目目录结构创建

**Files:**
- Create: `metro_router/core/` 目录
- Create: `metro_router/data/` 目录
- Create: `metro_router/templates/` 目录
- Create: `metro_router/static/` 目录

- [ ] **Step 1: 创建目录结构**

```powershell
New-Item -ItemType Directory -Path "metro_router/core" -Force
New-Item -ItemType Directory -Path "metro_router/data" -Force
New-Item -ItemType Directory -Path "metro_router/templates" -Force
New-Item -ItemType Directory -Path "metro_router/static" -Force
```

---

### Task 2: 数据预处理 — data_loader.py

**Files:**
- Create: `metro_router/data_loader.py`

**目标：** 读取Shapefile，构建图，输出graph.txt + stations.json + routes.json

- [ ] **Step 1: 编写data_loader.py**

```python
import geopandas as gpd
import pandas as pd
import json
import re
import os

BASE_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'CPTOND-2025', 'dataset', 'metro', 'shapefiles', 'sian')
OUTPUT_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'data')
SPEED_KMH = 40.0
TRANSFER_TIME_MIN = 2.0

LINE_COLORS = {
    '地铁1号线': '#00A650',
    '地铁2号线': '#E60012',
    '地铁3号线': '#8FC31F',
    '地铁4号线': '#7B2D8E',
    '地铁5号线': '#00B7EE',
    '地铁6号线': '#D5A216',
    '地铁9号线': '#FF6A00',
    '地铁10号线': '#008C95',
    '地铁14号线': '#8B5CF6',
    '地铁16号线': '#E91E8C',
    '西咸新区智轨示范线1号线': '#999999',
}

def extract_line_name(route_cn):
    m = re.match(r'(地铁\d+号线|西咸新区智轨示范线\d+号线)', route_cn)
    return m.group(1) if m else route_cn.split('(')[0]

def load_data():
    stops = gpd.read_file(os.path.join(BASE_DIR, 'sian_metro_stops.shp'), encoding='utf-8')
    segments = gpd.read_file(os.path.join(BASE_DIR, 'sian_metro_segments.shp'), encoding='utf-8')
    stops_unique = gpd.read_file(os.path.join(BASE_DIR, 'sian_metro_stops_unique.shp'), encoding='utf-8')
    return stops, segments, stops_unique

def build_graph(stops, segments):
    stops['line_short'] = stops['route_cn'].apply(extract_line_name)

    # 只保留每条线路的正方向（第一个route_cn），避免两个方向sequence混合
    line_directions = {}
    for _, row in stops.iterrows():
        key = row['line_short']
        if key not in line_directions:
            line_directions[key] = row['route_cn']
    forward_route_cns = set(line_directions.values())
    stops_forward = stops[stops['route_cn'].isin(forward_route_cns)].copy()
    dedup = stops_forward.drop_duplicates(subset=['name_cn', 'line_short'])
    dedup = dedup.sort_values(['line_short', 'sequence'])

    nodes = []
    node_map = {}
    idx = 0
    for _, row in dedup.iterrows():
        key = (row['name_cn'], row['line_short'])
        if key not in node_map:
            node_map[key] = idx
            nodes.append({
                'id': idx,
                'station': row['name_cn'],
                'line': row['line_short'],
                'lon': row.geometry.x,
                'lat': row.geometry.y,
            })
            idx += 1

    seg_dist = {}
    for _, row in segments.iterrows():
        key = tuple(sorted([row['s_stop_cn'], row['e_stop_cn']]))
        seg_dist[key] = float(row['distance'])

    edges = []
    for line_name, group in dedup.groupby('line_short'):
        group = group.sort_values('sequence')
        stations = group['name_cn'].tolist()
        for i in range(len(stations) - 1):
            s1, s2 = stations[i], stations[i + 1]
            key = tuple(sorted([s1, s2]))
            dist_km = seg_dist.get(key, 1.5)
            weight = dist_km / SPEED_KMH * 60.0
            from_id = node_map[(s1, line_name)]
            to_id = node_map[(s2, line_name)]
            edges.append({
                'from': from_id,
                'to': to_id,
                'weight': round(weight, 2),
                'line': line_name,
                'is_transfer': 0,
            })
            edges.append({
                'from': to_id,
                'to': from_id,
                'weight': round(weight, 2),
                'line': line_name,
                'is_transfer': 0,
            })

    station_lines = {}
    for node in nodes:
        station_lines.setdefault(node['station'], []).append(node['line'])

    for station, lines in station_lines.items():
        if len(lines) > 1:
            for i in range(len(lines)):
                for j in range(i + 1, len(lines)):
                    id_a = node_map[(station, lines[i])]
                    id_b = node_map[(station, lines[j])]
                    edges.append({
                        'from': id_a,
                        'to': id_b,
                        'weight': TRANSFER_TIME_MIN,
                        'line': '换乘',
                        'is_transfer': 1,
                    })
                    edges.append({
                        'from': id_b,
                        'to': id_a,
                        'weight': TRANSFER_TIME_MIN,
                        'line': '换乘',
                        'is_transfer': 1,
                    })

    return nodes, edges, node_map

def write_graph_txt(nodes, edges, filepath):
    with open(filepath, 'w', encoding='utf-8') as f:
        f.write(f"{len(nodes)} {len(edges)}\n")
        for node in nodes:
            f.write(f"{node['id']} {node['station']} {node['line']} {node['lon']:.6f} {node['lat']:.6f}\n")
        for edge in edges:
            f.write(f"{edge['from']} {edge['to']} {edge['weight']:.2f} {edge['line']} {edge['is_transfer']}\n")

def write_stations_json(nodes, filepath):
    station_map = {}
    for node in nodes:
        s = station_map.setdefault(node['station'], {
            'name': node['station'],
            'lat': node['lat'],
            'lon': node['lon'],
            'lines': [],
            'is_transfer': False,
        })
        if node['line'] not in s['lines']:
            s['lines'].append(node['line'])
    for s in station_map.values():
        s['is_transfer'] = len(s['lines']) > 1
    data = {'stations': sorted(station_map.values(), key=lambda x: x['name'])}
    with open(filepath, 'w', encoding='utf-8') as f:
        json.dump(data, f, ensure_ascii=False, indent=2)

def write_routes_json(nodes, filepath):
    route_map = {}
    for node in nodes:
        route_map.setdefault(node['line'], []).append({
            'name': node['station'],
            'lat': node['lat'],
            'lon': node['lon'],
        })
    routes = []
    for line_name, stations in route_map.items():
        routes.append({
            'name': line_name,
            'color': LINE_COLORS.get(line_name, '#666666'),
            'stations': stations,
        })
    with open(filepath, 'w', encoding='utf-8') as f:
        json.dump({'routes': routes}, f, ensure_ascii=False, indent=2)

def main():
    os.makedirs(OUTPUT_DIR, exist_ok=True)
    print("Loading Shapefile data...")
    stops, segments, stops_unique = load_data()
    print(f"  Stops: {len(stops)}, Segments: {len(segments)}")

    print("Building graph...")
    nodes, edges, node_map = build_graph(stops, segments)
    print(f"  Nodes: {len(nodes)}, Edges: {len(edges)}")

    transfer_count = sum(1 for n in nodes if any(
        n['station'] == other['station'] and n['line'] != other['line']
        for other in nodes
    )) // 2
    print(f"  Transfer stations: ~{transfer_count}")

    write_graph_txt(nodes, edges, os.path.join(OUTPUT_DIR, 'graph.txt'))
    write_stations_json(nodes, os.path.join(OUTPUT_DIR, 'stations.json'))
    write_routes_json(nodes, os.path.join(OUTPUT_DIR, 'routes.json'))
    print("Done! Files written to data/")

if __name__ == '__main__':
    main()
```

- [ ] **Step 2: 运行data_loader.py，验证输出**

```powershell
cd metro_router
python data_loader.py
```

预期输出：
- `data/graph.txt` — 节点~250个，边~600条
- `data/stations.json` — ~217个站点
- `data/routes.json` — 11条线路

- [ ] **Step 3: 检查graph.txt前几行，确认格式正确**

```powershell
Get-Content metro_router/data/graph.txt -Head 10
```

---

### Task 3: C最小堆实现 — min_heap.h + min_heap.c

**Files:**
- Create: `metro_router/core/min_heap.h`
- Create: `metro_router/core/min_heap.c`

- [ ] **Step 1: 编写min_heap.h**

```c
#ifndef MIN_HEAP_H
#define MIN_HEAP_H

typedef struct HeapNode {
    int node_id;
    double cost;         // 堆排序依据：mode=0时=time, mode=1时=transfers+time*1e-6
    double total_time;   // 实际累计时间
    int transfers;       // 换乘次数
} HeapNode;

typedef struct MinHeap {
    HeapNode *data;
    int size;
    int capacity;
} MinHeap;

MinHeap* heap_create(int capacity);
void heap_destroy(MinHeap *heap);
void heap_insert(MinHeap *heap, HeapNode node);
HeapNode heap_extract_min(MinHeap *heap);
int heap_is_empty(MinHeap *heap);

#endif
```

- [ ] **Step 2: 编写min_heap.c**

```c
#include "min_heap.h"
#include <stdlib.h>
#include <stdio.h>

static void sift_up(MinHeap *heap, int idx) {
    while (idx > 0) {
        int parent = (idx - 1) / 2;
        if (heap->data[idx].cost < heap->data[parent].cost) {
            HeapNode temp = heap->data[idx];
            heap->data[idx] = heap->data[parent];
            heap->data[parent] = temp;
            idx = parent;
        } else {
            break;
        }
    }
}

static void sift_down(MinHeap *heap, int idx) {
    while (1) {
        int left = 2 * idx + 1;
        int right = 2 * idx + 2;
        int smallest = idx;
        if (left < heap->size &&
            heap->data[left].cost < heap->data[smallest].cost) {
            smallest = left;
        }
        if (right < heap->size &&
            heap->data[right].cost < heap->data[smallest].cost) {
            smallest = right;
        }
        if (smallest != idx) {
            HeapNode temp = heap->data[idx];
            heap->data[idx] = heap->data[smallest];
            heap->data[smallest] = temp;
            idx = smallest;
        } else {
            break;
        }
    }
}

MinHeap* heap_create(int capacity) {
    MinHeap *heap = (MinHeap*)malloc(sizeof(MinHeap));
    heap->data = (HeapNode*)malloc(sizeof(HeapNode) * capacity);
    heap->size = 0;
    heap->capacity = capacity;
    return heap;
}

void heap_destroy(MinHeap *heap) {
    if (heap) {
        free(heap->data);
        free(heap);
    }
}

void heap_insert(MinHeap *heap, HeapNode node) {
    if (heap->size >= heap->capacity) {
        heap->capacity *= 2;
        heap->data = (HeapNode*)realloc(heap->data, sizeof(HeapNode) * heap->capacity);
    }
    heap->data[heap->size] = node;
    sift_up(heap, heap->size);
    heap->size++;
}

HeapNode heap_extract_min(MinHeap *heap) {
    HeapNode min_node = heap->data[0];
    heap->size--;
    if (heap->size > 0) {
        heap->data[0] = heap->data[heap->size];
        sift_down(heap, 0);
    }
    return min_node;
}

int heap_is_empty(MinHeap *heap) {
    return heap->size == 0;
}
```

- [ ] **Step 3: 验证编译**

```powershell
cd metro_router/core
gcc -c min_heap.c -o min_heap.o
```

预期：无错误，生成min_heap.o

---

### Task 4: C图结构实现 — graph.h + graph.c

**Files:**
- Create: `metro_router/core/graph.h`
- Create: `metro_router/core/graph.c`

- [ ] **Step 1: 编写graph.h**

```c
#ifndef GRAPH_H
#define GRAPH_H

typedef struct Edge {
    int to;
    char line_name[50];
    double weight;
    int is_transfer;
    struct Edge *next;
} Edge;

typedef struct GraphNode {
    char station[80];
    char line[50];
    double lon;
    double lat;
    Edge *adj_list;
} GraphNode;

typedef struct Graph {
    GraphNode *nodes;
    int node_count;
    int edge_count;
} Graph;

Graph* graph_create(int node_count);
void graph_destroy(Graph *graph);
void graph_add_edge(Graph *graph, int from, int to, double weight, const char *line_name, int is_transfer);
Graph* graph_load_from_file(const char *filename);

#endif
```

- [ ] **Step 2: 编写graph.c**

```c
#include "graph.h"
#include <stdlib.h>
#include <string.h>
#include <stdio.h>

Graph* graph_create(int node_count) {
    Graph *graph = (Graph*)malloc(sizeof(Graph));
    graph->nodes = (GraphNode*)calloc(node_count, sizeof(GraphNode));
    graph->node_count = node_count;
    graph->edge_count = 0;
    for (int i = 0; i < node_count; i++) {
        graph->nodes[i].adj_list = NULL;
    }
    return graph;
}

void graph_destroy(Graph *graph) {
    if (!graph) return;
    for (int i = 0; i < graph->node_count; i++) {
        Edge *e = graph->nodes[i].adj_list;
        while (e) {
            Edge *next = e->next;
            free(e);
            e = next;
        }
    }
    free(graph->nodes);
    free(graph);
}

void graph_add_edge(Graph *graph, int from, int to, double weight, const char *line_name, int is_transfer) {
    Edge *e = (Edge*)malloc(sizeof(Edge));
    e->to = to;
    e->weight = weight;
    e->is_transfer = is_transfer;
    strncpy(e->line_name, line_name, 49);
    e->line_name[49] = '\0';
    e->next = graph->nodes[from].adj_list;
    graph->nodes[from].adj_list = e;
    graph->edge_count++;
}

Graph* graph_load_from_file(const char *filename) {
    FILE *f = fopen(filename, "r");
    if (!f) {
        fprintf(stderr, "Cannot open file: %s\n", filename);
        return NULL;
    }

    int node_count, edge_count;
    if (fscanf(f, "%d %d", &node_count, &edge_count) != 2) {
        fclose(f);
        return NULL;
    }

    Graph *graph = graph_create(node_count);

    for (int i = 0; i < node_count; i++) {
        int id;
        double lon, lat;
        if (fscanf(f, "%d %79s %49s %lf %lf", &id, graph->nodes[i].station, graph->nodes[i].line, &lon, &lat) != 5) {
            fprintf(stderr, "Error reading node %d\n", i);
            graph_destroy(graph);
            fclose(f);
            return NULL;
        }
        graph->nodes[i].lon = lon;
        graph->nodes[i].lat = lat;
    }

    for (int i = 0; i < edge_count; i++) {
        int from, to, is_transfer;
        double weight;
        char line_name[50];
        if (fscanf(f, "%d %d %lf %49s %d", &from, &to, &weight, line_name, &is_transfer) != 5) {
            fprintf(stderr, "Error reading edge %d\n", i);
            graph_destroy(graph);
            fclose(f);
            return NULL;
        }
        graph_add_edge(graph, from, to, weight, line_name, is_transfer);
    }

    fclose(f);
    return graph;
}
```

- [ ] **Step 3: 验证编译**

```powershell
cd metro_router/core
gcc -c graph.c -o graph.o
```

---

### Task 5: C Dijkstra算法实现 — dijkstra.h + dijkstra.c

**Files:**
- Create: `metro_router/core/dijkstra.h`
- Create: `metro_router/core/dijkstra.c`

- [ ] **Step 1: 编写dijkstra.h**

```c
#ifndef DIJKSTRA_H
#define DIJKSTRA_H

#include "graph.h"

typedef struct PathResult {
    int *path;
    int path_len;
    double total_time;
    int transfers;
    int found;
} PathResult;

PathResult dijkstra_find_path(Graph *graph, const char *start_station, const char *end_station, int mode);
void path_result_free(PathResult *result);

#endif
```

- [ ] **Step 2: 编写dijkstra.c**

```c
#include "dijkstra.h"
#include "min_heap.h"
#include <stdlib.h>
#include <string.h>
#include <float.h>

PathResult dijkstra_find_path(Graph *graph, const char *start_station, const char *end_station, int mode) {
    PathResult result = {0};
    result.found = 0;
    int n = graph->node_count;

    double *dist = (double*)malloc(sizeof(double) * n);
    int *prev = (int*)malloc(sizeof(int) * n);
    int *visited = (int*)calloc(n, sizeof(int));
    double *time_arr = (double*)malloc(sizeof(double) * n);
    int *transfer_arr = (int*)malloc(sizeof(int) * n);

    for (int i = 0; i < n; i++) {
        dist[i] = DBL_MAX;
        prev[i] = -1;
        time_arr[i] = 0;
        transfer_arr[i] = 0;
    }

    MinHeap *heap = heap_create(n);

    for (int i = 0; i < n; i++) {
        if (strcmp(graph->nodes[i].station, start_station) == 0) {
            dist[i] = 0;
            time_arr[i] = 0;
            transfer_arr[i] = 0;
            HeapNode hn = {i, 0.0, 0.0, 0};
            heap_insert(heap, hn);
        }
    }

    int end_node = -1;

    while (!heap_is_empty(heap)) {
        HeapNode cur = heap_extract_min(heap);

        if (visited[cur.node_id]) continue;
        visited[cur.node_id] = 1;

        if (strcmp(graph->nodes[cur.node_id].station, end_station) == 0) {
            end_node = cur.node_id;
            break;
        }

        Edge *e = graph->nodes[cur.node_id].adj_list;
        while (e) {
            int next = e->to;
            if (visited[next]) {
                e = e->next;
                continue;
            }

            double new_time = time_arr[cur.node_id] + e->weight;
            int new_transfers = transfer_arr[cur.node_id] + e->is_transfer;

            double new_cost;
            if (mode == 0) {
                new_cost = new_time;
            } else {
                new_cost = (double)new_transfers + new_time * 1e-6;
            }

            if (new_cost < dist[next]) {
                dist[next] = new_cost;
                prev[next] = cur.node_id;
                time_arr[next] = new_time;
                transfer_arr[next] = new_transfers;
                HeapNode hn = {next, new_cost, new_time, new_transfers};
                heap_insert(heap, hn);
            }

            e = e->next;
        }
    }

    if (end_node >= 0) {
        result.found = 1;
        result.total_time = time_arr[end_node];
        result.transfers = transfer_arr[end_node];

        int len = 0;
        int tmp = end_node;
        while (tmp != -1) { len++; tmp = prev[tmp]; }

        result.path = (int*)malloc(sizeof(int) * len);
        result.path_len = len;
        tmp = end_node;
        for (int i = len - 1; i >= 0; i--) {
            result.path[i] = tmp;
            tmp = prev[tmp];
        }
    }

    free(dist);
    free(prev);
    free(visited);
    free(time_arr);
    free(transfer_arr);
    heap_destroy(heap);

    return result;
}

void path_result_free(PathResult *result) {
    if (result->path) {
        free(result->path);
        result->path = NULL;
    }
}
```

- [ ] **Step 3: 验证编译**

```powershell
cd metro_router/core
gcc -c dijkstra.c -o dijkstra.o
```

---

### Task 6: C主程序 — main.c

**Files:**
- Create: `metro_router/core/main.c`

- [ ] **Step 1: 编写main.c**

```c
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include "graph.h"
#include "dijkstra.h"

static void strip_newline(char *s) {
    int len = strlen(s);
    while (len > 0 && (s[len-1] == '\n' || s[len-1] == '\r')) {
        s[--len] = '\0';
    }
}

int main(int argc, char *argv[]) {
    if (argc != 3) {
        fprintf(stderr, "Usage: %s <graph_file> <mode:0|1>\n", argv[0]);
        fprintf(stderr, "  Reads start_station and end_station from stdin\n");
        return 1;
    }

    const char *graph_file = argv[1];
    int mode = atoi(argv[2]);

    char start_station[80];
    char end_station[80];
    if (!fgets(start_station, sizeof(start_station), stdin) ||
        !fgets(end_station, sizeof(end_station), stdin)) {
        printf("{\"error\":\"Failed to read station names from stdin\"}\n");
        return 1;
    }
    strip_newline(start_station);
    strip_newline(end_station);

    Graph *graph = graph_load_from_file(graph_file);
    if (!graph) {
        printf("{\"error\":\"Failed to load graph\"}\n");
        return 1;
    }

    PathResult result = dijkstra_find_path(graph, start_station, end_station, mode);

    printf("{\"path\":[");
    if (result.found) {
        char transfer_stations[4096] = "";
        int transfer_count = 0;
        int unique_station_count = 0;
        char last_station[80] = "";
        for (int i = 0; i < result.path_len; i++) {
            GraphNode *node = &graph->nodes[result.path[i]];
            printf("{\"station\":\"%s\",\"line\":\"%s\",\"lon\":%.6f,\"lat\":%.6f}",
                   node->station, node->line, node->lon, node->lat);
            if (i < result.path_len - 1) printf(",");

            if (strcmp(node->station, last_station) != 0) {
                unique_station_count++;
                strcpy(last_station, node->station);
            }

            if (i > 0 && i < result.path_len - 1) {
                GraphNode *prev_node = &graph->nodes[result.path[i - 1]];
                if (strcmp(node->station, prev_node->station) == 0 &&
                    strcmp(node->line, prev_node->line) != 0) {
                    if (transfer_count > 0) strcat(transfer_stations, "\",\"");
                    strcat(transfer_stations, node->station);
                    transfer_count++;
                }
            }
        }
        if (transfer_count > 0) {
            printf("],\"total_time\":%.2f,\"transfers\":%d,\"transfer_stations\":[\"%s\"],\"station_count\":%d}\n",
                   result.total_time, result.transfers, transfer_stations, unique_station_count);
        } else {
            printf("],\"total_time\":%.2f,\"transfers\":0,\"transfer_stations\":[],\"station_count\":%d}\n",
                   result.total_time, unique_station_count);
        }
    } else {
        printf("],\"error\":\"No path found\"}\n");
    }

    path_result_free(&result);
    graph_destroy(graph);
    return 0;
}
```

- [ ] **Step 2: 编写Makefile**

```makefile
CC = gcc
CFLAGS = -Wall -O2 -std=c99
TARGET = metro_router.exe

SRCS = main.c min_heap.c graph.c dijkstra.c
OBJS = $(SRCS:.c=.o)

all: $(TARGET)

$(TARGET): $(OBJS)
	$(CC) $(CFLAGS) -o $@ $^

%.o: %.c
	$(CC) $(CFLAGS) -c $< -o $@

clean:
	rm -f *.o $(TARGET)

.PHONY: all clean
```

- [ ] **Step 3: 编译并测试C程序**

```powershell
cd metro_router/core
mingw32-make
echo "小寨`n华清池" | .\metro_router.exe ..\data\graph.txt 0
```

预期：输出JSON路径结果

---

### Task 7: Flask后端 — app.py

**Files:**
- Create: `metro_router/app.py`

- [ ] **Step 1: 安装Flask**

```powershell
pip install flask
```

- [ ] **Step 2: 编写app.py**

```python
from flask import Flask, render_template, jsonify, request
import subprocess
import json
import os
import platform

app = Flask(__name__)

DATA_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'data')
CORE_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'core')

GRAPH_FILE = os.path.join(DATA_DIR, 'graph.txt')
STATIONS_FILE = os.path.join(DATA_DIR, 'stations.json')
ROUTES_FILE = os.path.join(DATA_DIR, 'routes.json')

if platform.system() == 'Windows':
    EXE_PATH = os.path.join(CORE_DIR, 'metro_router.exe')
else:
    EXE_PATH = os.path.join(CORE_DIR, 'metro_router')

with open(STATIONS_FILE, 'r', encoding='utf-8') as f:
    stations_data = json.load(f)
with open(ROUTES_FILE, 'r', encoding='utf-8') as f:
    routes_data = json.load(f)

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/api/stations')
def api_stations():
    return jsonify(stations_data)

@app.route('/api/routes')
def api_routes():
    return jsonify(routes_data)

@app.route('/api/path')
def api_path():
    start = request.args.get('start', '')
    end = request.args.get('end', '')
    mode = request.args.get('mode', '0')

    if not start or not end:
        return jsonify({'error': 'Missing start or end parameter'}), 400

    try:
        result = subprocess.run(
            [EXE_PATH, GRAPH_FILE, mode],
            input=f"{start}\n{end}\n",
            capture_output=True, text=True, encoding='utf-8', timeout=10
        )
        if result.returncode != 0:
            return jsonify({'error': result.stderr.strip()}), 500
        return jsonify(json.loads(result.stdout))
    except subprocess.TimeoutExpired:
        return jsonify({'error': 'Query timeout'}), 500
    except json.JSONDecodeError:
        return jsonify({'error': 'Invalid response from core'}), 500
    except (FileNotFoundError, OSError):
        return jsonify({'error': 'C核心程序未编译，请运行 mingw32-make'}), 500

if __name__ == '__main__':
    app.run(debug=True, port=5000)
```

- [ ] **Step 3: 验证API**

```powershell
cd metro_router
python app.py
# 另一个终端测试:
# curl http://localhost:5000/api/stations
# curl "http://localhost:5000/api/path?start=小寨&end=华清池&mode=0"
```

---

### Task 8: 前端页面

**Files:**
- Create: `metro_router/templates/index.html`
- Create: `metro_router/static/style.css`
- Create: `metro_router/static/script.js`

- [ ] **Step 1: 编写index.html**

```html
<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>西安地铁换乘最优路径计算器</title>
<link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
<link rel="stylesheet" href="/static/style.css">
</head>
<body>
<div id="sidebar">
    <h2>西安地铁换乘计算器</h2>
    <div class="control-group">
        <label>起点站：</label>
        <div class="select-wrapper">
            <input type="text" id="start-input" placeholder="输入或选择起点站" autocomplete="off">
            <div id="start-dropdown" class="dropdown"></div>
        </div>
    </div>
    <div class="control-group">
        <label>终点站：</label>
        <div class="select-wrapper">
            <input type="text" id="end-input" placeholder="输入或选择终点站" autocomplete="off">
            <div id="end-dropdown" class="dropdown"></div>
        </div>
    </div>
    <div class="btn-group">
        <button id="btn-time" onclick="queryPath(0)">时间最短</button>
        <button id="btn-transfer" onclick="queryPath(1)">换乘最少</button>
    </div>
    <div id="result" class="hidden">
        <div id="result-error" class="error-msg" style="display:none"></div>
        <div id="result-content">
            <div class="result-header">
                <span id="result-time"></span>
                <span id="result-transfers"></span>
            </div>
            <div id="result-stations"></div>
        </div>
    </div>
</div>
<div id="map"></div>

<script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
<script src="/static/script.js"></script>
</body>
</html>
```

- [ ] **Step 2: 编写style.css**

```css
* { margin: 0; padding: 0; box-sizing: border-box; }
html, body { height: 100%; font-family: "Microsoft YaHei", sans-serif; }
#map { width: calc(100% - 340px); height: 100%; float: right; }
#sidebar { width: 340px; height: 100%; float: left; background: #f5f5f5;
    padding: 20px; overflow-y: auto; border-right: 2px solid #ddd; }
#sidebar h2 { font-size: 18px; margin-bottom: 20px; color: #333; text-align: center; }
.control-group { margin-bottom: 12px; }
.control-group label { display: block; font-size: 13px; margin-bottom: 4px; color: #555; }
.select-wrapper { position: relative; }
#start-input, #end-input { width: 100%; padding: 8px 10px; border: 1px solid #ccc;
    border-radius: 4px; font-size: 14px; outline: none; }
#start-input:focus, #end-input:focus { border-color: #4A90D9; }
.dropdown { position: absolute; top: 100%; left: 0; right: 0; max-height: 200px;
    overflow-y: auto; background: #fff; border: 1px solid #ccc; border-top: none;
    border-radius: 0 0 4px 4px; display: none; z-index: 1000; }
.dropdown.show { display: block; }
.dropdown-item { padding: 6px 10px; font-size: 13px; cursor: pointer;
    border-bottom: 1px solid #f0f0f0; }
.dropdown-item:hover { background: #e8f0fe; }
.btn-group { display: flex; gap: 10px; margin: 18px 0; }
.btn-group button { flex: 1; padding: 10px; border: none; border-radius: 4px;
    font-size: 14px; cursor: pointer; color: #fff; transition: opacity 0.2s; }
#btn-time { background: #4A90D9; }
#btn-transfer { background: #E67E22; }
.btn-group button:hover { opacity: 0.85; }
.btn-group button:disabled { opacity: 0.5; cursor: not-allowed; }
#result { margin-top: 16px; }
#result.hidden { display: none; }
#result-content { }
.result-header { display: flex; justify-content: space-between; margin-bottom: 10px;
    font-size: 14px; color: #333; font-weight: bold; }
#result-stations { background: #fff; border-radius: 4px; padding: 12px;
    border: 1px solid #e0e0e0; font-size: 13px; line-height: 1.8; }
.transfer-marker { color: #E67E22; font-weight: bold; }
.line-tag { display: inline-block; padding: 1px 6px; border-radius: 3px;
    color: #fff; font-size: 11px; margin-right: 4px; }
.error-msg { color: #e74c3c; font-size: 13px; text-align: center; padding: 10px; }
.loading { text-align: center; color: #999; padding: 20px; font-size: 13px; }
```

- [ ] **Step 3: 编写script.js**

```javascript
var map, routesData, stationsData, pathLayer, transferMarkers = [];
var ROUTE_COLORS = {};

function initMap() {
    map = L.map('map').setView([34.26, 108.95], 12);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; OpenStreetMap contributors', maxZoom: 18
    }).addTo(map);
    loadData();
}

function loadData() {
    Promise.all([
        fetch('/api/routes').then(r => r.json()),
        fetch('/api/stations').then(r => r.json())
    ]).then(([routes, stations]) => {
        routesData = routes.routes;
        stationsData = stations.stations;
        initSearchInputs();
        drawRoutes();
        drawStations();
    }).catch(() => {
        alert('加载数据失败，请确认已运行 python data_loader.py');
    });
}

function initSearchInputs() {
    setupSearchInput('start-input', 'start-dropdown');
    setupSearchInput('end-input', 'end-dropdown');
}

function setupSearchInput(inputId, dropdownId) {
    var input = document.getElementById(inputId);
    var dropdown = document.getElementById(dropdownId);
    input.addEventListener('input', function() {
        var keyword = this.value.trim().toLowerCase();
        dropdown.innerHTML = '';
        if (!keyword) { dropdown.classList.remove('show'); return; }
        var matches = stationsData.filter(function(s) {
            return s.name.toLowerCase().indexOf(keyword) !== -1;
        }).slice(0, 20);
        if (matches.length === 0) { dropdown.classList.remove('show'); return; }
        matches.forEach(function(s) {
            var div = document.createElement('div');
            div.className = 'dropdown-item';
            div.textContent = s.name + (s.is_transfer ? ' (换乘)' : '');
            div.onclick = function() { input.value = s.name; dropdown.classList.remove('show'); };
            dropdown.appendChild(div);
        });
        dropdown.classList.add('show');
    });
    input.addEventListener('blur', function() {
        setTimeout(function() { dropdown.classList.remove('show'); }, 200);
    });
}

function drawRoutes() {
    routesData.forEach(function(route) {
        ROUTE_COLORS[route.name] = route.color;
        var coords = route.stations.map(function(s) { return [s.lat, s.lon]; });
        L.polyline(coords, { color: route.color, weight: 3, opacity: 0.7 })
            .bindTooltip(route.name, { sticky: true }).addTo(map);
    });
}

function drawStations() {
    stationsData.forEach(function(s) {
        var radius = s.is_transfer ? 6 : 4;
        var color = s.is_transfer ? '#E67E22' : '#4A90D9';
        L.circleMarker([s.lat, s.lon], {
            radius: radius, color: color, fillColor: color,
            fillOpacity: 0.8, weight: 1.5
        }).bindTooltip(s.name).addTo(map);
    });
}

function queryPath(mode) {
    var startInput = document.getElementById('start-input');
    var endInput = document.getElementById('end-input');
    var start = startInput.value.trim();
    var end = endInput.value.trim();
    if (!start || !end) { alert('请输入起点和终点站名'); return; }

    document.getElementById('result').className = 'hidden';
    disableButtons(true);

    fetch('/api/path?start=' + encodeURIComponent(start) + '&end=' +
          encodeURIComponent(end) + '&mode=' + mode)
        .then(function(r) { return r.json(); })
        .then(function(data) {
            disableButtons(false);
            if (data.error) { showError(data.error); return; }
            showResult(data, start, end);
            highlightPath(data);
        })
        .catch(function() { disableButtons(false); showError('查询失败，请重试'); });
}

function disableButtons(disabled) {
    document.getElementById('btn-time').disabled = disabled;
    document.getElementById('btn-transfer').disabled = disabled;
}

function showError(msg) {
    var result = document.getElementById('result');
    result.className = '';
    document.getElementById('result-error').style.display = 'block';
    document.getElementById('result-error').textContent = msg;
    document.getElementById('result-content').style.display = 'none';
}

function showResult(data, start, end) {
    var result = document.getElementById('result');
    result.className = '';
    document.getElementById('result-error').style.display = 'none';
    document.getElementById('result-content').style.display = '';
    document.getElementById('result-time').textContent = '总时间: ' + data.total_time + ' 分钟';
    document.getElementById('result-transfers').textContent = '换乘: ' + data.transfers + ' 次';

    var html = '<strong>路径详情:</strong><br>';
    var lastStation = '';
    for (var i = 0; i < data.path.length; i++) {
        var p = data.path[i];
        if (p.station !== lastStation) {
            var isTransfer = false;
            for (var j = 0; j < data.transfer_stations.length; j++) {
                if (data.transfer_stations[j] === p.station) { isTransfer = true; break; }
            }
            var color = ROUTE_COLORS[p.line] || '#999';
            html += '<span class="line-tag" style="background:' + color + '">' + p.line + '</span>';
            if (isTransfer) {
                html += '<strong class="transfer-marker">' + p.station + ' ← 换乘</strong>';
            } else {
                html += p.station;
            }
            html += '<br>';
            lastStation = p.station;
        }
    }
    document.getElementById('result-stations').innerHTML = html;
}

function highlightPath(data) {
    if (pathLayer) { map.removeLayer(pathLayer); }
    transferMarkers.forEach(function(m) { map.removeLayer(m); });
    transferMarkers = [];

    var coords = data.path.map(function(p) { return [p.lat, p.lon]; });
    pathLayer = L.polyline(coords, { color: '#e74c3c', weight: 6, opacity: 0.85,
        dashArray: '8 8' }).addTo(map);
    map.fitBounds(pathLayer.getBounds(), { padding: [40, 40] });

    data.transfer_stations.forEach(function(name) {
        var station = stationsData.find(function(s) { return s.name === name; });
        if (station) {
            var m = L.marker([station.lat, station.lon], {
                icon: L.divIcon({ className: 'transfer-marker-icon',
                    html: '<div style="background:#E67E22;color:#fff;border-radius:50%;'
                        + 'width:24px;height:24px;line-height:24px;text-align:center;'
                        + 'font-size:12px;border:2px solid #fff;">↔</div>',
                    iconSize: [24, 24], iconAnchor: [12, 12] })
            }).addTo(map);
            transferMarkers.push(m);
        }
    });
}

document.addEventListener('DOMContentLoaded', initMap);
```

---

### Task 9: 集成测试

- [ ] **Step 1: 启动完整系统**

```powershell
cd metro_router
python app.py
```

浏览器打开 http://localhost:5000

- [ ] **Step 2: 测试3条路径**

| 测试 | 起点 | 终点 | 预期换乘 |
|------|------|------|----------|
| 1 | 小寨 | 华清池 | 2次(咸宁路/通化门→纺织城) |
| 2 | 草滩 | 机场西(T1/T2/T3) | 1-2次 |
| 3 | 创新港 | 保税区 | 2-3次 |

分别测试mode=0和mode=1，验证结果合理性。

- [ ] **Step 3: 截图保存**

对3条测试路径的结果截图，保存到doc/目录。

---

### Task 10: 收尾

- [ ] **Step 1: 确认C程序在中文站名下的稳定性**

测试含特殊字符的站名：`机场西(T1/T2/T3)`、`建筑科技大学·李家村`、`西电科大南校区·未来之瞳`

- [ ] **Step 2: 确认前端在Chrome/Edge下的兼容性**

- [ ] **Step 3: 清理**

删除调试用的临时Python脚本（如有）。

---

### Task 11: C核心算法单元测试

**Files:**
- Create: `metro_router/core/test_core.c`

**目标：** 验证最小堆和Dijkstra算法的正确性，覆盖关键边界情况

- [ ] **Step 1: 编写test_core.c**

```c
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <assert.h>
#include "min_heap.h"
#include "graph.h"
#include "dijkstra.h"

void test_min_heap() {
    printf("=== Test MinHeap ===\n");

    MinHeap *heap = heap_create(10);

    // Test 1: 空堆
    assert(heap_is_empty(heap));
    printf("  PASS: empty heap\n");

    // Test 2: 插入并按cost排序提取
    heap_insert(heap, (HeapNode){0, 5.0, 5.0, 0});
    heap_insert(heap, (HeapNode){1, 3.0, 3.0, 0});
    heap_insert(heap, (HeapNode){2, 7.0, 7.0, 0});
    heap_insert(heap, (HeapNode){3, 1.0, 1.0, 0});

    HeapNode n = heap_extract_min(heap);
    assert(n.node_id == 3 && n.cost == 1.0);
    n = heap_extract_min(heap);
    assert(n.node_id == 1 && n.cost == 3.0);
    n = heap_extract_min(heap);
    assert(n.node_id == 0 && n.cost == 5.0);
    n = heap_extract_min(heap);
    assert(n.node_id == 2 && n.cost == 7.0);
    assert(heap_is_empty(heap));
    printf("  PASS: insert and extract_min by cost\n");

    // Test 3: mode=1的cost排序 (transfers优先)
    heap_insert(heap, (HeapNode){0, 2.0, 10.0, 2});  // 2换乘, 10分钟
    heap_insert(heap, (HeapNode){1, 0.000015, 15.0, 0}); // 0换乘, 15分钟
    n = heap_extract_min(heap);
    assert(n.node_id == 1 && n.transfers == 0);  // 0换乘先出
    printf("  PASS: mode=1 cost ordering (fewer transfers first)\n");

    heap_destroy(heap);
}

void test_dijkstra_mode1_bug() {
    printf("=== Test Dijkstra mode=1 bug fix ===\n");

    // 构造触发Bug的图:
    // 线1: S→X→Y→Z→E (每段5分钟, 0换乘)
    // 线2: X→Z (0.5分钟, 极快)
    // 换乘: X(线1↔线2), Z(线1↔线2)
    // mode=1应选0换乘路径(S→X→Y→Z→E), 不是2换乘路径

    Graph *graph = graph_create(7);

    strcpy(graph->nodes[0].station, "S");
    strcpy(graph->nodes[0].line, "L1");
    strcpy(graph->nodes[1].station, "X");
    strcpy(graph->nodes[1].line, "L1");
    strcpy(graph->nodes[2].station, "Y");
    strcpy(graph->nodes[2].line, "L1");
    strcpy(graph->nodes[3].station, "Z");
    strcpy(graph->nodes[3].line, "L1");
    strcpy(graph->nodes[4].station, "E");
    strcpy(graph->nodes[4].line, "L1");
    strcpy(graph->nodes[5].station, "X");
    strcpy(graph->nodes[5].line, "L2");
    strcpy(graph->nodes[6].station, "Z");
    strcpy(graph->nodes[6].line, "L2");

    graph_add_edge(graph, 0, 1, 5.0, "L1", 0);
    graph_add_edge(graph, 1, 2, 5.0, "L1", 0);
    graph_add_edge(graph, 2, 3, 5.0, "L1", 0);
    graph_add_edge(graph, 3, 4, 5.0, "L1", 0);
    graph_add_edge(graph, 1, 5, 2.0, "TR", 1);
    graph_add_edge(graph, 5, 6, 0.5, "L2", 0);
    graph_add_edge(graph, 6, 3, 2.0, "TR", 1);

    PathResult r = dijkstra_find_path(graph, "S", "E", 1);
    assert(r.found);
    assert(r.transfers == 0);
    assert(r.total_time == 20.0);
    printf("  PASS: mode=1 returns 0 transfers (not 2)\n");

    PathResult r0 = dijkstra_find_path(graph, "S", "E", 0);
    assert(r0.found);
    assert(r0.total_time < 20.0);
    printf("  PASS: mode=0 returns faster path with transfers\n");

    path_result_free(&r);
    path_result_free(&r0);
    graph_destroy(graph);
}

void test_dijkstra_no_transfer() {
    printf("=== Test Dijkstra no-transfer path ===\n");

    // 简单3站线路, 无换乘
    Graph *graph = graph_create(3);
    strcpy(graph->nodes[0].station, "A");
    strcpy(graph->nodes[0].line, "L1");
    strcpy(graph->nodes[1].station, "B");
    strcpy(graph->nodes[1].line, "L1");
    strcpy(graph->nodes[2].station, "C");
    strcpy(graph->nodes[2].line, "L1");

    graph_add_edge(graph, 0, 1, 2.0, "L1", 0);
    graph_add_edge(graph, 1, 2, 3.0, "L1", 0);

    PathResult r = dijkstra_find_path(graph, "A", "C", 0);
    assert(r.found);
    assert(r.transfers == 0);
    assert(r.total_time == 5.0);
    assert(r.path_len == 3);
    printf("  PASS: no-transfer path correct (time=5.0, transfers=0)\n");

    path_result_free(&r);
    graph_destroy(graph);
}

void test_dijkstra_same_station() {
    printf("=== Test Dijkstra same start and end ===\n");

    Graph *graph = graph_create(2);
    strcpy(graph->nodes[0].station, "A");
    strcpy(graph->nodes[0].line, "L1");
    strcpy(graph->nodes[1].station, "B");
    strcpy(graph->nodes[1].line, "L1");

    graph_add_edge(graph, 0, 1, 2.0, "L1", 0);

    PathResult r = dijkstra_find_path(graph, "A", "A", 0);
    assert(r.found);
    assert(r.transfers == 0);
    assert(r.total_time == 0.0);
    assert(r.path_len == 1);
    printf("  PASS: same station returns 0 time, 0 transfers\n");

    path_result_free(&r);
    graph_destroy(graph);
}

int main() {
    test_min_heap();
    test_dijkstra_mode1_bug();
    test_dijkstra_no_transfer();
    test_dijkstra_same_station();
    printf("\nAll tests passed!\n");
    return 0;
}
```

- [ ] **Step 2: 编译并运行测试**

```powershell
cd metro_router/core
gcc -Wall -O2 -std=c99 test_core.c min_heap.c graph.c dijkstra.c -o test_core.exe
.\test_core.exe
```

预期输出：`All tests passed!`

---

## 10. TDD审查报告

### 已发现并修复的关键Bug

#### Bug #1（严重）：Dijkstra mode=1堆排序错误

**问题**：原设计中HeapNode只有`total_time`和`transfers`字段，堆按`total_time`排序。mode=1下cost=transfers+time×1e-6，但堆按time排序，导致短时间多换乘路径被优先探索。

**验证**：构造测试图（线1: S→X→Y→Z→E每段5分钟, 线2: X→Z仅0.5分钟），mode=1下：
- Buggy版本：返回2次换乘14.5分钟 ❌
- 正确版本：返回0次换乘20.0分钟 ✅

**修复**：HeapNode增加`cost`字段作为堆排序依据，sift_up/sift_down比较`cost`而非`total_time`。Dijkstra中`HeapNode hn = {next, new_cost, new_time, new_transfers}`。

#### Bug #2（严重）：Windows argv编码不匹配

**问题**：原设计将中文站名作为命令行参数传递给C程序。Windows下C运行时将argv从UTF-16转换为系统默认编码（中文Windows为GBK），而graph.txt是UTF-8编码。`strcmp(GBK字符串, UTF-8字符串)`对中文必定失败。

**验证**：`"小寨"`的GBK编码为`d0a1d5af`，UTF-8编码为`e5b08fe5afa8`，`strcmp`比较结果不相等。

**修复**：站名改为通过stdin传递。C程序用`fgets`从stdin读取，Python用`subprocess.run(..., input=f"{start}\n{end}\n")`发送。stdin的编码由Python控制为UTF-8，C程序读取原始字节，与graph.txt中的UTF-8字节一致。

#### Bug #3（中等）：空换乘站JSON输出错误

**问题**：当路径无换乘时，`transfer_stations`字符串为空，输出`"transfer_stations":[""]`（含一个空字符串元素的数组），应为`"transfer_stations":[]`。

**修复**：在main.c中判断`transfer_count > 0`，分别输出有换乘和无换乘两种格式的JSON。

#### Bug #4（低）：data_loader.py方向合并策略不安全

**问题**：原设计使用`drop_duplicates(subset=['name_cn', 'line_short'])`合并双向数据。两个方向的sequence值互为反序（方向A: 1→30, 方向B: 30→1），混合后排序可能乱序。当前数据因方向A先出现而偶然正确，但不可靠。

**验证**：检查了1/2/9号线，当前数据sequence确实单调递增，但这是偶然的。

**修复**：改为只保留每条线路的正方向（第一个route_cn），再drop_duplicates。确保sequence值来自同一方向，排序后一定单调递增。

#### Bug #5（中等）：station_count包含换乘站重复节点

**问题**：`station_count`直接使用`result.path_len`，但路径中换乘站出现两次（如"咸宁路(3号线)"和"咸宁路(6号线)"是两个path节点）。路径`小寨→咸宁路→咸宁路→纺织城→纺织城→华清池`的path_len=6，但实际只经过4个物理站点，station_count应为4而非6。

**验证**：Python模拟确认，6个path节点去重后只有4个物理站点。

**修复**：在main.c中增加`unique_station_count`计数器，遍历path时用`last_station`去重，只统计不同站名的数量。

### 其他已识别问题

| # | 问题 | 严重程度 | 处理方式 |
|---|------|---------|---------|
| 5 | `fscanf %s`读取中文站名——含`·`和`()`的站名 | 低 | 已验证`%s`可正确读取UTF-8中文+特殊符号（不含空格） |
| 6 | Makefile `del`命令在MinGW下不兼容 | 低 | 已改为`rm -f` |
| 7 | graph.txt空格分隔——站名含空格会解析错误 | 低 | 当前数据集无空格站名；若未来有，改用`\t`分隔 |
| 8 | C程序无单元测试 | 中 | 已添加Task 11，含min_heap和dijkstra测试 |
| 9 | main.c中transfer_stations缓冲区4096字节可能溢出 | 低 | 西安地铁换乘站不超过50个，每个站名不超过80字节，4096足够 |
| 10 | 站名含`/`字符（如`机场西(T1/T2/T3)`） | 低 | `fscanf %s`可正确读取，`/`不是空白字符 |

### 未覆盖的边界情况（需在集成测试中验证）

- 起终点相同（应返回0时间0换乘）
- 起终点不在图中（应返回"No path found"）
- 起终点在同一线路上无换乘（应返回直达路径）
- 环线站点（西安地铁无环线，暂不处理）
- stdin读取站名时的编码一致性（Python发送UTF-8，C读取原始字节）

---

## 11. 第四轮审查报告

### 已发现并修复的问题

#### 问题 #1（中等）：Task 8前端代码空白

**问题**：Task 8只有功能描述的bullet points，没有任何可执行的HTML/CSS/JS代码。实现者需自行编写完整前端，容易引入Bug。

**修复**：补全完整的 `index.html`（50行）、`style.css`（35行）、`script.js`（115行）代码。

#### 问题 #2（低）：Task 10引用已删除文件

**问题**：Task 10的Step 3写 `删除verify_bug.py等调试文件`，但该文件在前几轮已删除。直接按文档执行会导致困惑。

**修复**：改为通用描述 `删除调试用的临时Python脚本（如有）`。

### 已验证无问题的部分

| 模块 | 审查结论 |
|------|---------|
| `subprocess.TimeoutExpired` 拼写 | Python标准库正确名称 ✅ |
| `write_routes_json` dict插入顺序 | Python 3.7+保证插入顺序，nodes已按线路+sequence排序 ✅ |
| `pathLayer` 添加换乘标记 | 标记添加到pathLayer上，clearLayer后一起清除 ✅ |
| `showResult` 换乘站去重 | 用户可见的路径列表按物理站去重（`lastStation`判断） ✅ |
| JS中 `find` 查找中文站名 | `===` 严格比较UTF-8字符串，与API返回一致 ✅ |

---

## 12. 第五轮审查报告

### 已发现并修复的关键Bug

#### Bug #6（严重）：script.js中 `marker.addTo(pathLayer)` 运行时崩溃

**问题**：`highlightPath` 函数中 `L.marker(...).addTo(pathLayer)`，`pathLayer` 是 `L.polyline` 对象。Leaflet 的 `addTo` 方法调用目标对象的 `addLayer` 方法，但 `Polyline` 没有 `addLayer`（只有 `Map`/`LayerGroup`/`FeatureGroup` 才有）。执行时会抛出 `TypeError: pathLayer.addLayer is not a function`，导致路径查询后页面崩溃，换乘标记不显示。

**修复方案**：
1. 换乘标记改用 `addTo(map)` 添加到地图
2. 维护 `transferMarkers` 数组追踪所有换乘标记
3. 每次查询前遍历 `transferMarkers` 逐个 `map.removeLayer()` 清除旧标记
4. 同步删除无用的 `stationMarkers` 数组（从未被读取）

### 其他已识别问题

| # | 问题 | 严重程度 | 处理方式 |
|---|------|---------|---------|
| 7 | test_core.c 测试图边单向：A→B→C 无反向边 | 低 | 不影响测试（只测正向），但不够真实。注明即可 |
| 8 | Task 6 的 stdin 测试在编译阶段执行 | 低 | 保留，增加注释说明这是可执行文件端到端测试 |

### 已验证无问题的部分

| 模块 | 审查结论 |
|------|---------|
| Python `input=\n` → C `fgets` 编码链路 | Python stdin写UTF-8字节，C text mode只做CRLF→LF转换，不改变编码 ✅ |
| `new_cost = transfers + time*1e-6` 精度 | double容量下换乘差>1，时间差<1e6分钟（~2年），精度充足 ✅ |
| `graph_create` 使用 `calloc` | `adj_list` 初始化为 NULL ✅ |
| `unique_station_count` 初始 `last_station=""` | 空字符串不匹配任何站名，第一个站正确+1 ✅ |
| `strip_newline` 处理 `\r\n` 和 `\n` | 从后往前删，覆盖两种换行符 ✅ |
| `fscanf %79s` 读站名含 `()` `/` `·` | 这些字符不是空白字符，`%s` 完整读取 ✅ |
| C99 compound literals `(HeapNode){...}` | `gcc -std=c99` 完整支持 ✅ |

### 审查总结（五轮累计）

| 轮次 | 严重Bug | 中等Bug | 低问题 | 累计修复 |
|------|---------|---------|--------|---------|
| 第1轮 | #1 堆排序 | - | - | 1 |
| 第2轮 | #2 编码 | #3 JSON空, #6** | #4 方向合并 | 4 |
| 第3轮 | - | #5 station_count | - | 5 |
| 第4轮 | - | #7** 前端空白 | #8** 引用过期 | 7 |
| 第5轮 | #6* marker崩溃 | - | #7 测试单向, #8 命令位置 | 8 |

> **注**：#6* (marker崩溃) 和 #6** (前端空白) 编号重复是因为四轮审查后将问题#1-#5分别编号为Bug，四轮新增问题用了#1-#2编号。此处统一用 Bug #1-#8 标识实际修复的所有问题。

---

## 13. 第六轮审查报告

### 已发现并修复的关键Bug

#### Bug #9（中等）：`showError` 销毁 DOM 元素，导致后续成功查询崩溃

**问题**：`showError` 函数使用 `result.innerHTML = '<div class="error-msg">...'` 替换 `#result` 的全部内容，这会销毁内部的 `#result-time`、`#result-transfers`、`#result-stations` 三个子元素。

触发流程：
1. 用户第一次查询失败 → `showError` 被调用 → DOM 子元素被销毁
2. 用户修正输入后再次查询成功 → `showResult` 尝试访问 `document.getElementById('result-time')` → **返回 `null`** → `.textContent = ...` → `TypeError: Cannot set properties of null` → 页面崩溃，结果无法显示

直到用户刷新页面之前，所有后续查询都会崩溃。

**修复方案**：
1. HTML 增加专用的 `<div id="result-error">` 错误消息容器和一个 `<div id="result-content">` 包装器
2. `showError`：设置 `result-error` 的文本并显示，隐藏 `result-content`
3. `showResult`：隐藏 `result-error`，显示 `result-content`，正常设置结果数据
4. DOM 结构始终保持完整，错误和成功状态仅切换可见性

#### 问题 #3（低）：Flask 未捕获 `FileNotFoundError`

**问题**：C 核心程序未编译时，`subprocess.run([EXE_PATH, ...])` 抛出 `FileNotFoundError`，未被 `try/except` 捕获。Flask 返回 500 Internal Server Error 而非有意义的错误提示。

**修复**：增加 `except (FileNotFoundError, OSError)` 分支，返回 `"C核心程序未编译，请运行 mingw32-make"`。

### 已验证无问题的部分

| 模块 | 审查结论 |
|------|---------|
| Dijkstra mode=1 最优子结构 | cost=transfers+time×1e-6 线性可加，所有边权非负，Dijkstra 保证最优解 ✅ |
| `new_cost < dist[next]` 浮点比较 | 换乘差≥1，时间差≤200分钟，cost差≥0.9998，远超 double epsilon ✅ |
| Dijkstra visited 预检查 | 在边遍历时检查 visited 跳过已提取节点，允许同节点多次入堆更新，正确 ✅ |
| 起终点相同 | 入堆即提取，cost=0 → 返回 0 时间 0 换乘 1 站 ✅ |
| 起终点不在图中 | 堆空后 end_node=-1 → `found=0` → `"No path found"` ✅ |
| `graph.txt` 站名含 `()` `/` `·` | `fscanf %s` 以空白字符分隔，这些符号不是空白字符，完整读取 ✅ |
| `build_graph` segments 键冲突 | sorted key 唯一标识无向边，双向段距离相同，后写入覆盖不影响正确性 ✅ |
| `write_routes_json` 站点顺序 | nodes 已按 line_short + sequence 排序，dict 保持插入顺序 ✅ |
| `showResult` 换乘站去重 | `p.station !== lastStation` 正确去重，首个出现显示换乘标记 ✅ |
| `highlightPath` 空 transfer_stations | `forEach` 在空数组上不执行，无崩溃 ✅ |
| `data_loader.py` 加载 stops_unique | 加载后未使用，属冗余代码，不影响功能 ✅ |

### 审查总结（六轮累计）

| 轮次 | 严重Bug | 中等Bug | 低问题 | 累计修复 |
|------|---------|---------|--------|---------|
| 第1轮 | #1 堆排序 | - | - | 1 |
| 第2轮 | #2 编码 | #3 JSON空, #6** | #4 方向合并 | 4 |
| 第3轮 | - | #5 station_count | - | 5 |
| 第4轮 | - | #7** 前端空白 | #8** 引用过期 | 7 |
| 第5轮 | #6* marker崩溃 | - | #7 测试单向, #8 命令位置 | 8 |
| 第6轮 | - | #9 DOM销毁 | #3** FileNotFoundError | 10 |

> **Bug 编号汇总**：#1(堆排序) #2(编码) #3(JSON空) #4(方向合并) #5(station_count) #6(marker崩溃) #7(前端空白) #8(引用过期) #9(DOM销毁)
>
> 六轮 TDD 审查共发现并修复 **10 个问题**（3 严重 + 4 中等 + 3 低），覆盖数据结构正确性、操作系统编码、JSON 格式、DOM 生命周期、异常处理完整性等维度。方案现已高度稳定，可进入实现阶段。

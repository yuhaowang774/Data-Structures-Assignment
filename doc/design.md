# 设计说明

## 1. 设计目标

本项目面向课程要求，目标是完成一套可运行、可解释、可展示的地铁路径计算系统。系统设计同时强调以下几点：

- 数据来源真实
- 核心算法清晰
- 系统结构完整
- 页面结果可演示

为此，项目采用“C 核心算法 + Python 服务层 + Web 前端展示”的整体方案。

## 2. 总体架构

项目采用三层结构：

### 2.1 算法层

目录：

- `metro_router/core/`

职责：

- 读取 `graph.txt`
- 构建图结构
- 执行路径搜索
- 输出 JSON 结果

语言：

- C

### 2.2 服务层

目录：

- `metro_router/app.py`

职责：

- 加载运行数据
- 调用 C 核心程序
- 暴露 Flask API
- 对查询结果做二次整理
- 生成备用方案
- 应用时段调度权重

语言：

- Python

### 2.3 展示层

目录：

- `metro_router/templates/`
- `metro_router/static/`

职责：

- 地图展示
- 起终点输入
- 路径查询
- 结果展示
- 备用方案切换
- 时段调度控制
- Dijkstra 可视化

技术：

- HTML
- CSS
- JavaScript
- Leaflet

## 3. 数据来源与转换

原始轨道交通数据位于：

```text
CPTOND-2025/dataset/metro/shapefiles/sian/
```

当前主项目直接依赖的原始文件包括：

- `sian_metro_routes.*`
- `sian_metro_segments.*`
- `sian_metro_stops.*`
- `sian_metro_stops_unique.*`

数据转换脚本为：

- `metro_router/data_loader.py`

转换后生成的运行文件为：

- `metro_router/data/graph.txt`
- `metro_router/data/stations.json`
- `metro_router/data/routes.json`

其中：

- `graph.txt` 供 C 核心直接读取
- `stations.json` 供前端搜索与站点展示
- `routes.json` 供前端绘制线路和路径

## 4. 图模型设计

### 4.1 节点定义

本项目没有采用“一个物理站点对应一个图节点”的简单建模方式，而是采用：

- `站名 + 线路` 作为状态节点

例如：

- `小寨-地铁2号线`
- `小寨-地铁3号线`

这是两个不同的图节点。

这种设计的好处在于：

- 可以显式表示换乘行为
- 可以精确统计换乘次数
- 可以在路径恢复时说明“在哪一站、从哪条线换到哪条线”

### 4.2 边的定义

图中边分为两类：

- 行车边
  - 连接同一条线路上的相邻站点
  - 权重表示行车时间

- 换乘边
  - 连接同名站点的不同线路状态节点
  - 权重固定为 2 分钟

## 5. C 层数据结构设计

### 5.1 图结构

定义位于：

- `metro_router/core/graph.h`

核心结构包括：

- `Edge`
- `GraphNode`
- `Graph`

实现方式为：

- 节点数组
- 邻接链表

之所以采用邻接表，是因为当前图属于稀疏图，更适合 Dijkstra 的松弛过程，也更适合遍历邻边的使用场景。

### 5.2 最小堆

定义位于：

- `metro_router/core/min_heap.h`
- `metro_router/core/min_heap.c`

实现方式为：

- 基于数组的二叉最小堆

堆节点包含：

- `node_id`
- `cost`
- `total_time`
- `transfers`

复杂度如下：

- `heap_insert`: `O(log n)`
- `heap_extract_min`: `O(log n)`
- `heap_is_empty`: `O(1)`

## 6. 路径算法设计

### 6.1 算法选择

本项目使用扩展 Dijkstra，而不是 BFS。

原因在于：

- 图中边权不相等
- 行车边和换乘边都具有时间代价
- 系统需要支持多目标排序

### 6.2 模式设计

当前系统支持三种查询模式：

- `mode=0`
  - 时间最短

- `mode=1`
  - 换乘最少
  - 当换乘数相同时，以总时间更短者优先

- `mode=2`
  - 综合最优

### 6.3 代价函数

`mode=0`：

- `cost = total_time`

`mode=1`：

- `cost = transfers + total_time * 1e-6`

该设计保证：

- 先比较换乘数
- 再比较总时间

`mode=2` 已写入源码。若 `metro_router.exe` 未与最新源码同步重编，后端会自动使用 Python 实现兜底。

## 7. C 程序接口设计

主程序位于：

- `metro_router/core/main.c`

调用方式：

```text
metro_router.exe <graph_file> <mode>
```

起点和终点通过标准输入传入：

```text
<start_station>
<end_station>
```

输出为 JSON，便于 Flask 直接解析。

## 8. Flask 层设计

后端入口：

- `metro_router/app.py`

主要接口包括：

- `/api/graph`
- `/api/stations`
- `/api/routes`
- `/api/path`
- `/api/query`
- `/api/compare`

### 8.1 `/api/path`

提供单一路径查询。

### 8.2 `/api/query`

作为前端主查询入口，支持：

- 三种查询模式
- 备用方案生成
- 时段调度配置透传

### 8.3 `/api/compare`

同时返回：

- 时间最短结果
- 换乘最少结果
- 综合最优结果

### 8.4 结果二次加工

后端会在 C 层原始结果之上补充：

- `mode_label`
- `unique_path`
- `itinerary`
- `segments`
- `lines_used`
- `current_period`

这一步使页面能够展示人类可读的乘车步骤，而不仅是节点序列。

## 9. 前端设计

页面入口：

- `metro_router/templates/index.html`

样式文件：

- `metro_router/static/style.css`

主逻辑文件：

- `metro_router/static/script.js`

辅助逻辑文件：

- `metro_router/static/path-logic.js`
- `metro_router/static/schedule-config.js`
- `metro_router/static/dijkstra-viz.js`

当前前端支持：

- 站点模糊搜索
- 地图选点
- 三种模式查询
- 备用方案展示与切换
- 地图路径高亮
- 调度模式切换
- 高峰 / 平峰系数调整
- 线路单独权重覆盖
- Dijkstra 可视化

## 10. 备用方案生成

备用方案生成逻辑位于：

- `metro_router/app.py` 中的 `find_alternative_paths`

实现方式是对主方案路径中的中间站点施加惩罚，从而尝试构造不同方案。

该设计遵循以下原则：

- 主方案仍保持原始搜索结果中的最优解
- 惩罚仅参与搜索排序
- 惩罚不应进入最终展示时间

因此，备用方案既能体现差异，又不会污染主方案时间统计。

## 11. 时段调度设计

前端配置位于：

- `metro_router/static/schedule-config.js`

后端会接收并应用：

- 不同时段的运行系数
- 换乘系数
- 线路单独覆盖系数

默认划分为：

- 早高峰
- 晚高峰
- 平峰

## 12. 对比工具设计

目录：

- `compare/`

该部分用于比较本地路径结果与高德结果，整体实现统一采用 Python。

关键文件包括：

- `config.py`
- `local_router.py`
- `amap_client.py`
- `test_case_generator.py`
- `comparator.py`
- `reporter.py`
- `generate_report.py`
- `run_compare.py`
- `start_compare.bat`
- `start_compare.ps1`

其中：

- `local_router.py` 复用当前项目逻辑执行本地查询
- `amap_client.py` 负责高德接口访问与结果解析
- `comparator.py` 负责结果比较
- `reporter.py` 与 `generate_report.py` 负责结果落盘与报告生成

## 13. 当前运行规模

以当前 `metro_router/data/` 中的运行数据为准：

- 线路数：13
- 物理站点数：250
- 换乘站数：37
- 状态节点数：289
- 有向边数：636

这组数字可作为项目说明、报告和答辩中的统一口径。

## 14. 当前代码与二进制状态

当前需要注意：

- `metro_router/core/dijkstra.c`
- `metro_router/core/main.c`

在 2026-06-02 做过更新，而仓库中的：

- `metro_router/core/metro_router.exe`

时间戳早于源码更新。

因此：

- `mode=0`、`mode=1` 仍可直接调用现有 C 核心
- `mode=2` 若发现二进制落后，后端会使用 Python 兜底

若希望全部模式都由最新 C 核心执行，需要在本机重新编译。

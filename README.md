# 西安地铁换乘路径计算器

基于真实西安地铁线路数据，使用 C 语言实现核心 Dijkstra 最短路径算法，Python + Flask 提供后端服务，HTML/CSS/JavaScript + Leaflet 构建可视化界面的地铁换乘路径查询系统。

## 主要功能

- **时间最短路径查询** — 以乘车时间为权重，计算起点到终点的最快路线
- **换乘最少路径查询** — 以换乘次数为权重，计算换乘最少的路线
- **综合最优路径查询** — 综合时间与换乘因素，推荐最优路线
- **备用方案生成** — 基于惩罚因子的 Dijkstra 算法生成多条备选路线
- **时段调度权重调整** — 支持高峰/平峰/夜间时段的权重动态调整
- **Dijkstra 算法过程可视化** — 实时展示算法搜索过程
- **高德地铁路径对比分析** — 本地结果与高德 API 结果的对比测试

### 数据规模

| 指标 | 数值 |
|------|------|
| 线路数 | 13 |
| 物理站点数 | 250 |
| 换乘站数 | 37 |
| 状态节点数 | 289 |
| 有向边数 | 636 |

## 快速开始

### 环境要求

- Python 3.10+
- Flask（`pip install flask`）
- MinGW-w64 / MSYS2（用于编译 C 核心，如需重编译）
- geopandas、pandas（用于数据重建，可选）

### 一键启动

```powershell
.\start_project.bat
```

或：

```powershell
powershell -ExecutionPolicy Bypass -File .\start_project.ps1
```

启动后浏览器访问 http://127.0.0.1:5000

### 手动启动

```powershell
python metro_router/app.py
```

### 重建运行数据

如需从原始 Shapefile 重新生成数据：

```powershell
pip install geopandas pandas
python metro_router/data_loader.py
```

### 运行对比测试

```powershell
python -m compare.run_compare
```

## 项目结构

```
Data-Structures-Assignment/
├─ start_project.bat          # 一键启动脚本（Windows）
├─ start_project.ps1          # 一键启动脚本（PowerShell）
├─ 项目文件说明.md             # 项目文件详细说明
├─ metro_router/              # 主项目代码
│  ├─ app.py                  # Flask 后端入口
│  ├─ data_loader.py          # Shapefile → 运行数据转换
│  ├─ data/                   # 运行时数据文件
│  │  ├─ graph.txt            # 图结构数据
│  │  ├─ stations.json        # 站点信息
│  │  └─ routes.json          # 线路信息
│  ├─ templates/index.html    # 页面模板
│  ├─ static/                 # 前端资源
│  │  ├─ script.js            # 主查询逻辑
│  │  ├─ path-logic.js        # 路径分段逻辑
│  │  ├─ schedule-config.js   # 调度面板
│  │  ├─ dijkstra-viz.js      # Dijkstra 可视化
│  │  └─ style.css            # 样式
│  └─ core/                   # C 语言核心算法
│     ├─ graph.h / graph.c    # 图结构与加载
│     ├─ min_heap.h / min_heap.c  # 最小堆实现
│     ├─ dijkstra.h / dijkstra.c  # Dijkstra 算法
│     ├─ main.c               # C 程序入口
│     ├─ test_core.c          # C 层测试
│     └─ Makefile             # 编译配置
├─ compare/                   # 高德对比测试
│  ├─ config.py               # 配置（API Key 等）
│  ├─ local_router.py         # 本地查询封装
│  ├─ amap_client.py          # 高德接口客户端
│  ├─ comparator.py           # 结果比较器
│  ├─ test_case_generator.py  # 测试用例生成
│  ├─ reporter.py             # 结果输出
│  ├─ generate_report.py      # Markdown 报告生成
│  ├─ run_compare.py          # 对比测试入口
│  └─ output/                 # 对比结果输出
├─ CPTOND-2025/               # 城市公共交通数据
│  ├─ city_list/              # 城市清单
│  ├─ code/                   # 数据处理脚本
│  └─ dataset/metro/          # 轨道交通 Shapefile
└─ doc/                       # 项目文档
   ├─ design.md               # 设计说明
   ├─ beginner_guide_zh.md    # 初学者阅读指南
   ├─ metro_router_query_flow.svg  # 查询流程图
   ├─ project report/         # 实验报告
   └─ project requirements/   # 课程要求
```

## 分支介绍

本项目包含三个分支，分别对应不同的技术方案和实现阶段：

### `master` — 主分支（C + Python + Flask 全栈方案）

默认分支，包含完整的项目代码。核心路径搜索算法使用 C 语言实现，通过子进程调用；后端使用 Python Flask 提供 API 服务；前端使用 Leaflet 地图可视化。这是功能最完整的版本，包含对比测试工具、数据重建脚本和完整的文档。

**技术栈**：C (Dijkstra) + Python (Flask) + JavaScript (Leaflet)

**特点**：
- C 语言核心算法，性能最优
- Flask 后端提供 RESTful API
- 完整的对比测试系统
- 数据可从 Shapefile 重建

### `pure-frontend` — 纯前端方案

将 Dijkstra 算法完全用 JavaScript 实现，无需后端服务器。所有数据（站点、线路、图结构）以 JSON 文件形式直接加载，打开 `index.html` 即可运行。对比测试工具使用 Node.js 实现。

**技术栈**：纯 JavaScript + HTML/CSS + Leaflet

**特点**：
- 零后端依赖，打开即用
- JavaScript 实现 Dijkstra 算法
- 适合快速演示和静态部署
- Node.js 版对比测试工具

### `flutter-app` — Flutter 移动端方案

使用 Flutter 框架开发的移动端应用，支持 Android 和 iOS 平台。Dart 语言重新实现了 Dijkstra 算法、最小堆和图结构，集成地图显示和路线查询功能。

**技术栈**：Flutter + Dart

**特点**：
- 原生移动端体验
- Dart 实现完整算法
- 支持 Android / iOS
- 内置 WGS84→GCJ02 坐标转换

## 贡献指南

1. Fork 本仓库
2. 创建功能分支（`git checkout -b feature/your-feature`）
3. 提交更改（`git commit -m 'feat: add your feature'`）
4. 推送分支（`git push origin feature/your-feature`）
5. 创建 Pull Request

## 许可证

本项目仅供学习和教学使用。

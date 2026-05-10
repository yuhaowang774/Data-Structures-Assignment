# pure-frontend 分支设计

## 目标

用 Git 分支维护两个完全隔离的项目形态：
- **master 分支**：完整前后端不分离版本（Flask + C + Leaflet.js）
- **pure-frontend 分支**：纯前端静态版本，浏览器直接打开或 http-server 运行

切换分支即切换项目形态，分支间不合并。

## 方案选择

从 master 创建 `pure-frontend` 分支，就地改造。保留共同 Git 历史，操作简单。

## pure-frontend 分支目录结构

```
根目录/
├── index.html          # 入口页面
├── style.css           # 样式
├── script.js           # 逻辑（含 JS Dijkstra）
├── data/
│   ├── graph.json      # 图数据（从 graph.txt 转换）
│   ├── stations.json   # 站点数据
│   └── routes.json     # 线路数据
```

### 与 master 分支的差异

| 操作 | 文件/目录 | 说明 |
|------|----------|------|
| 删除 | `metro_router/app.py` | Flask 后端 |
| 删除 | `metro_router/data_loader.py` | 数据预处理脚本 |
| 删除 | `metro_router/core/` | C 核心算法 |
| 删除 | `CPTOND-2025/` | 原始数据集 |
| 删除 | `doc/` | 设计文档 |
| 删除 | `docs/` | specs 文档 |
| 删除 | `metro_router/templates/` | Flask 模板目录 |
| 删除 | `metro_router/static/` | Flask 静态目录 |
| 删除 | 根目录散落的临时文件 | `fetch_osm_data.py`、`generate_line8_line15.py`、`*.json` 等 |
| 移动 | `metro_router/data/` → `data/` | 数据目录移至根目录 |
| 移动 | `templates/index.html` → `index.html` | 根目录 |
| 移动 | `static/style.css` → `style.css` | 根目录 |
| 移动 | `static/script.js` → `script.js` | 根目录（重写） |
| 保留 | `data/stations.json` | 原样（从 metro_router/data/ 移来） |
| 保留 | `data/routes.json` | 原样（从 metro_router/data/ 移来） |
| 新增 | `data/graph.json` | 从 graph.txt 转换 |
| 新增 | `.gitignore` | 忽略 OS 临时文件 |

## graph.json 格式

将 graph.txt 转换为 JS 友好的 JSON 结构：

```json
{
  "nodes": [
    {"id": 0, "station": "纺织城", "line": "地铁1号线", "lon": 109.078, "lat": 34.273}
  ],
  "edges": [
    {"from": 0, "to": 1, "weight": 1.85, "line": "地铁1号线", "is_transfer": 0},
    {"from": 253, "to": 0, "weight": 2.00, "line": "换乘", "is_transfer": 1}
  ]
}
```

**注意**：`is_transfer` 必须为 `0`/`1`（整数），不能用 `true`/`false`。JS Dijkstra 中 `transfer_arr[cur] + edge.is_transfer` 依赖数值类型（`0 + true === 1` 虽然在 JS 中可行，但语义不清晰）。

## JS Dijkstra 实现

### MinHeap 类

- 二叉堆，数组存储
- `insert(node)`：插入末尾 + sift_up，O(log n)
- `extractMin()`：交换首尾 + sift_down，O(log n)
- HeapNode：`{ nodeId, cost, totalTime, transfers }`
- mode=0 时 cost = totalTime，mode=1 时 cost = transfers + totalTime * 1e-6

### dijkstra 函数

与 C 版本逻辑完全一致：
- 输入：起点站名、终点站名、mode（`adjList`和`nodes`通过模块级变量访问，由`loadData()`初始化）
- 邻接表构建：从 graph.json 的 nodes + edges 构建 `Edge[][]`（`adjList[nodeId] = [{to, weight, line, is_transfer}, ...]`）
- 算法流程：初始化 → 堆插入所有匹配起点站名的节点 → 循环提取最小 → visited 懒删除 → 松弛 → 回溯路径
- 输出格式（与 C 版本精确匹配）：

```javascript
// 成功
{
  path: [{station:"小寨",line:"地铁3号线",lon:108.942,lat:34.224}, ...],
  total_time: 58.56,
  transfers: 2,
  transfer_stations: ["通化门","纺织城"],
  station_count: 24
}
// 失败
{path: [], error: "No path found"}
```

- `transfer_stations` 计算：遍历 path（`i=1`至`path.length-2`），`path[i].station === path[i-1].station && path[i].line !== path[i-1].line` → 换乘站。跳过首尾节点，与 C 代码 `i > 0 && i < result.path_len - 1` 一致
- `station_count` 计算：遍历 path，`path[i].station !== lastStation` 时 +1（去重物理站点）
- 多起点处理：起点站名可能匹配多个节点（不同线路），全部插入堆中，cost=0

### 数据加载

```javascript
Promise.all([
  fetch('data/graph.json').then(r => r.json()),
  fetch('data/stations.json').then(r => r.json()),
  fetch('data/routes.json').then(r => r.json())
]).then(([graph, stations, routes]) => { ... });
```

## index.html 改造

- CSS 引用：`href="style.css"`（无 `/static/` 前缀）
- JS 引用：`src="script.js"`（无 `/static/` 前缀）
- 移除 Flask 模板语法依赖

## script.js 核心改造

### 模块级变量

```javascript
var graphData, adjList;  // 新增：graph.json 数据及邻接表
```

### loadData 改造

```javascript
function loadData() {
    Promise.all([
        fetch('data/graph.json').then(r => r.json()),
        fetch('data/stations.json').then(r => r.json()),
        fetch('data/routes.json').then(r => r.json())
    ]).then(([graph, stations, routes]) => {
        graphData = graph;
        buildAdjList();           // 新增：构建邻接表
        routesData = routes.routes;
        stationsData = stations.stations;
        initSearchInputs();
        drawRoutes();
        drawStations();
    }).catch(() => {
        alert('加载数据失败');    // 修改：移除 data_loader.py 提示
    });
}

function buildAdjList() {
    adjList = {};
    for (var i = 0; i < graphData.nodes.length; i++) {
        adjList[graphData.nodes[i].id] = [];
    }
    for (var j = 0; j < graphData.edges.length; j++) {
        var e = graphData.edges[j];
        adjList[e.from].push({ to: e.to, weight: e.weight, line: e.line, is_transfer: e.is_transfer });
    }
}
```

### queryPath 改造

```javascript
function queryPath(mode) {
    var start = startInput.value.trim();
    var end = endInput.value.trim();
    if (!start || !end) { alert('请输入起点和终点站名'); return; }

    document.getElementById('result').className = 'hidden';

    var data = dijkstra(start, end, mode);  // 同步调用本地算法
    if (!data || data.error) {
        showError(data ? data.error : '查询失败');
        return;
    }
    showResult(data, start, end);
    highlightPath(data);
}
```

关键变化：
- 删除 `disableButtons(true/false)` 和 `.catch()` 异步处理
- `fetch('/api/path?...')` → 本地 `dijkstra(start, end, mode)`
- dijkstra 通过模块级 `graphData`/`adjList` 访问数据

### showResult 显示精度

```javascript
// 修改前
document.getElementById('result-time').textContent = '总时间: ' + data.total_time + ' 分钟';
// 修改后
document.getElementById('result-time').textContent = '总时间: ' + data.total_time.toFixed(2) + ' 分钟';
```

## graph.json 生成

1. 在 master 分支上提交当前修改
2. 从 master 创建 `pure-frontend` 分支并切换
3. 在 pure-frontend 分支上运行 Python 转换脚本，读取 `metro_router/data/graph.txt`，输出 `data/graph.json`
4. 转换脚本使用从行尾向前解析的策略处理站名（防空格），然后删除脚本

转换脚本核心逻辑：
```python
# 解析节点行: <id> <station> <line> <lon> <lat>
# 从行尾向前解析，防止站名含空格
parts = line.split()
node_id = int(parts[0])
lat = float(parts[-1])
lon = float(parts[-2])
line_name = parts[-3]
station = ' '.join(parts[1:-3])  # 站名可能含空格
```

## 运行方式

**必须通过 HTTP 服务器运行**（`file://` 协议下 `fetch()` 会被 CORS 策略阻止）：

```bash
python -m http.server 8080
# 或
npx http-server . -p 8080
```

浏览器访问 `http://localhost:8080`

---

## TDD 审查报告

### 审查方法

用 TDD "写测试先行"的思维，对设计方案的每个关键点模拟编写测试用例，检查设计是否覆盖了所有必要行为。审查对照 C 版本源码逐行验证 JS 重写的正确性。

### Bug #1（严重）：graph.txt 站名含空格时 JSON 转换会破坏数据

**问题**：graph.txt 使用空格分隔字段，站名中如果含空格（如未来新增站点），`fscanf %s` 在 C 中只读到第一个空格，而 Python 转换脚本按空格 split 也会出错。当前数据集的站名不含空格（已验证：`机场西(T1/T2/T3)`、`西安工大·武德路` 等均无空格），所以不影响当前功能，但转换脚本必须处理此边界。

**修复**：graph.txt 格式为 `<id> <station> <line> <lon> <lat>`，后两个字段是固定格式的浮点数。转换脚本应从行尾向前解析：先解析 lon/lat（各一个浮点数），再向前解析 line（到前一个空格），剩余部分为 station。或者更简单：按空格 split 后，`parts[0]` 是 id，`parts[-2]` 是 lon，`parts[-1]` 是 lat，`parts[-3]` 是 line，`parts[1:-3]` join 回来就是 station。

**当前数据影响**：无。289 个节点站名均不含空格。

### Bug #2（中等）：JS 浮点精度 — mode=1 下 cost 计算可能产生误排序

**问题**：C 版本 `new_cost = (double)new_transfers + new_time * 1e-6`。JS 中 `Number` 是 IEEE 754 双精度浮点数，与 C 的 `double` 完全相同，精度无差异。但需验证一个边界：当 `new_time` 很大时（如 200 分钟），`200 * 1e-6 = 0.0002`，而 `transfers` 差值为 1。`1.0 > 0.0002`，排序正确。

**验证**：西安地铁最长路径不超过 200 分钟，`200 * 1e-6 = 0.0002`，远小于 1（一次换乘的 cost 差值）。JS 精度足够。

**结论**：无 Bug，但设计文档应明确记录此精度假设。

### Bug #3（中等）：邻接表构建 — graph.json 的 edges 是扁平数组，需转为邻接表

**问题**：C 版本使用链表邻接表（`Edge *next` 指针），JS 中没有指针。设计文档说"从 graph.json 的 nodes + edges 构建邻接表"，但未指定 JS 中的数据结构。

**修复**：JS 中用数组的数组（`adjList[nodeId] = [edge1, edge2, ...]`）替代链表。Dijkstra 遍历时 `for (const edge of adjList[currentNode])` 即可。

**设计文档补充**：明确邻接表结构为 `Map<int, Edge[]>` 或 `Edge[][]`。

### Bug #4（低）：graph.json 文件体积

**问题**：graph.txt 有 926 行（289 节点 + 636 边 + 1 头行），转为 JSON 后体积会增大（JSON 键名重复）。估算：每个节点约 80 字节 × 289 + 每条边约 60 字节 × 636 ≈ 61KB。加上 stations.json（~50KB）和 routes.json（~80KB），总数据量约 190KB。对于前端加载完全可接受。

**结论**：无问题。

### Bug #5（中等）：`file://` 协议下 `fetch()` 被 CORS 阻止

**问题**：设计文档说"浏览器直接打开 index.html"，但 `file://` 协议下 `fetch('data/graph.json')` 会被浏览器的 CORS 策略阻止（Chrome/Firefox 均如此）。这是纯前端项目最常见的坑。

**修复**：设计文档应明确说明**必须通过 HTTP 服务器运行**，不能直接双击打开 index.html。推荐 `python -m http.server 8080` 或 `npx http-server`。如果确实需要 `file://` 支持，可用 `<script>` 标签将数据内联为 JS 变量（但会使 index.html 膨胀到 200KB+，不推荐）。

**设计文档更新**：删除"浏览器直接打开"选项，仅保留 HTTP 服务器方式。

### Bug #6（低）：`showResult` 中 `data.total_time` 显示精度

**问题**：C 版本输出 `"total_time":%.2f`（2 位小数），JS 版本的 Dijkstra 计算结果是 JS 浮点数（如 35.49999999999999）。`data.total_time + ' 分钟'` 会显示一长串小数。

**修复**：`data.total_time.toFixed(2) + ' 分钟'`。

### Bug #7（低）：`highlightPath` 中路径坐标去重

**问题**：C 版本的 path 中换乘站出现两次（如"咸宁路(3号线)"和"咸宁路(6号线)"），两次的 lon/lat 完全相同。`data.path.map(p => [p.lat, p.lon])` 会产生重复坐标点，但 Leaflet 的 `L.polyline` 对重复坐标点无影响（只是多画了一个长度为 0 的线段）。

**结论**：无功能影响，无需修复。

### Bug #8（中等）：JS Dijkstra 的 `transfer_stations` 计算逻辑需与 C 版本一致

**问题**：C 版本在 main.c 中计算 `transfer_stations`：遍历 path，如果 `node.station == prev_node.station && node.line != prev_node.line`，则该站是换乘站。JS 版本的 `dijkstra` 函数输出需包含此逻辑，否则前端无法正确标注换乘点。

**设计文档补充**：明确 `dijkstra` 函数的输出需包含 `transfer_stations` 计算，逻辑为：遍历 path，相邻节点站名相同但线路不同 → 换乘站。

### Bug #9（低）：Git 分支创建前需先提交 master 上的未暂存修改

**问题**：当前 master 有未提交的修改（`doc/design.md` 和 `metro_router/templates/index.html` 已修改未暂存）。创建分支前必须先提交或 stash，否则这些修改会带到新分支。

**修复**：创建 pure-frontend 分支前，先在 master 上提交当前修改。

### 审查总结

| # | 严重程度 | 问题 | 修复方式 |
|---|---------|------|---------|
| 1 | 严重 | graph.txt 站名含空格时转换出错 | 转换脚本从行尾向前解析 |
| 2 | 中等 | mode=1 浮点精度 | 无需修复，记录假设 |
| 3 | 中等 | JS 邻接表结构未指定 | 补充为 `Edge[][]` |
| 5 | 中等 | `file://` 下 fetch 被 CORS 阻止 | 删除"直接打开"选项，仅支持 HTTP 服务器 |
| 8 | 中等 | `transfer_stations` 计算逻辑未指定 | 补充到设计文档 |
| 6 | 低 | `total_time` 显示精度 | `.toFixed(2)` |
| 4 | 低 | graph.json 体积 | 无需修复 |
| 7 | 低 | 路径坐标重复 | 无需修复 |
| 9 | 低 | master 未提交修改 | 创建分支前先提交 |

---

## 第二轮 TDD 审查报告

### 审查方法

第一轮审查聚焦于 JS 重写的算法正确性和前端兼容性。第二轮深入检查：数据目录移动遗漏、输出格式精确匹配、转换脚本工作流、字段类型一致性。通过实际运行 C 程序获取真实输出，逐字段比对。

### Bug #10（严重）：`metro_router/data/` → `data/` 移动操作遗漏

**问题**：设计文档的差异表中，`data/stations.json` 和 `data/routes.json` 标记为"保留"，但当前 master 上这些文件位于 `metro_router/data/`，pure-frontend 分支需要它们在根目录 `data/`。差异表缺少 `metro_router/data/` → `data/` 的移动操作。

**验证**：`Test-Path "c:\Users\WYH01\Desktop\数据结构课程作业\data"` 返回 `False`，确认根目录无 `data/` 目录。数据文件实际位于 `metro_router/data/`。

**修复**：差异表增加 `metro_router/data/` → `data/` 移动行，stations.json 和 routes.json 标注"从 metro_router/data/ 移来"。

### Bug #11（中等）：JS Dijkstra 输出格式未精确指定

**问题**：设计文档说"与 C 版本相同的 JSON 结构"，但未列出精确字段。通过实际运行 C 程序验证，输出格式为：

成功时：
```json
{
  "path": [{"station":"小寨","line":"地铁3号线","lon":108.942101,"lat":34.224431}, ...],
  "total_time": 58.56,
  "transfers": 2,
  "transfer_stations": ["通化门","纺织城"],
  "station_count": 24
}
```

失败时：
```json
{"path":[],"error":"No path found"}
```

关键细节：
- `path` 中换乘站出现两次（同站名不同线路），如"通化门(3号线)"和"通化门(1号线)"
- `total_time` 是浮点数（C 版本用 `%.2f`，2 位小数）
- `station_count` 是去重后的物理站点数（path_len=26 但 station_count=24）
- 前端 `queryPath` 函数当前调用 `/api/path`，纯前端版需改为调用本地 JS 函数，返回值格式必须与 C 版本一致

**修复**：设计文档补充精确输出格式、`transfer_stations` 和 `station_count` 计算逻辑、多起点处理说明。

### Bug #12（低）：`is_transfer` 字段类型应为整数

**问题**：graph.json 中 `is_transfer` 应为 `0`/`1`（整数），不能用 `true`/`false`（布尔值）。JS 中 `0 + true === 1` 虽然可行，但语义不清晰，且与 C 版本不一致。

**修复**：设计文档补充类型说明。

### Bug #13（低）：`docs/` 目录残留

**问题**：brainstorming 阶段创建了 `docs/superpowers/specs/` 目录（设计文档已移走，但空目录可能残留）。该目录不应出现在 pure-frontend 分支。

**修复**：创建分支后清理空目录。差异表已包含"删除 `docs/`"。

### Bug #14（中等）：转换脚本工作流不明确

**问题**：原设计说"在 master 分支上用 Python 脚本一次性转换"，但 graph.txt 位于 `metro_router/data/`，转换后输出的 `graph.json` 应在根目录 `data/`。工作流顺序不清晰。

**正确工作流**：
1. 在 master 上提交当前修改
2. 从 master 创建 pure-frontend 分支并切换
3. 在 pure-frontend 分支上运行转换脚本（此时 `metro_router/data/graph.txt` 仍存在）
4. 删除后端文件、移动前端文件
5. 提交

**修复**：设计文档补充完整工作流步骤和转换脚本核心逻辑。

### Bug #15（低）：缺少 `.gitignore`

**问题**：pure-frontend 分支应包含 `.gitignore`，忽略 OS 临时文件（`.DS_Store`、`Thumbs.db`）。

**修复**：差异表增加 `.gitignore` 新增行。

### 第二轮审查总结

| # | 严重程度 | 问题 | 修复方式 |
|---|---------|------|---------|
| 10 | 严重 | `metro_router/data/` 移动操作遗漏 | 差异表增加移动行 |
| 11 | 中等 | JS Dijkstra 输出格式未精确指定 | 补充精确字段和计算逻辑 |
| 14 | 中等 | 转换脚本工作流不明确 | 补充完整步骤 |
| 12 | 低 | `is_transfer` 类型应为整数 | 补充类型说明 |
| 13 | 低 | `docs/` 空目录残留 | 创建分支后清理 |
| 15 | 低 | 缺少 `.gitignore` | 新增 |

### 两轮审查累计

| 轮次 | 严重 | 中等 | 低 | 累计 |
|------|------|------|-----|------|
| 第一轮 | 1 | 4 | 4 | 9 |
| 第二轮 | 1 | 2 | 3 | 15 |

所有发现的问题已在设计文档中修复或补充。

---

## 第三轮 TDD 审查报告

### 审查方法

第一轮聚焦算法正确性，第二轮聚焦数据流转。第三轮聚焦**UI-算法集成层**：逐行对比 `script.js` 源码（168行）与设计文档，模拟实现者拿到设计文档后能否无误写出每个函数的改造代码。对照 `app.py` 确认 `/api/path` 端点被完全替代。对照 `main.c` 逐字段验证输出格式。

### Bug #16（严重）：`queryPath` 改造方案缺失

**问题**：设计文档说"script.js 重写"，但 `queryPath` 是整个系统**唯一的 UI 调用算法入口**。当前代码走 `fetch('/api/path?start=...')` 异步调用，纯前端版必须改为 `dijkstra(start, end, mode)` 本地同步调用。如果不指定这个改造，实现者不知道：

1. `disableButtons(true/false)` 还需不需要？（本地同步调用瞬间完成，不需要，删除）
2. `.catch()` 错误处理还需不需要？（无网络请求，删除）
3. `dijkstra` 函数的调用签名是什么？（`dijkstra(start, end, mode)`，数据通过模块级变量访问）
4. 错误情况的判断逻辑？（`if (!data || data.error)` — 与原先 `if (data.error)` 不同）

**对比源码**：

```javascript
// 改造前 (script.js:77-97)
function queryPath(mode) {
    ...
    disableButtons(true);
    fetch('/api/path?start=' + encodeURIComponent(start) + ...)
        .then(function(r) { return r.json(); })
        .then(function(data) {
            disableButtons(false);
            if (data.error) { showError(data.error); return; }
            showResult(data, start, end);
            highlightPath(data);
        })
        .catch(function() { disableButtons(false); showError('查询失败，请重试'); });
}

// 改造后
function queryPath(mode) {
    ...
    document.getElementById('result').className = 'hidden';
    var data = dijkstra(start, end, mode);
    if (!data || data.error) {
        showError(data ? data.error : '查询失败');
        return;
    }
    showResult(data, start, end);
    highlightPath(data);
}
```

**修复**：设计文档新增 `## script.js 核心改造` 章节，完整列出 `queryPath`、`loadData`、`showResult` 三处改造代码。

### Bug #17（中等）：`transfer_stations` 跳过首尾节点的边界条件遗漏

**问题**：C 代码 `main.c:59` 的条件是 `i > 0 && i < result.path_len - 1`，跳过了 `path[0]`（起点）和 `path[path_len-1]`（终点）。设计文档之前只说条件判断，未提循环边界。

**影响**：如果终点站恰好和前一站站名相同（极少见但理论上可能存在），终点会被错误标记为"换乘站"。跳过首尾是防御性正确做法。

**修复**：设计文档更新为"遍历 path（`i=1`至`path.length-2`）"。

### Bug #18（中等）：graphData/adjList 存储位置与生命周期缺失

**问题**：dijkstra 函数需要访问 `graphData.nodes` 和 `adjList`，但设计文档未指定它们在哪里声明、何时初始化。

**实际需要**：
- `var graphData, adjList` 在文件顶部声明（与 `map, routesData` 同级）
- `buildAdjList()` 在 `loadData()` 的 `.then()` 中调用一次
- `dijkstra()` 直接访问模块级 `adjList`，不重复构建

**修复**：设计文档新增 `### 模块级变量` 和 `### loadData 改造` 小节。

### Bug #19（低）：`loadData` 错误提示过时

**问题**：`script.js:23` 的 `.catch` 提示 "请确认已运行 python data_loader.py"，纯前端版无此脚本，提示误导用户。

**修复**：改为 `alert('加载数据失败')`，已在设计文档的 `loadData` 改造代码中体现。

### Bug #20（低）：`total_time` 显示精度定位不明确

**问题**：Bug #6 提到 `.toFixed(2)` 但未指定修改位置。实际修改点在 `showResult` 函数 `script.js:117`。

**修复**：设计文档新增 `### showResult 显示精度` 小节，给出精确的代码行改动。

### Bug #21（低）：edge 行转换脚本未明确

**问题**：设计文档的转换脚本代码只展示了节点行解析，未展示边行解析。边行格式为 `<from> <to> <weight> <line_name> <is_transfer>`（5个空格分隔字段），解析简单但缺失。

**修复**：由于边行解析是无歧义的（5个固定字段），不是实际 bug，此处记录但不修改文档。

### 第三轮审查总结

| # | 严重程度 | 问题 | 修复方式 |
|---|---------|------|---------|
| 16 | 严重 | `queryPath` 改造方案缺失 | 新增完整改造代码 |
| 17 | 中等 | `transfer_stations` 跳过首尾边界未明确 | 补充 `i=1`至`path.length-2` 边界 |
| 18 | 中等 | graphData/adjList 存储位置缺失 | 新增模块级变量和 `buildAdjList` |
| 19 | 低 | `loadData` 错误提示过时 | 改为 `alert('加载数据失败')` |
| 20 | 低 | `total_time` 显示精度未定位 | 指定 `showResult` 中 `.toFixed(2)` |
| 21 | 低 | 边行转换脚本未明确 | 无需修复（无歧义） |

### 三轮审查累计汇总

| 轮次 | 严重 | 中等 | 低 | 累计 |
|------|------|------|-----|------|
| 第一轮 | 1 | 4 | 4 | 9 |
| 第二轮 | 1 | 2 | 3 | 15 |
| 第三轮 | 1 | 2 | 3 | **21** |

三轮累计发现 21 个问题，其中严重 3 个、中等 8 个、低 10 个。所有问题均已在设计文档中修复或补充。

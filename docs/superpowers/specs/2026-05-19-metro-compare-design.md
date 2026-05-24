# 西安地铁导航对比系统设计文档

## 1. 目标

自动化对比本地 Dijkstra 地铁导航系统与高德地图公交路径规划 API 的路线差异，输出结构化对比数据，用于：
- 课程报告中展示算法差异分析
- 校准本地系统权重参数，提升精度

## 2. 项目规模

- 本地系统：250 个站点、37 个换乘站、289 个图节点
- 测试用例：手工 10 组 + 随机 80 组 = 90 组
- 高德 API：`/v3/direction/transit/integrated`，Web 服务 Key 已就绪

## 3. 架构

```
compare/
├── run-compare.js          # 主入口，串联全流程
├── test-case-generator.js  # 生成测试用例（手工+随机）
├── local-router.js         # 本地 Dijkstra 路径计算
├── amap-client.js          # 高德 API 客户端（限流+重试+错误隔离）
├── comparator.js           # 对比逻辑，计算各维度差异
├── reporter.js             # 输出 raw-results.json + summary.csv + stats.json
├── config.js               # 配置项
└── output/                 # 运行结果
```

## 4. 模块详细设计

### 4.1 config.js

```js
module.exports = {
  AMAP_KEY: 'fc83711fd95930b3049d947e11f7096e',
  CITY: '西安',
  AMAP_BASE: 'https://restapi.amap.com/v3/direction/transit/integrated',
  QPS: 4,
  RETRY_MAX: 3,
  RETRY_BASE_DELAY: 1000,
  TIMEOUT: 10000,
  RANDOM_CASE_COUNT: 80,
  DATA_DIR: '../data',
  OUTPUT_DIR: './output',
  STRATEGIES: [0, 2],
}
```

### 4.2 test-case-generator.js

**混合生成策略**：

- 手工典型路线 10 组，覆盖：
  - 同线直达（如 三桥 → 半坡）
  - 1 次换乘大站（如 小寨 → 钟楼）
  - 1 次换乘多选（如 丈八北路 → 万寿路）
  - 2 次换乘（如 保税区 → 航天新城）
  - 跨远郊（如 杨官寨 → 秦陵西）
  - 近距离相邻站（如 北大街 → 钟楼）
- 随机 80 组，约束：
  - 起终点不同
  - 起终点直线距离 > 1km（避免高德只返回步行）
  - 不重复

输出格式：
```js
[{
  id: 'T01',
  type: 'manual' | 'random',
  origin: '钟楼',
  dest: '小寨',
  originCoord: [lon, lat],
  destCoord: [lon, lat]
}]
```

### 4.3 local-router.js

从 `script.js` 提取核心算法，适配 Node.js：

- 读取 `graph.json`，构建邻接表
- 支持 mode=0（时间最短）和 mode=1（换乘最少）
- 输出结构：
```js
{
  path: [{ station, line, lon, lat }],
  total_time,          // 边权重累加（分钟）
  total_time_with_wait, // total_time + 3 分钟等车
  transfers,
  transfer_stations,
  station_count,
  segments: [{
    line: '地铁2号线',
    from: '行政中心',
    to: '钟楼',
    stations: ['行政中心', '凤城五路', ..., '钟楼']
  }]
}
```

`segments` 通过已有的 `extractPathSegments` 逻辑生成，用于和高德 `buslines` 段逐段对比。

### 4.4 amap-client.js

**令牌桶限流 + 指数退避重试 + 错误隔离**：

- 令牌桶：每 250ms 放一个令牌，QPS=4
- 请求失败（429/5xx）：指数退避重试（1s, 2s, 4s），最多 3 次
- 超时：10s abort
- 错误隔离：单条失败返回 `{ error: ... }`，不中断整体

**高德响应解析**：

- 取 `transits[0]`（推荐方案），如有 `transits[1]` 也取备选
- 过滤 `segments` 中 `bus.buslines[].type === '地铁线路'` 的段
- 提取每段：线路名、起止站、途经站、运行时间、步行距离
- 记录高德实际吸附的站名，标记与本地站名的偏差

输出标准化结构：
```js
{
  duration_sec,
  walking_distance_m,
  metro_transfers,
  metro_segments: [{
    line_name: '地铁2号线(草滩--常宁宫)',
    line_short: '地铁2号线',
    departure_stop: '行政中心',
    arrival_stop: '钟楼',
    via_stops: ['凤城五路', ...],
    duration_sec: 1170
  }],
  walking_segments: [{ distance_m, duration_sec }],
  raw_transit: { ... }
}
```

### 4.5 comparator.js

**对比维度**：

| 维度 | 本地 | 高德 | 差异计算 |
|---|---|---|---|
| 总耗时(min) | `total_time_with_wait` | `duration_sec / 60` | 差值 + 百分比 |
| 换乘次数 | `transfers` | `metro_transfers` | 差值 |
| 途经站数 | `station_count` | 所有地铁段站点总数 | 差值 |
| 步行距离(m) | 0 | `walking_distance_m` | 直接记录 |
| 路线一致率 | - | - | Jaccard 系数 |

**路线一致率算法（Jaccard 系数）**：
1. 本地路径提取所有站名集合 `localSet`
2. 高德地铁段提取所有站名集合 `amapSet`
3. 一致率 = `|localSet ∩ amapSet| / |localSet ∪ amapSet|`

**换乘站对比**：本地 `transfer_stations` vs 高德换乘点（相邻地铁段不同线路的衔接站）

### 4.6 reporter.js

输出三个文件（文件名含时间戳防覆盖）：

- **raw-results.json**：每组测试的完整数据（请求参数、本地结果、高德结果、对比结果、高德原始响应）
- **summary.csv**：一行一组，核心指标列：id, type, origin, dest, local_time, amap_time, time_diff, time_diff_pct, local_transfers, amap_transfers, transfer_diff, local_stations, amap_stations, station_diff, walking_m, jaccard
- **stats.json**：汇总统计
  - 平均耗时差（绝对值 + 百分比）
  - 一致率分布（均值、中位数、最小值）
  - 换乘次数差异分布
  - 最大偏差 top 5 case
  - 本地无路径但高德有路径的 case 列表

## 5. 运行流程

```
run-compare.js
  ├── 1. 加载数据 (graph.json, stations.json)
  ├── 2. 生成测试用例 (手工10 + 随机80)
  ├── 3. 初始化本地路由器 + 高德客户端
  ├── 4. 逐条执行：
  │     ├── 本地 Dijkstra (mode=0, mode=1)
  │     ├── 高德 API (strategy=0)
  │     ├── 对比计算
  │     └── 进度显示 (T01/90 ✓ / T02/90 ✗ ...)
  ├── 5. 生成汇总统计
  └── 6. 写入输出文件
```

## 6. 关键设计决策

### 6.1 起终点映射

直接用本地站点经纬度传高德 API（`origin=lon,lat` 格式），接受高德吸附偏差。解析时记录高德实际使用的站名，输出中标记偏差。不使用高德 POI 反查，避免额外 API 调用和复杂度。

### 6.2 高德公交结果过滤

高德 API 返回混合公交+地铁方案。解析时只取 `type === '地铁线路'` 的段，忽略普通公交段。如果某方案无地铁段，标记为"非纯地铁方案"但仍保留记录。

### 6.3 本地等车时间模型

本地系统固定加 3 分钟等车时间。高德的 `duration` 已包含等车时间。对比时：
- 本地 `total_time_with_wait = total_time + 3`
- 高德直接用 `duration_sec / 60`
- 差异中步行时间是主要偏差源之一

### 6.4 坐标系

本地 `stations.json` 坐标为 WGS-84，经 `gcj02Lat/gcj02Lon` 转换后在浏览器端使用。高德 API 接受 GCJ-02 坐标。因此传参时需先做 WGS-84 → GCJ-02 转换（复用 `script.js` 中的转换函数）。

## 7. 边界条件处理

| 场景 | 处理方式 |
|---|---|
| 起终点相同 | 跳过，不生成测试用例 |
| 本地无路径 | 记录，高德可能有路径，这种 case 有对比价值 |
| 高德无地铁方案 | 记录为"非纯地铁"，对比中标记 |
| 两点距离 < 1km | 随机生成时过滤掉，手工用例可保留 |
| 高德 API 报错 | 重试 3 次后跳过，记录错误信息 |
| 高德返回多方案 | 取推荐方案 + 备选方案（如有） |

## 8. 依赖

- Node.js >= 14（无需额外 npm 包，仅用内置 `https`/`http` 模块）
- 高德 Web 服务 API Key

## 9. 后续优化方向

根据对比结果，可优先调整：

| 优先级 | 改进项 | 预期效果 |
|---|---|---|
| P0 | 等车时间从固定 3 分钟改为按线路/时段动态计算 | 时间准确度提升最大 |
| P1 | 校准 graph.json 边权重，与实际站间运行时间对齐 | 路线选择更合理 |
| P2 | 换乘边权重加入步行时间 | 换乘站选择更合理 |
| P3 | 加入发车间隔数据 | 接近高德精度 |

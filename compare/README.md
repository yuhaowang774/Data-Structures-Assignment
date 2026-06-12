# compare 目录说明

## 1. 功能概述

`compare/` 目录用于执行“本地路径规划结果”与“高德地铁路径结果”的对比测试，并输出结构化比较结果。

该部分不参与主系统网页运行，但可用于：

- 结果校验
- 时间差与换乘差分析
- JSON / CSV / Markdown 报告生成

## 2. 运行条件

运行 `compare` 需要满足以下条件：

- Python 3.10 及以上
- 主项目中的 `metro_router/` 可正常导入
- 可联网访问高德接口
- 可用的高德 API Key

高德 Key 的来源可以是：

- 环境变量 `AMAP_KEY`
- 或 `compare/config.py` 中的默认配置

## 3. 主要文件

### `config.py`

**主要功能：** 管理对比测试配置参数。

**主要内容：**

- 数据目录
- 输出目录
- 高德 Key
- 城市参数
- QPS
- 超时与重试次数
- 随机样例数量

**注意事项：**

- `CITY` 当前应与主项目数据一致，为“西安”

---

### `local_router.py`

**主要功能：** 复用主项目逻辑执行本地路径查询。

**主要内容：**

类：

- `LocalRouter`

方法：

- `__init__`
- `query`
- `get_station_names`
- `get_station_coord`

**注意事项：**

- 该文件不是另起一套后端，而是对主项目查询逻辑的包装

---

### `amap_client.py`

**主要功能：** 调用高德接口并将结果转换为可比较格式。

**主要内容：**

函数：

- `gcj02_lat`
- `gcj02_lon`
- `wgs84_to_gcj02`

类：

- `AmapClient`

方法：

- `_rate_limit`
- `_fetch_json`
- `_request_with_retry`
- `query_transit`
- `_parse_response`

**注意事项：**

- 当前逻辑只把高德返回的“地铁线路”部分纳入对比
- 高德接口不可用时会返回错误对象而不是抛出未处理异常

---

### `test_case_generator.py`

**主要功能：** 生成手工样例与随机样例。

**主要内容：**

函数：

- `haversine_meters`
- `generate`

常量：

- `MANUAL_CASES`

**可选的数据规模：**

- 默认生成约 90 组样例

**注意事项：**

- 随机样例会过滤距离过近的起终点
- 手工样例的站名必须与当前运行数据中的站名完全一致

---

### `comparator.py`

**主要功能：** 比较本地结果与高德结果。

**主要内容：**

函数：

- `get_local_station_set`
- `get_amap_station_set`
- `jaccard_index`
- `compare_transfer_stations`
- `normalize_line_name`
- `compare_segment_lines`
- `compare`

**比较指标包括：**

- 总时间差
- 换乘数差
- 站点数差
- 步行距离差
- Jaccard 一致率
- 线路一致性

**注意事项：**

- 线路名标准化逻辑必须与当前线路命名方式保持一致

---

### `reporter.py`

**主要功能：** 输出对比结果文件。

**主要内容：**

函数：

- `timestamp`
- `build_raw_results`
- `build_stats`

类：

- `Reporter`

方法：

- `__init__`
- `write`

**输出文件包括：**

- `results_*.json`
- `summary_*.csv`
- `stats_*.json`

**注意事项：**

- CSV 使用 `utf-8-sig` 编码，便于在 Excel 中直接打开

---

### `generate_report.py`

**主要功能：** 根据结果 JSON 生成 Markdown 对比报告。

**主要内容：**

函数：

- `build_lines`
- `main`

**注意事项：**

- 用法为：
  - `python -m compare.generate_report <results.json>`

---

### `run_compare.py`

**主要功能：** 对比测试主入口。

**主要内容：**

函数：

- `main`
  - 读取站点数据
  - 生成测试样例
  - 初始化本地路由器与高德客户端
  - 逐条执行比较
  - 输出结果文件

**注意事项：**

- 当前默认以本地 `mode=0` 查询结果作为对比基准
- 完整运行依赖网络环境

## 4. 运行方式

在项目根目录执行：

```powershell
python -m compare.run_compare
```

## 5. 输出目录

默认输出目录：

```text
compare/output/
```

典型输出文件包括：

- `results_时间戳.json`
- `summary_时间戳.csv`
- `stats_时间戳.json`

若需要生成 Markdown 汇总报告，可执行：

```powershell
python -m compare.generate_report compare/output/results_xxx.json
```

## 6. 注意事项

- `compare` 依赖网络，离线时高德部分无法完成
- 对比测试耗时明显长于普通本地查询
- 若 `metro_router.exe` 未与最新 C 源码同步重编，主项目的 `mode=2` 可能由 Python 兜底


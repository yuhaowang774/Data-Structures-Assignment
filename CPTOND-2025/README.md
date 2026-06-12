# 城市公共交通数据处理说明

## 1. 目录定位

`CPTOND-2025/code/` 用于存放城市公共交通数据处理脚本，主要面向中国城市的公交与轨道交通数据采集、清洗、Shapefile 生成、区间拆分与按城市整理。

当前仓库中，这套脚本已经保留完整代码；实际内置数据以 `../dataset/metro/` 下的城市轨道交通结果为主。

## 2. 当前目录包含内容

本目录下的脚本大致分为四类：

- 数据采集
  - `Bus_Route_Data_Crawler.py`
  - `Metro_Route_Data_Crawler.py`

- 原始结果处理与 Shapefile 生成
  - `Bus_Data_Processor.py`
  - `Metro_Data_Processor.py`

- 线路区间拆分与站点去重整理
  - `Bus_Segment_Processor.py`
  - `Metro_Segment_Processor.py`

- 按城市拆分输出
  - `Bus_City_Shapefile_Organizer.py`
  - `Metro_City_Shapefile_Organizer.py`

此外还包含：

- `transform.py`
  - 坐标转换工具

- `box_test.py`
  - 测试与调试辅助脚本

- `requirements.txt`
  - Python 依赖列表

## 3. 当前仓库中的数据状态

当前 `CPTOND-2025` 目录下已经存在：

- `../city_list/`
  - 城市清单与行政区划辅助表

- `../dataset/metro/shapefiles/`
  - 已生成的城市轨道交通 Shapefile 数据

从仓库现状看：

- 当前内置数据重点是 `metro`
- `dataset/metro/shapefiles/` 下已包含总表及按城市拆分结果
- 当前可直接用于主项目的数据来源之一是：
  - `../dataset/metro/shapefiles/sian/`

例如西安目录下包含：

- `sian_metro_routes.*`
- `sian_metro_segments.*`
- `sian_metro_stops.*`
- `sian_metro_stops_unique.*`

## 4. 主要处理流程

以轨道交通数据为例，通常处理流程为：

1. 使用 `Metro_Route_Data_Crawler.py` 采集线路与站点原始信息。
2. 使用 `Metro_Data_Processor.py` 将采集结果整理为标准 Shapefile。
3. 使用 `Metro_Segment_Processor.py` 将线路拆分为相邻站点之间的区间段，并生成去重站点结果。
4. 使用 `Metro_City_Shapefile_Organizer.py` 按城市整理输出文件结构。

公交数据的处理流程与此对应，分别由 `Bus_*` 脚本完成。

## 5. 运行环境

建议环境：

- Python 3.10 及以上
- Windows 或其他可正常运行 `geopandas` 的 Python 环境

安装依赖：

```bash
pip install -r requirements.txt
```

`requirements.txt` 中的主要依赖包括：

- `pandas`
- `numpy`
- `geopandas`
- `shapely`
- `pyproj`
- `fiona`
- `requests`
- `beautifulsoup4`
- `xpinyin`
- `pypinyin`

其中：

- `geopandas`、`shapely`、`fiona`、`pyproj` 用于 GIS 数据处理
- `requests`、`beautifulsoup4` 用于数据采集
- `xpinyin`、`pypinyin` 用于城市名处理与拼音化

## 6. 关键脚本说明

### `Metro_Route_Data_Crawler.py`

作用：

- 采集城市轨道交通线路、站点与运营信息

注意：

- 依赖地图接口与网络环境
- 源码中保留了 AMap Key 和 Azure 翻译 Key 的配置位
- 若要重新采集，需要先自行补全相应密钥

### `Metro_Data_Processor.py`

作用：

- 将采集结果整理为标准轨道交通 Shapefile
- 生成线路与站点图层
- 进行坐标校验、去重与部分异常修正

默认输入输出路径：

- 输入根目录：`../dataset/metro/`
- 输出目录：`../dataset/metro/shapefiles/`

### `Metro_Segment_Processor.py`

作用：

- 将轨道交通线路拆分为相邻站点区间
- 生成按城市组织的区间段数据
- 输出去重后的站点结果

常见输出包括：

- `*_metro_segments.*`
- `*_metro_stops_unique.*`

### `Metro_City_Shapefile_Organizer.py`

作用：

- 按城市整理轨道交通 Shapefile
- 统一文件命名和目录结构

整理后的典型结果形如：

- `Beijing/beijing_metro_routes.*`
- `Beijing/beijing_metro_segments.*`
- `Beijing/beijing_metro_stops.*`
- `Beijing/beijing_metro_stops_unique.*`

### `transform.py`

作用：

- 提供常用坐标转换函数
- 处理国内地图服务相关坐标系转换

## 7. 目录结构示意

```text
CPTOND-2025/
├─ city_list/
│  ├─ AMap_adcode_citycode.csv
│  ├─ bus_city_list_split.csv
│  └─ metro_city_list_split.csv
├─ code/
│  ├─ Bus_Route_Data_Crawler.py
│  ├─ Bus_Data_Processor.py
│  ├─ Bus_Segment_Processor.py
│  ├─ Bus_City_Shapefile_Organizer.py
│  ├─ Metro_Route_Data_Crawler.py
│  ├─ Metro_Data_Processor.py
│  ├─ Metro_Segment_Processor.py
│  ├─ Metro_City_Shapefile_Organizer.py
│  ├─ transform.py
│  ├─ box_test.py
│  ├─ requirements.txt
│  └─ README.md
└─ dataset/
   └─ metro/
      └─ shapefiles/
         ├─ metro_routes.*
         ├─ metro_stops.*
         ├─ Beijing/
         ├─ Shanghai/
         ├─ sian/
         └─ ...
```

## 8. 已有结果的使用方式

如果只是使用当前仓库已经整理好的轨道交通数据，而不是重新采集或重新生成，可以直接读取：

- `../dataset/metro/shapefiles/metro_routes.*`
- `../dataset/metro/shapefiles/metro_stops.*`
- 各城市子目录下的 `*_metro_routes.*`
- 各城市子目录下的 `*_metro_segments.*`
- 各城市子目录下的 `*_metro_stops.*`
- 各城市子目录下的 `*_metro_stops_unique.*`

对于本仓库主项目“西安地铁路径计算器”，主要使用的是：

- `../dataset/metro/shapefiles/sian/`

## 9. 重新运行脚本的说明

这些脚本大多保留了 `main()` 入口，可以单独运行。但需要注意：

- 重新采集通常依赖外部接口、网络和 API Key
- 重新处理会覆盖或新增 `dataset` 下的结果文件
- 某些脚本的默认路径是相对于当前文件位置写死的，建议在 `code/` 目录内执行

典型运行方式示例：

```bash
python Metro_Data_Processor.py
python Metro_Segment_Processor.py
python Metro_City_Shapefile_Organizer.py
```

如果需要重新采集轨道交通数据，可再运行：

```bash
python Metro_Route_Data_Crawler.py
```

但前提是你已经配置好对应接口密钥。

## 10. 注意事项

- 本目录是数据处理代码目录，不是主项目运行入口。
- 当前 README 以仓库中已经存在的文件和目录为准，不再使用空模板说明。
- 虽然代码同时覆盖公交与轨道交通两类处理流程，但当前仓库内置数据主要是轨道交通数据。
- 若仅服务于本课程项目，可重点关注西安轨道交通相关结果，而不必重新执行整套全国数据处理流程。

# 西安地铁最短路径查询系统

基于 Dijkstra 算法的西安地铁换乘最优路径计算器，支持多种优化策略、时段调度和算法可视化。

## 功能特性

- **多种优化策略**：时间最短、换乘最少、综合最优
- **备用方案推荐**：基于惩罚因子的 Dijkstra 变体生成替代路线
- **时段调度中心**：自动检测高峰/平峰时段，动态调整运行时间和换乘权重
- **Dijkstra 算法可视化**：逐步展示算法执行过程，直观理解最短路径搜索
- **交互式地图**：基于 Leaflet 的西安地铁线路图，支持点击选站和搜索
- **移动端适配**：响应式布局，支持移动设备操作

## 技术实现

- 纯前端实现，无需后端服务
- Dijkstra 最短路径算法 + 惩罚因子变体
- GCJ-02 坐标系转换
- Leaflet 地图渲染

## 项目结构

```
├── index.html            # 主页面
├── script.js             # 主逻辑（地图、交互、查询）
├── path-logic.js         # 路径计算与线段绘制
├── schedule-config.js    # 时段调度配置
├── dijkstra-viz.js       # Dijkstra 算法可视化
├── style.css             # 样式
├── data/
│   ├── graph.json        # 地铁图数据（节点与邻接表）
│   ├── routes.json       # 线路数据
│   └── stations.json     # 站点数据
└── compare/              # 与高德地图 API 的对比工具
    ├── config.js         # 对比配置
    ├── amap-client.js    # 高德 API 客户端
    ├── local-router.js   # 本地路由器
    ├── comparator.js     # 对比逻辑
    ├── test-case-generator.js
    ├── reporter.js
    ├── generate-report.js
    └── run-compare.js    # 运行入口
```

## 快速开始

1. 克隆仓库：
   ```bash
   git clone https://github.com/yuhaowang774/Data-Structures-Assignment.git
   ```

2. 使用任意 HTTP 服务器打开 `index.html`，例如：
   ```bash
   npx serve .
   ```

3. 在浏览器中访问即可使用

## 对比工具

`compare/` 目录包含与高德地图公交路径规划 API 的对比工具，用于验证本地算法的准确性。

使用前需设置环境变量：
```bash
export AMAP_KEY=your_amap_key
node compare/run-compare.js
```

## 许可证

MIT License

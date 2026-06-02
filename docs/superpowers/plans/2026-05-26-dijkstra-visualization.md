# Dijkstra 算法可视化 实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在现有西安地铁 Web 界面中集成 Dijkstra 算法逐步可视化面板

**Architecture:** 新建 `dijkstra-viz.js` 包含步骤录制、子图提取、力导向布局、Canvas 渲染、步骤控制器。查询路径后可选触发，弹出覆盖在地图上的独立面板，用 Canvas 绘制抽象节点-边图，逐步展示算法执行过程。

**Tech Stack:** 原生 JavaScript (ES5 风格)、Canvas 2D API、Leaflet 地图联动

---

## 文件结构

| 文件 | 职责 |
|------|------|
| `dijkstra-viz.js`（新建） | 步骤录制、子图提取、力导向布局、Canvas 渲染、步骤控制器 |
| `script.js`（修改） | 添加"可视化算法过程"按钮渲染和触发逻辑，地图联动高亮 |
| `style.css`（修改） | 可视化面板样式、按钮样式 |
| `index.html`（修改） | 引入 `dijkstra-viz.js`，添加面板容器 DOM |

---

### Task 1: 创建 dijkstra-viz.js — 子图提取与步骤录制

**Files:**
- Create: `dijkstra-viz.js`

- [ ] **Step 1: 编写 DijkstraViz 全局对象骨架和 buildStationGraph 函数**

```js
var DijkstraViz = DijkstraViz || {};

DijkstraViz.buildStationGraph = function (graphData, adjList) {
  var nodes = graphData.nodes;
  var stationMap = {};
  var stationNodes = [];
  var stationEdges = [];

  for (var i = 0; i < nodes.length; i++) {
    var name = nodes[i].station;
    if (!stationMap[name]) {
      stationMap[name] = {
        id: stationNodes.length,
        name: name,
        lat: nodes[i].lat,
        lon: nodes[i].lon,
        graphNodeIds: []
      };
      stationNodes.push(stationMap[name]);
    }
    stationMap[name].graphNodeIds.push(i);
  }

  var edgeSet = {};
  for (var i = 0; i < nodes.length; i++) {
    var edges = adjList[i];
    if (!edges) continue;
    for (var j = 0; j < edges.length; j++) {
      var e = edges[j];
      var fromName = nodes[i].station;
      var toName = nodes[e.to].station;
      if (fromName === toName) continue;
      var key = fromName < toName ? fromName + '|' + toName : toName + '|' + fromName;
      if (!edgeSet[key] || e.weight < edgeSet[key].weight) {
        edgeSet[key] = {
          from: stationMap[fromName].id,
          to: stationMap[toName].id,
          fromName: fromName,
          toName: toName,
          weight: e.weight,
          isTransfer: e.is_transfer
        };
      }
    }
  }

  for (var key in edgeSet) {
    stationEdges.push(edgeSet[key]);
  }

  var adj = {};
  for (var i = 0; i < stationNodes.length; i++) {
    adj[i] = [];
  }
  for (var i = 0; i < stationEdges.length; i++) {
    var e = stationEdges[i];
    adj[e.from].push({ to: e.to, weight: e.weight, isTransfer: e.isTransfer, fromName: e.fromName, toName: e.toName });
    adj[e.to].push({ to: e.from, weight: e.weight, isTransfer: e.isTransfer, fromName: e.toName, toName: e.fromName });
  }

  return { nodes: stationNodes, edges: stationEdges, adj: adj, nameToId: stationMap };
};
```

- [ ] **Step 2: 编写 extractSubGraph 函数**

```js
DijkstraViz.extractSubGraph = function (stationGraph, pathResult, maxNodes) {
  maxNodes = maxNodes || 20;
  var pathStationNames = {};
  for (var i = 0; i < pathResult.length; i++) {
    pathStationNames[pathResult[i].station] = true;
  }

  var includeIds = {};
  for (var name in pathStationNames) {
    if (stationGraph.nameToId[name]) {
      includeIds[stationGraph.nameToId[name].id] = true;
    }
  }

  for (var name in pathStationNames) {
    var sid = stationGraph.nameToId[name] ? stationGraph.nameToId[name].id : -1;
    if (sid < 0) continue;
    var neighbors = stationGraph.adj[sid];
    for (var j = 0; j < neighbors.length; j++) {
      includeIds[neighbors[j].to] = true;
    }
  }

  var idList = [];
  for (var id in includeIds) {
    idList.push(parseInt(id));
  }
  idList.sort(function (a, b) { return a - b; });

  if (idList.length > maxNodes) {
    var priorityIds = {};
    for (var name in pathStationNames) {
      if (stationGraph.nameToId[name]) {
        priorityIds[stationGraph.nameToId[name].id] = true;
      }
    }
    idList.sort(function (a, b) {
      var aP = priorityIds[a] ? 0 : 1;
      var bP = priorityIds[b] ? 0 : 1;
      return aP - bP || a - b;
    });
    idList = idList.slice(0, maxNodes);
  }

  var oldToNew = {};
  var subNodes = [];
  for (var i = 0; i < idList.length; i++) {
    oldToNew[idList[i]] = i;
    subNodes.push({
      id: i,
      name: stationGraph.nodes[idList[i]].name,
      lat: stationGraph.nodes[idList[i]].lat,
      lon: stationGraph.nodes[idList[i]].lon,
      onPath: !!pathStationNames[stationGraph.nodes[idList[i]].name]
    });
  }

  var subEdges = [];
  var edgeSet = {};
  for (var i = 0; i < idList.length; i++) {
    var oldId = idList[i];
    var neighbors = stationGraph.adj[oldId];
    for (var j = 0; j < neighbors.length; j++) {
      var n = neighbors[j];
      if (oldToNew[n.to] === undefined) continue;
      var key = Math.min(i, oldToNew[n.to]) + '|' + Math.max(i, oldToNew[n.to]);
      if (!edgeSet[key]) {
        edgeSet[key] = true;
        subEdges.push({
          from: i,
          to: oldToNew[n.to],
          weight: n.weight,
          fromName: stationGraph.nodes[oldId].name,
          toName: stationGraph.nodes[n.to].name
        });
      }
    }
  }

  var subAdj = {};
  for (var i = 0; i < subNodes.length; i++) {
    subAdj[i] = [];
  }
  for (var i = 0; i < subEdges.length; i++) {
    var e = subEdges[i];
    subAdj[e.from].push({ to: e.to, weight: e.weight });
    subAdj[e.to].push({ to: e.from, weight: e.weight });
  }

  return { nodes: subNodes, edges: subEdges, adj: subAdj };
};
```

- [ ] **Step 3: 编写 dijkstraWithSteps 函数**

```js
DijkstraViz.dijkstraWithSteps = function (subGraph, startName, endName) {
  var nodes = subGraph.nodes;
  var n = nodes.length;
  var startId = -1, endId = -1;
  for (var i = 0; i < n; i++) {
    if (nodes[i].name === startName) startId = i;
    if (nodes[i].name === endName) endId = i;
  }
  if (startId === -1 || endId === -1) return { steps: [], pathNodes: [] };

  var INF = 1e18;
  var dist = new Array(n);
  var visited = new Array(n);
  var prev = new Array(n);
  for (var i = 0; i < n; i++) {
    dist[i] = INF;
    visited[i] = false;
    prev[i] = -1;
  }

  var steps = [];

  steps.push({
    type: 'init',
    currentNode: startId,
    visited: [],
    dist: dist.slice(),
    prev: prev.slice(),
    relaxedEdge: null,
    description: '初始化：起点 ' + startName + ' 距离设为 0，其余为 ∞'
  });

  dist[startId] = 0;

  while (true) {
    var u = -1;
    var minDist = INF;
    for (var i = 0; i < n; i++) {
      if (!visited[i] && dist[i] < minDist) {
        minDist = dist[i];
        u = i;
      }
    }
    if (u === -1) break;

    visited[u] = true;

    steps.push({
      type: 'visit',
      currentNode: u,
      visited: visited.slice(),
      dist: dist.slice(),
      prev: prev.slice(),
      relaxedEdge: null,
      description: '取出优先队列最小节点 ' + nodes[u].name + '（距离=' + (dist[u] === INF ? '∞' : dist[u].toFixed(1)) + '），标记为已访问'
    });

    if (u === endId) {
      steps.push({
        type: 'done',
        currentNode: u,
        visited: visited.slice(),
        dist: dist.slice(),
        prev: prev.slice(),
        relaxedEdge: null,
        description: '到达终点 ' + endName + '，算法结束'
      });
      break;
    }

    var neighbors = subGraph.adj[u];
    for (var j = 0; j < neighbors.length; j++) {
      var e = neighbors[j];
      var v = e.to;
      if (visited[v]) continue;
      var newDist = dist[u] + e.weight;
      if (newDist < dist[v]) {
        var oldDist = dist[v];
        dist[v] = newDist;
        prev[v] = u;
        steps.push({
          type: 'relax',
          currentNode: u,
          visited: visited.slice(),
          dist: dist.slice(),
          prev: prev.slice(),
          relaxedEdge: { from: u, to: v, weight: e.weight },
          description: '松弛边 ' + nodes[u].name + ' → ' + nodes[v].name + '：距离从 ' + (oldDist === INF ? '∞' : oldDist.toFixed(1)) + ' 更新为 ' + newDist.toFixed(1)
        });
      }
    }
  }

  var pathNodes = [];
  if (dist[endId] < INF) {
    var cur = endId;
    while (cur !== -1) {
      pathNodes.unshift(cur);
      cur = prev[cur];
    }
  }

  return { steps: steps, pathNodes: pathNodes };
};
```

---

### Task 2: 创建 dijkstra-viz.js — 力导向布局

**Files:**
- Modify: `dijkstra-viz.js`

- [ ] **Step 1: 编写 forceLayout 函数**

在 `dijkstra-viz.js` 末尾追加：

```js
DijkstraViz.forceLayout = function (subGraph, startName, endName, width, height) {
  var nodes = subGraph.nodes;
  var edges = subGraph.edges;
  var n = nodes.length;
  var padding = 60;

  var positions = [];
  for (var i = 0; i < n; i++) {
    var angle = (2 * Math.PI * i) / n;
    positions.push({
      x: width / 2 + Math.cos(angle) * (width / 3),
      y: height / 2 + Math.sin(angle) * (height / 3),
      vx: 0,
      vy: 0
    });
  }

  for (var i = 0; i < n; i++) {
    if (nodes[i].name === startName) {
      positions[i].x = padding;
      positions[i].y = height / 2;
    } else if (nodes[i].name === endName) {
      positions[i].x = width - padding;
      positions[i].y = height / 2;
    }
  }

  var repulsion = 8000;
  var attraction = 0.005;
  var damping = 0.9;
  var iterations = 120;

  for (var iter = 0; iter < iterations; iter++) {
    for (var i = 0; i < n; i++) {
      positions[i].fx = 0;
      positions[i].fy = 0;
    }

    for (var i = 0; i < n; i++) {
      for (var j = i + 1; j < n; j++) {
        var dx = positions[j].x - positions[i].x;
        var dy = positions[j].y - positions[i].y;
        var dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < 1) dist = 1;
        var force = repulsion / (dist * dist);
        var fx = (dx / dist) * force;
        var fy = (dy / dist) * force;
        positions[i].fx -= fx;
        positions[i].fy -= fy;
        positions[j].fx += fx;
        positions[j].fy += fy;
      }
    }

    for (var e = 0; e < edges.length; e++) {
      var i = edges[e].from;
      var j = edges[e].to;
      var dx = positions[j].x - positions[i].x;
      var dy = positions[j].y - positions[i].y;
      var dist = Math.sqrt(dx * dx + dy * dy);
      var force = dist * attraction;
      var fx = (dx / (dist || 1)) * force;
      var fy = (dy / (dist || 1)) * force;
      positions[i].fx += fx;
      positions[i].fy += fy;
      positions[j].fx -= fx;
      positions[j].fy -= fy;
    }

    for (var i = 0; i < n; i++) {
      if (nodes[i].name === startName || nodes[i].name === endName) continue;
      positions[i].vx = (positions[i].vx + positions[i].fx) * damping;
      positions[i].vy = (positions[i].vy + positions[i].fy) * damping;
      positions[i].x += positions[i].vx;
      positions[i].y += positions[i].vy;
      positions[i].x = Math.max(padding, Math.min(width - padding, positions[i].x));
      positions[i].y = Math.max(padding, Math.min(height - padding, positions[i].y));
    }
  }

  return positions;
};
```

---

### Task 3: 创建 dijkstra-viz.js — Canvas 渲染器

**Files:**
- Modify: `dijkstra-viz.js`

- [ ] **Step 1: 编写 VizRenderer 对象**

在 `dijkstra-viz.js` 末尾追加：

```js
DijkstraViz.VizRenderer = function (canvas, subGraph, positions, steps, pathNodes) {
  this.canvas = canvas;
  this.ctx = canvas.getContext('2d');
  this.subGraph = subGraph;
  this.positions = positions;
  this.steps = steps;
  this.pathNodes = pathNodes;
  this.currentStep = 0;
  this.nodeRadius = 22;
  this.pathSet = {};
  for (var i = 0; i < pathNodes.length; i++) {
    this.pathSet[pathNodes[i]] = true;
  }
};

DijkstraViz.VizRenderer.prototype.render = function (stepIndex) {
  if (stepIndex < 0) stepIndex = 0;
  if (stepIndex >= this.steps.length) stepIndex = this.steps.length - 1;
  this.currentStep = stepIndex;
  var step = this.steps[stepIndex];
  var ctx = this.ctx;
  var w = this.canvas.width;
  var h = this.canvas.height;

  ctx.clearRect(0, 0, w, h);
  ctx.fillStyle = '#1a1a2e';
  ctx.fillRect(0, 0, w, h);

  this._drawEdges(step);
  this._drawNodes(step);
};

DijkstraViz.VizRenderer.prototype._getNodeColor = function (nodeId, step) {
  if (step.currentNode === nodeId && step.type === 'visit') return '#f59e0b';
  if (step.currentNode === nodeId && step.type === 'relax') return '#f59e0b';
  if (step.type === 'done' && this.pathSet[nodeId]) return '#ef4444';
  if (step.visited[nodeId]) {
    if (this.pathSet[nodeId]) return '#ef4444';
    return '#22c55e';
  }
  if (step.dist[nodeId] < 1e18) return '#60a5fa';
  return '#4b5563';
};

DijkstraViz.VizRenderer.prototype._drawEdges = function (step) {
  var ctx = this.ctx;
  var edges = this.subGraph.edges;
  var positions = this.positions;

  for (var i = 0; i < edges.length; i++) {
    var e = edges[i];
    var from = positions[e.from];
    var to = positions[e.to];

    var isRelaxed = step.relaxedEdge &&
      ((step.relaxedEdge.from === e.from && step.relaxedEdge.to === e.to) ||
       (step.relaxedEdge.from === e.to && step.relaxedEdge.to === e.from));

    var isOnPath = false;
    for (var j = 0; j < this.pathNodes.length - 1; j++) {
      if ((this.pathNodes[j] === e.from && this.pathNodes[j + 1] === e.to) ||
          (this.pathNodes[j] === e.to && this.pathNodes[j + 1] === e.from)) {
        isOnPath = true;
        break;
      }
    }

    ctx.beginPath();
    ctx.moveTo(from.x, from.y);
    ctx.lineTo(to.x, to.y);

    if (isRelaxed) {
      ctx.strokeStyle = '#fbbf24';
      ctx.lineWidth = 4;
      ctx.shadowColor = '#fbbf24';
      ctx.shadowBlur = 12;
    } else if (isOnPath && step.type === 'done') {
      ctx.strokeStyle = '#ef4444';
      ctx.lineWidth = 3;
      ctx.shadowBlur = 0;
    } else {
      ctx.strokeStyle = '#374151';
      ctx.lineWidth = 1.5;
      ctx.shadowBlur = 0;
    }
    ctx.stroke();
    ctx.shadowBlur = 0;

    var midX = (from.x + to.x) / 2;
    var midY = (from.y + to.y) / 2;
    ctx.fillStyle = isRelaxed ? '#fbbf24' : '#6b7280';
    ctx.font = '10px "Microsoft YaHei"';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(e.weight.toFixed(1), midX, midY - 8);
  }
};

DijkstraViz.VizRenderer.prototype._drawNodes = function (step) {
  var ctx = this.ctx;
  var nodes = this.subGraph.nodes;
  var positions = this.positions;
  var r = this.nodeRadius;

  for (var i = 0; i < nodes.length; i++) {
    var pos = positions[i];
    var color = this._getNodeColor(i, step);

    if (step.currentNode === i && (step.type === 'visit' || step.type === 'relax')) {
      ctx.beginPath();
      ctx.arc(pos.x, pos.y, r + 6, 0, Math.PI * 2);
      ctx.fillStyle = color;
      ctx.globalAlpha = 0.25;
      ctx.fill();
      ctx.globalAlpha = 1;
    }

    ctx.beginPath();
    ctx.arc(pos.x, pos.y, r, 0, Math.PI * 2);
    ctx.fillStyle = color;
    ctx.fill();
    ctx.strokeStyle = '#e5e7eb';
    ctx.lineWidth = 2;
    ctx.stroke();

    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 10px "Microsoft YaHei"';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    var displayName = nodes[i].name.length > 4 ? nodes[i].name.substring(0, 4) : nodes[i].name;
    ctx.fillText(displayName, pos.x, pos.y - 4);

    var distText = step.dist[i] >= 1e18 ? '∞' : step.dist[i].toFixed(1);
    ctx.font = '9px "Courier New"';
    ctx.fillStyle = '#d1d5db';
    ctx.fillText(distText, pos.x, pos.y + 10);
  }
};
```

---

### Task 4: 创建 dijkstra-viz.js — 步骤控制器与面板管理

**Files:**
- Modify: `dijkstra-viz.js`

- [ ] **Step 1: 编写 VizController 对象**

在 `dijkstra-viz.js` 末尾追加：

```js
DijkstraViz.VizController = function (panelEl, renderer, steps) {
  this.panelEl = panelEl;
  this.renderer = renderer;
  this.steps = steps;
  this.currentStep = 0;
  this.descEl = panelEl.querySelector('.viz-step-desc');
  this.counterEl = panelEl.querySelector('.viz-step-counter');
  this.btnPrev = panelEl.querySelector('.viz-btn-prev');
  this.btnNext = panelEl.querySelector('.viz-btn-next');
  this.btnReset = panelEl.querySelector('.viz-btn-reset');
  this.btnClose = panelEl.querySelector('.viz-btn-close');
  this.onStepChange = null;
  this._bindEvents();
  this._update();
};

DijkstraViz.VizController.prototype._bindEvents = function () {
  var self = this;
  this.btnPrev.addEventListener('click', function () { self.prev(); });
  this.btnNext.addEventListener('click', function () { self.next(); });
  this.btnReset.addEventListener('click', function () { self.reset(); });
  this.btnClose.addEventListener('click', function () { self.close(); });
  document.addEventListener('keydown', function (e) {
    if (!self.panelEl.classList.contains('viz-panel-visible')) return;
    if (e.key === 'ArrowRight' || e.key === ' ') { e.preventDefault(); self.next(); }
    if (e.key === 'ArrowLeft') { e.preventDefault(); self.prev(); }
    if (e.key === 'Escape') { self.close(); }
  });
};

DijkstraViz.VizController.prototype.next = function () {
  if (this.currentStep < this.steps.length - 1) {
    this.currentStep++;
    this._update();
  }
};

DijkstraViz.VizController.prototype.prev = function () {
  if (this.currentStep > 0) {
    this.currentStep--;
    this._update();
  }
};

DijkstraViz.VizController.prototype.reset = function () {
  this.currentStep = 0;
  this._update();
};

DijkstraViz.VizController.prototype.close = function () {
  this.panelEl.classList.remove('viz-panel-visible');
  if (this.onStepChange) this.onStepChange(null);
};

DijkstraViz.VizController.prototype._update = function () {
  this.renderer.render(this.currentStep);
  var step = this.steps[this.currentStep];
  this.descEl.textContent = step.description;
  this.counterEl.textContent = (this.currentStep + 1) + ' / ' + this.steps.length;
  this.btnPrev.disabled = this.currentStep === 0;
  this.btnNext.disabled = this.currentStep === this.steps.length - 1;
  if (this.onStepChange) this.onStepChange(step);
};

DijkstraViz.open = function (startName, endName, mode) {
  var stationGraph = DijkstraViz.buildStationGraph(graphData, adjList);
  var primaryResult = dijkstra(startName, endName, mode);
  if (!primaryResult || primaryResult.error || primaryResult.path.length === 0) return;

  var subGraph = DijkstraViz.extractSubGraph(stationGraph, primaryResult.path);
  var result = DijkstraViz.dijkstraWithSteps(subGraph, startName, endName);
  if (result.steps.length === 0) return;

  var panel = document.getElementById('viz-panel');
  var canvas = document.getElementById('viz-canvas');
  var containerWidth = canvas.parentElement.clientWidth;
  var containerHeight = 500;
  canvas.width = containerWidth;
  canvas.height = containerHeight;

  var positions = DijkstraViz.forceLayout(subGraph, startName, endName, containerWidth, containerHeight);
  var renderer = new DijkstraViz.VizRenderer(canvas, subGraph, positions, result.steps, result.pathNodes);
  var controller = new DijkstraViz.VizController(panel, renderer, result.steps);

  controller.onStepChange = function (step) {
    if (!step) {
      resetMap();
      return;
    }
    DijkstraViz._highlightMapStep(step, subGraph);
  };

  panel.classList.add('viz-panel-visible');
  controller._update();
};

DijkstraViz._highlightMapStep = function (step, subGraph) {
  stationMarkers.forEach(function (sm) {
    var isVisited = false;
    var isCurrent = false;
    for (var i = 0; i < subGraph.nodes.length; i++) {
      if (subGraph.nodes[i].name === sm.name) {
        isVisited = step.visited[i];
        isCurrent = step.currentNode === i;
        break;
      }
    }
    if (isCurrent) {
      sm.marker.setStyle({ radius: 9, fillOpacity: 1, weight: 3, color: '#f59e0b', fillColor: '#f59e0b' });
    } else if (isVisited) {
      sm.marker.setStyle({ radius: 7, fillOpacity: 0.9, weight: 2, color: '#22c55e', fillColor: '#22c55e' });
    } else if (step.dist) {
      var inQueue = false;
      for (var i = 0; i < subGraph.nodes.length; i++) {
        if (subGraph.nodes[i].name === sm.name && step.dist[i] < 1e18 && !step.visited[i]) {
          inQueue = true;
          break;
        }
      }
      if (inQueue) {
        sm.marker.setStyle({ radius: 6, fillOpacity: 0.8, weight: 2, color: '#60a5fa', fillColor: '#60a5fa' });
      } else {
        sm.marker.setStyle({ fillOpacity: 0.15, opacity: 0.15 });
      }
    } else {
      sm.marker.setStyle({ fillOpacity: 0.15, opacity: 0.15 });
    }
  });

  routeLayers.forEach(function (rl) {
    rl.layer.setStyle({ weight: 2, opacity: 0.1 });
  });
};
```

---

### Task 5: 修改 index.html — 添加面板容器和脚本引用

**Files:**
- Modify: `index.html`

- [ ] **Step 1: 在 `</body>` 前添加面板 DOM 和脚本引用**

在 `<script src="script.js"></script>` 之前添加 `<script src="dijkstra-viz.js"></script>`。

在 `<div id="map"></div>` 之后添加面板 DOM：

```html
<div id="viz-panel" class="viz-panel">
  <div class="viz-panel-header">
    <span class="viz-panel-title">Dijkstra 算法可视化</span>
    <button class="viz-btn-close" title="关闭">✕</button>
  </div>
  <div class="viz-canvas-container">
    <canvas id="viz-canvas"></canvas>
  </div>
  <div class="viz-controls">
    <button class="viz-btn viz-btn-reset">重置</button>
    <button class="viz-btn viz-btn-prev">◀ 上一步</button>
    <span class="viz-step-counter">1 / 1</span>
    <button class="viz-btn viz-btn-next">下一步 ▶</button>
  </div>
  <div class="viz-step-desc"></div>
  <div class="viz-legend">
    <span class="viz-legend-item"><span class="viz-legend-dot" style="background:#4b5563"></span>未访问</span>
    <span class="viz-legend-item"><span class="viz-legend-dot" style="background:#60a5fa"></span>在队列中</span>
    <span class="viz-legend-item"><span class="viz-legend-dot" style="background:#f59e0b"></span>当前处理</span>
    <span class="viz-legend-item"><span class="viz-legend-dot" style="background:#22c55e"></span>已访问</span>
    <span class="viz-legend-item"><span class="viz-legend-dot" style="background:#ef4444"></span>最短路径</span>
  </div>
</div>
```

---

### Task 6: 修改 style.css — 添加可视化面板样式

**Files:**
- Modify: `style.css`

- [ ] **Step 1: 在 style.css 末尾追加面板样式**

```css
.viz-panel {
  display: none;
  position: fixed;
  top: 50%;
  left: calc(340px + (100% - 340px) / 2);
  transform: translate(-50%, -50%);
  width: 720px;
  max-width: calc(100% - 380px);
  background: #1a1a2e;
  border-radius: 12px;
  box-shadow: 0 8px 32px rgba(0,0,0,0.5);
  z-index: 2000;
  overflow: hidden;
  border: 1px solid #2d2d4a;
}
.viz-panel-visible { display: block; }
.viz-panel-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 16px;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: #fff;
}
.viz-panel-title { font-size: 14px; font-weight: bold; }
.viz-btn-close {
  background: none; border: none; color: #fff; font-size: 18px;
  cursor: pointer; opacity: 0.8; padding: 0 4px;
}
.viz-btn-close:hover { opacity: 1; }
.viz-canvas-container { padding: 8px; }
#viz-canvas { width: 100%; border-radius: 8px; background: #1a1a2e; display: block; }
.viz-controls {
  display: flex; align-items: center; justify-content: center;
  gap: 10px; padding: 10px 16px;
}
.viz-btn {
  padding: 6px 14px; border: 1px solid #4b5563; border-radius: 6px;
  background: #2d2d4a; color: #e5e7eb; font-size: 12px; cursor: pointer;
  transition: all 0.2s;
}
.viz-btn:hover:not(:disabled) { background: #4b5563; border-color: #6b7280; }
.viz-btn:disabled { opacity: 0.4; cursor: not-allowed; }
.viz-step-counter {
  color: #9ca3af; font-size: 12px; font-family: "Courier New", monospace;
  min-width: 60px; text-align: center;
}
.viz-step-desc {
  padding: 8px 16px 12px; color: #d1d5db; font-size: 12px;
  line-height: 1.6; min-height: 36px; border-top: 1px solid #2d2d4a;
}
.viz-legend {
  display: flex; justify-content: center; gap: 12px; flex-wrap: wrap;
  padding: 8px 16px 12px; border-top: 1px solid #2d2d4a;
}
.viz-legend-item {
  display: flex; align-items: center; gap: 4px;
  color: #9ca3af; font-size: 10px;
}
.viz-legend-dot {
  width: 8px; height: 8px; border-radius: 50%; display: inline-block;
}
```

---

### Task 7: 修改 script.js — 添加可视化触发按钮

**Files:**
- Modify: `script.js`

- [ ] **Step 1: 在 showResult 函数中添加"可视化算法过程"按钮**

在 `showResult` 函数末尾，`document.getElementById('result-stations').innerHTML = html;` 之后追加：

```js
  var vizBtn = document.getElementById('viz-btn');
  if (!vizBtn) {
    vizBtn = document.createElement('button');
    vizBtn.id = 'viz-btn';
    vizBtn.className = 'viz-trigger-btn';
    vizBtn.textContent = '可视化算法过程';
    vizBtn.onclick = function () {
      DijkstraViz.open(start, end, 0);
    };
    document.getElementById('result-content').appendChild(vizBtn);
  }
  vizBtn.style.display = '';
```

- [ ] **Step 2: 在 style.css 末尾追加触发按钮样式**

```css
.viz-trigger-btn {
  margin-top: 12px; width: 100%; padding: 10px; border: none;
  border-radius: 6px; font-size: 13px; cursor: pointer; color: #fff;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  transition: all 0.25s; font-weight: 500;
}
.viz-trigger-btn:hover {
  box-shadow: 0 4px 12px rgba(102,126,234,0.4);
  transform: translateY(-1px);
}
```

- [ ] **Step 3: 在 showError 函数中隐藏可视化按钮**

在 `showError` 函数中 `document.getElementById('result-content').style.display = 'none';` 之后追加：

```js
  var vizBtn = document.getElementById('viz-btn');
  if (vizBtn) vizBtn.style.display = 'none';
```

---

### Task 8: 验证与调试

**Files:** 无新文件

- [ ] **Step 1: 在浏览器中打开 http://localhost:8080，选择起点和终点，点击查询**

- [ ] **Step 2: 点击"可视化算法过程"按钮，确认面板弹出**

- [ ] **Step 3: 逐步点击"下一步"，验证节点颜色变化、松弛边高亮、步骤描述正确**

- [ ] **Step 4: 验证地图上站点同步高亮**

- [ ] **Step 5: 验证键盘操作（左右箭头、空格、Esc）**

- [ ] **Step 6: 验证关闭面板后地图恢复正常**

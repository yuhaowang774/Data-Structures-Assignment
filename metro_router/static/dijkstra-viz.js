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

DijkstraViz.extractSubGraph = function (stationGraph, pathResult, startName, endName, maxNodes) {
  maxNodes = maxNodes || 35;
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
    var startId = stationGraph.nameToId[startName] ? stationGraph.nameToId[startName].id : -1;
    var endId = stationGraph.nameToId[endName] ? stationGraph.nameToId[endName].id : -1;
    idList.sort(function (a, b) {
      var aP = 2, bP = 2;
      if (a === startId || a === endId) aP = 0;
      else if (pathStationNames[stationGraph.nodes[a].name]) aP = 1;
      if (b === startId || b === endId) bP = 0;
      else if (pathStationNames[stationGraph.nodes[b].name]) bP = 1;
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
    visited: visited.slice(),
    dist: dist.slice(),
    prev: prev.slice(),
    relaxedEdge: null,
    description: '\u521D\u59CB\u5316\uFF1A\u8D77\u70B9 ' + startName + ' \u8DDD\u79BB\u8BBE\u4E3A 0\uFF0C\u5176\u4F59\u4E3A \u221E'
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
      description: '\u53D6\u51FA\u4F18\u5148\u961F\u5217\u6700\u5C0F\u8282\u70B9 ' + nodes[u].name + '\uFF08\u8DDD\u79BB=' + (dist[u] === INF ? '\u221E' : dist[u].toFixed(1)) + '\uFF09\uFF0C\u6807\u8BB0\u4E3A\u5DF2\u8BBF\u95EE'
    });

    if (u === endId) {
      steps.push({
        type: 'done',
        currentNode: u,
        visited: visited.slice(),
        dist: dist.slice(),
        prev: prev.slice(),
        relaxedEdge: null,
        description: '\u5230\u8FBE\u7EC8\u70B9 ' + endName + '\uFF0C\u7B97\u6CD5\u7ED3\u675F'
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
          description: '\u677E\u5F1B\u8FB9 ' + nodes[u].name + ' \u2192 ' + nodes[v].name + '\uFF1A\u8DDD\u79BB\u4ECE ' + (oldDist === INF ? '\u221E' : oldDist.toFixed(1)) + ' \u66F4\u65B0\u4E3A ' + newDist.toFixed(1)
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

DijkstraViz.forceLayout = function (subGraph, startName, endName, width, height) {
  var nodes = subGraph.nodes;
  var edges = subGraph.edges;
  var n = nodes.length;
  var padding = 70;

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

  var repulsion = 10000;
  var attraction = 0.004;
  var damping = 0.85;
  var iterations = 150;

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

DijkstraViz.VizRenderer = function (canvas, subGraph, positions, steps, pathNodes) {
  this.canvas = canvas;
  this.ctx = canvas.getContext('2d');
  this.subGraph = subGraph;
  this.positions = positions;
  this.steps = steps;
  this.pathNodes = pathNodes;
  this.currentStep = 0;
  this.nodeRadius = 24;
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
  var dpr = window.devicePixelRatio || 1;

  ctx.clearRect(0, 0, w, h);

  var bgGrad = ctx.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, Math.max(w, h) * 0.7);
  bgGrad.addColorStop(0, '#1e293b');
  bgGrad.addColorStop(1, '#0f172a');
  ctx.fillStyle = bgGrad;
  ctx.fillRect(0, 0, w, h);

  ctx.save();
  ctx.scale(dpr, dpr);
  var rw = w / dpr;
  var rh = h / dpr;

  this._drawGrid(ctx, rw, rh);
  this._drawEdges(ctx, step, rw, rh);
  this._drawNodes(ctx, step, rw, rh);

  ctx.restore();
};

DijkstraViz.VizRenderer.prototype._drawGrid = function (ctx, w, h) {
  ctx.strokeStyle = 'rgba(99,102,241,0.04)';
  ctx.lineWidth = 1;
  var step = 40;
  for (var x = 0; x < w; x += step) {
    ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, h); ctx.stroke();
  }
  for (var y = 0; y < h; y += step) {
    ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke();
  }
};

DijkstraViz.VizRenderer.prototype._getNodeColor = function (nodeId, step) {
  if (step.currentNode === nodeId && (step.type === 'visit' || step.type === 'relax')) return { fill: '#f59e0b', glow: 'rgba(245,158,11,0.4)' };
  if (step.type === 'done' && this.pathSet[nodeId]) return { fill: '#ef4444', glow: 'rgba(239,68,68,0.3)' };
  if (step.visited[nodeId]) {
    if (this.pathSet[nodeId]) return { fill: '#ef4444', glow: 'rgba(239,68,68,0.2)' };
    return { fill: '#22c55e', glow: 'rgba(34,197,94,0.2)' };
  }
  if (step.dist[nodeId] < 1e18) return { fill: '#60a5fa', glow: 'rgba(96,165,250,0.2)' };
  return { fill: '#475569', glow: 'none' };
};

DijkstraViz.VizRenderer.prototype._drawEdges = function (ctx, step, w, h) {
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

    var isVisited = step.visited[e.from] && step.visited[e.to];
    var isInTree = isVisited && (step.prev[e.to] === e.from || step.prev[e.from] === e.to);

    ctx.beginPath();
    ctx.moveTo(from.x, from.y);
    ctx.lineTo(to.x, to.y);

    if (isRelaxed) {
      ctx.strokeStyle = '#fbbf24';
      ctx.lineWidth = 3.5;
      ctx.shadowColor = '#fbbf24';
      ctx.shadowBlur = 16;
    } else if (isOnPath && step.type === 'done') {
      ctx.strokeStyle = '#ef4444';
      ctx.lineWidth = 2.5;
      ctx.shadowColor = '#ef4444';
      ctx.shadowBlur = 8;
    } else if (isInTree) {
      ctx.strokeStyle = 'rgba(34,197,94,0.6)';
      ctx.lineWidth = 2;
      ctx.shadowBlur = 0;
    } else if (isVisited) {
      ctx.strokeStyle = 'rgba(34,197,94,0.25)';
      ctx.lineWidth = 1.5;
      ctx.shadowBlur = 0;
    } else {
      ctx.strokeStyle = 'rgba(71,85,105,0.5)';
      ctx.lineWidth = 1.2;
      ctx.shadowBlur = 0;
    }
    ctx.stroke();
    ctx.shadowBlur = 0;

    var midX = (from.x + to.x) / 2;
    var midY = (from.y + to.y) / 2;
    var angle = Math.atan2(to.y - from.y, to.x - from.x);
    var offsetX = Math.sin(angle) * 10;
    var offsetY = -Math.cos(angle) * 10;

    if (isRelaxed) {
      ctx.fillStyle = '#fbbf24';
    } else if (isInTree) {
      ctx.fillStyle = 'rgba(34,197,94,0.8)';
    } else {
      ctx.fillStyle = 'rgba(100,116,139,0.7)';
    }
    ctx.font = '10px "Courier New"';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(e.weight.toFixed(1), midX + offsetX, midY + offsetY);
  }
};

DijkstraViz.VizRenderer.prototype._drawNodes = function (ctx, step, w, h) {
  var nodes = this.subGraph.nodes;
  var positions = this.positions;
  var r = this.nodeRadius;

  for (var i = 0; i < nodes.length; i++) {
    var pos = positions[i];
    var colorInfo = this._getNodeColor(i, step);

    if (colorInfo.glow !== 'none') {
      ctx.beginPath();
      ctx.arc(pos.x, pos.y, r + 10, 0, Math.PI * 2);
      var glowGrad = ctx.createRadialGradient(pos.x, pos.y, r, pos.x, pos.y, r + 10);
      glowGrad.addColorStop(0, colorInfo.glow);
      glowGrad.addColorStop(1, 'transparent');
      ctx.fillStyle = glowGrad;
      ctx.fill();
    }

    ctx.beginPath();
    ctx.arc(pos.x, pos.y, r, 0, Math.PI * 2);
    var nodeGrad = ctx.createRadialGradient(pos.x - r * 0.3, pos.y - r * 0.3, 0, pos.x, pos.y, r);
    nodeGrad.addColorStop(0, this._lighten(colorInfo.fill, 30));
    nodeGrad.addColorStop(1, colorInfo.fill);
    ctx.fillStyle = nodeGrad;
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.15)';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 11px "Microsoft YaHei"';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    var displayName = nodes[i].name.length > 4 ? nodes[i].name.substring(0, 3) + '..' : nodes[i].name;
    ctx.fillText(displayName, pos.x, pos.y - 5);

    var distText = step.dist[i] >= 1e18 ? '\u221E' : step.dist[i].toFixed(1);
    ctx.font = '9px "Courier New"';
    ctx.fillStyle = 'rgba(226,232,240,0.8)';
    ctx.fillText(distText, pos.x, pos.y + 10);
  }
};

DijkstraViz.VizRenderer.prototype._lighten = function (hex, percent) {
  var num = parseInt(hex.replace('#', ''), 16);
  var r = Math.min(255, (num >> 16) + percent);
  var g = Math.min(255, ((num >> 8) & 0x00FF) + percent);
  var b = Math.min(255, (num & 0x0000FF) + percent);
  return '#' + (0x1000000 + r * 0x10000 + g * 0x100 + b).toString(16).slice(1);
};

DijkstraViz.VizController = function (panelEl, renderer, steps) {
  this.panelEl = panelEl;
  this.renderer = renderer;
  this.steps = steps;
  this.currentStep = 0;
  this.descEl = panelEl.querySelector('.viz-step-desc');
  this.counterEl = panelEl.querySelector('.viz-step-counter');
  this.progressFill = panelEl.querySelector('.viz-progress-fill');
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
  var canvas = this.panelEl.querySelector('#viz-canvas');
  if (canvas) {
    var touchStartX = 0;
    canvas.addEventListener('touchstart', function (e) {
      if (e.touches.length === 1) touchStartX = e.touches[0].clientX;
    }, { passive: true });
    canvas.addEventListener('touchend', function (e) {
      var dx = e.changedTouches[0].clientX - touchStartX;
      if (Math.abs(dx) > 50) {
        if (dx < 0) self.next();
        else self.prev();
      }
    }, { passive: true });
  }
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
  var pct = ((this.currentStep) / (this.steps.length - 1)) * 100;
  this.progressFill.style.width = pct + '%';
  this.btnPrev.disabled = this.currentStep === 0;
  this.btnNext.disabled = this.currentStep === this.steps.length - 1;
  if (this.onStepChange) this.onStepChange(step);
};

DijkstraViz._makeDraggable = function (panel) {
  var header = panel.querySelector('.viz-panel-header');
  var isDragging = false;
  var startX, startY, origLeft, origTop;

  function startDrag(clientX, clientY) {
    isDragging = true;
    var rect = panel.getBoundingClientRect();
    startX = clientX;
    startY = clientY;
    origLeft = rect.left;
    origTop = rect.top;
    panel.style.transform = 'none';
    panel.style.left = origLeft + 'px';
    panel.style.top = origTop + 'px';
  }

  function moveDrag(clientX, clientY) {
    if (!isDragging) return;
    var dx = clientX - startX;
    var dy = clientY - startY;
    panel.style.left = (origLeft + dx) + 'px';
    panel.style.top = (origTop + dy) + 'px';
  }

  function endDrag() {
    isDragging = false;
  }

  header.addEventListener('mousedown', function (e) {
    if (e.target.classList.contains('viz-btn-close')) return;
    startDrag(e.clientX, e.clientY);
    e.preventDefault();
  });

  document.addEventListener('mousemove', function (e) {
    moveDrag(e.clientX, e.clientY);
  });

  document.addEventListener('mouseup', endDrag);

  if (window.innerWidth > 768) {
    header.addEventListener('touchstart', function (e) {
      if (e.target.classList.contains('viz-btn-close')) return;
      if (e.touches.length === 1) {
        startDrag(e.touches[0].clientX, e.touches[0].clientY);
      }
    }, { passive: true });

    document.addEventListener('touchmove', function (e) {
      if (isDragging && e.touches.length === 1) {
        moveDrag(e.touches[0].clientX, e.touches[0].clientY);
      }
    }, { passive: true });

    document.addEventListener('touchend', endDrag);
  }
};

DijkstraViz._currentController = null;

DijkstraViz.open = function (startName, endName, mode, altIndex) {
  try {
    var stationGraph = DijkstraViz.buildStationGraph(graphData, adjList);

    var pathData;
    if (typeof altIndex === 'number' && altIndex >= 0 && typeof allPathResults !== 'undefined' && allPathResults[altIndex]) {
      pathData = allPathResults[altIndex].data;
    }
    if (!pathData || !pathData.path || pathData.path.length === 0) {
      pathData = dijkstra(startName, endName, mode);
    }
    if (!pathData || pathData.error || pathData.path.length === 0) return;

    var subGraph = DijkstraViz.extractSubGraph(stationGraph, pathData.path, startName, endName);
    var result = DijkstraViz.dijkstraWithSteps(subGraph, startName, endName);
    if (result.steps.length === 0) return;

    var panel = document.getElementById('viz-panel');
    var canvas = document.getElementById('viz-canvas');

    panel.classList.add('viz-panel-visible');

    var dpr = window.devicePixelRatio || 1;
    var canvasWrap = canvas.parentElement;
    var cw = canvasWrap.clientWidth;
    var ch = canvasWrap.clientHeight;
    canvas.width = cw * dpr;
    canvas.height = ch * dpr;
    canvas.style.width = cw + 'px';
    canvas.style.height = ch + 'px';

    var positions = DijkstraViz.forceLayout(subGraph, startName, endName, cw, ch);
    var renderer = new DijkstraViz.VizRenderer(canvas, subGraph, positions, result.steps, result.pathNodes);
    var controller = new DijkstraViz.VizController(panel, renderer, result.steps);

    DijkstraViz._currentController = controller;

    controller.onStepChange = function (step) {
      if (!step) {
        resetMap();
        return;
      }
      DijkstraViz._highlightMapStep(step, subGraph);
    };

    DijkstraViz._makeDraggable(panel);

    var resizeTimer = null;
    if (DijkstraViz._resizeObs) DijkstraViz._resizeObs.disconnect();
    DijkstraViz._resizeObs = new ResizeObserver(function () {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(function () {
        var cw2 = canvasWrap.clientWidth;
        var ch2 = canvasWrap.clientHeight;
        if (cw2 < 10 || ch2 < 10) return;
        canvas.width = cw2 * dpr;
        canvas.height = ch2 * dpr;
        canvas.style.width = cw2 + 'px';
        canvas.style.height = ch2 + 'px';
        var newPos = DijkstraViz.forceLayout(subGraph, startName, endName, cw2, ch2);
        renderer.positions = newPos;
        renderer.render(controller.currentStep);
      }, 150);
    });
    DijkstraViz._resizeObs.observe(panel);

    controller._update();
  } catch (err) {
    console.error('DijkstraViz.open error:', err);
  }
};

DijkstraViz._highlightMapStep = function (step, subGraph) {
  stationMarkers.forEach(function (sm) {
    var isVisited = false;
    var isCurrent = false;
    var inQueue = false;
    for (var i = 0; i < subGraph.nodes.length; i++) {
      if (subGraph.nodes[i].name === sm.name) {
        isVisited = step.visited[i];
        isCurrent = step.currentNode === i;
        if (step.dist[i] < 1e18 && !step.visited[i]) inQueue = true;
        break;
      }
    }
    if (isCurrent) {
      sm.marker.setStyle({ radius: 9, fillOpacity: 1, weight: 3, color: '#f59e0b', fillColor: '#f59e0b' });
    } else if (isVisited) {
      sm.marker.setStyle({ radius: 7, fillOpacity: 0.9, weight: 2, color: '#22c55e', fillColor: '#22c55e' });
    } else if (inQueue) {
      sm.marker.setStyle({ radius: 6, fillOpacity: 0.8, weight: 2, color: '#60a5fa', fillColor: '#60a5fa' });
    } else {
      sm.marker.setStyle({ fillOpacity: 0.15, opacity: 0.15 });
    }
  });

  routeLayers.forEach(function (rl) {
    rl.layer.setStyle({ weight: 2, opacity: 0.1 });
  });
};

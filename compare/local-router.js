var fs = require('fs');
var path = require('path');

function MinHeap() {
  this.heap = [];
}

MinHeap.prototype.insert = function (node) {
  this.heap.push(node);
  var i = this.heap.length - 1;
  while (i > 0) {
    var parent = Math.floor((i - 1) / 2);
    if (this.heap[parent].cost <= this.heap[i].cost) break;
    var tmp = this.heap[parent];
    this.heap[parent] = this.heap[i];
    this.heap[i] = tmp;
    i = parent;
  }
};

MinHeap.prototype.extractMin = function () {
  if (this.heap.length === 0) return null;
  var min = this.heap[0];
  var last = this.heap.pop();
  if (this.heap.length > 0) {
    this.heap[0] = last;
    var i = 0;
    while (true) {
      var left = 2 * i + 1;
      var right = 2 * i + 2;
      var smallest = i;
      if (left < this.heap.length && this.heap[left].cost < this.heap[smallest].cost) {
        smallest = left;
      }
      if (right < this.heap.length && this.heap[right].cost < this.heap[smallest].cost) {
        smallest = right;
      }
      if (smallest === i) break;
      var tmp = this.heap[smallest];
      this.heap[smallest] = this.heap[i];
      this.heap[i] = tmp;
      i = smallest;
    }
  }
  return min;
};

MinHeap.prototype.isEmpty = function () {
  return this.heap.length === 0;
};

function buildAdjList(graphData) {
  var adjList = {};
  var nodes = graphData.nodes;
  var edges = graphData.edges;
  for (var i = 0; i < nodes.length; i++) {
    adjList[nodes[i].id] = [];
  }
  for (var j = 0; j < edges.length; j++) {
    var e = edges[j];
    adjList[e.from].push({
      to: e.to,
      weight: e.weight,
      line: e.line,
      is_transfer: e.is_transfer,
    });
  }
  return adjList;
}

function extractPathSegments(pathResult) {
  if (!pathResult || pathResult.length === 0) return [];
  var segments = [];
  var segStart = 0;
  for (var i = 1; i < pathResult.length; i++) {
    if (pathResult[i].line !== pathResult[segStart].line) {
      segments.push({
        line: pathResult[segStart].line,
        startIdx: segStart,
        endIdx: i - 1,
        fromStation: pathResult[segStart].station,
        toStation: pathResult[i - 1].station,
      });
      segStart = i;
    }
  }
  segments.push({
    line: pathResult[segStart].line,
    startIdx: segStart,
    endIdx: pathResult.length - 1,
    fromStation: pathResult[segStart].station,
    toStation: pathResult[pathResult.length - 1].station,
  });
  return segments;
}

function dijkstra(graphData, adjList, startName, endName, mode) {
  var nodes = graphData.nodes;
  var n = nodes.length;

  var startNodes = [];
  var endNodes = [];
  for (var i = 0; i < n; i++) {
    if (nodes[i].station === startName) startNodes.push(i);
    if (nodes[i].station === endName) endNodes.push(i);
  }

  if (startNodes.length === 0 || endNodes.length === 0) {
    return { path: [], error: 'No path found' };
  }

  var endSet = {};
  for (var e = 0; e < endNodes.length; e++) {
    endSet[endNodes[e]] = true;
  }

  var INF = 1e18;
  var dist = new Array(n);
  var transferArr = new Array(n);
  var visited = new Array(n);
  var prev = new Array(n);
  for (var i = 0; i < n; i++) {
    dist[i] = INF;
    transferArr[i] = 0;
    visited[i] = false;
    prev[i] = -1;
  }

  var heap = new MinHeap();

  for (var s = 0; s < startNodes.length; s++) {
    var si = startNodes[s];
    dist[si] = 0;
    transferArr[si] = 0;
    heap.insert({ nodeId: si, cost: 0, totalTime: 0, transfers: 0 });
  }

  var foundNode = -1;

  while (!heap.isEmpty()) {
    var cur = heap.extractMin();
    if (cur === null) break;
    if (visited[cur.nodeId]) continue;
    visited[cur.nodeId] = true;

    if (endSet[cur.nodeId]) {
      foundNode = cur.nodeId;
      break;
    }

    var edges = adjList[cur.nodeId];
    if (!edges) continue;
    for (var j = 0; j < edges.length; j++) {
      var edge = edges[j];
      var neighbor = edge.to;
      if (visited[neighbor]) continue;

      var newTime = dist[cur.nodeId] + edge.weight;
      var newTransfers = transferArr[cur.nodeId] + edge.is_transfer;

      var newCost;
      if (mode === 0) {
        newCost = newTime;
      } else {
        newCost = newTransfers + newTime * 1e-6;
      }

      if (
        newCost <
        (dist[neighbor] === INF
          ? INF
          : mode === 0
            ? dist[neighbor]
            : transferArr[neighbor] + dist[neighbor] * 1e-6)
      ) {
        dist[neighbor] = newTime;
        transferArr[neighbor] = newTransfers;
        prev[neighbor] = cur.nodeId;
        heap.insert({
          nodeId: neighbor,
          cost: newCost,
          totalTime: newTime,
          transfers: newTransfers,
        });
      }
    }
  }

  if (foundNode === -1) {
    return { path: [], error: 'No path found' };
  }

  var pathIdx = [];
  var cur = foundNode;
  while (cur !== -1) {
    pathIdx.unshift(cur);
    cur = prev[cur];
  }

  var pathResult = [];
  for (var i = 0; i < pathIdx.length; i++) {
    var node = nodes[pathIdx[i]];
    pathResult.push({
      station: node.station,
      line: node.line,
      lon: node.lon,
      lat: node.lat,
    });
  }

  var transferStations = [];
  var uniqueCount = 0;
  var lastStation = '';
  for (var i = 0; i < pathResult.length; i++) {
    if (pathResult[i].station !== lastStation) {
      uniqueCount++;
      lastStation = pathResult[i].station;
    }
    if (i > 0 && i < pathResult.length - 1) {
      if (
        pathResult[i].station === pathResult[i - 1].station &&
        pathResult[i].line !== pathResult[i - 1].line
      ) {
        transferStations.push(pathResult[i].station);
      }
    }
  }

  var rawSegments = extractPathSegments(pathResult);
  var segments = rawSegments.map(function (seg) {
    var stations = [];
    for (var k = seg.startIdx; k <= seg.endIdx; k++) {
      if (k === seg.startIdx || pathResult[k].station !== pathResult[k - 1].station) {
        stations.push(pathResult[k].station);
      }
    }
    return {
      line: seg.line,
      from: seg.fromStation,
      to: seg.toStation,
      stations: stations,
    };
  });

  return {
    path: pathResult,
    total_time: dist[foundNode],
    transfers: transferArr[foundNode],
    transfer_stations: transferStations,
    station_count: uniqueCount,
    segments: segments,
  };
}

function LocalRouter(dataDir) {
  var graphPath = path.resolve(__dirname, dataDir, 'graph.json');
  var graphData = JSON.parse(fs.readFileSync(graphPath, 'utf-8'));
  var adjList = buildAdjList(graphData);
  this.graphData = graphData;
  this.adjList = adjList;
}

LocalRouter.prototype.query = function (startName, endName, mode) {
  return dijkstra(this.graphData, this.adjList, startName, endName, mode || 0);
};

LocalRouter.prototype.getStationNames = function () {
  var seen = {};
  var names = [];
  for (var i = 0; i < this.graphData.nodes.length; i++) {
    var name = this.graphData.nodes[i].station;
    if (!seen[name]) {
      seen[name] = true;
      names.push(name);
    }
  }
  return names;
};

LocalRouter.prototype.getStationCoord = function (name) {
  for (var i = 0; i < this.graphData.nodes.length; i++) {
    if (this.graphData.nodes[i].station === name) {
      return { lon: this.graphData.nodes[i].lon, lat: this.graphData.nodes[i].lat };
    }
  }
  return null;
};

module.exports = LocalRouter;

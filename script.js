var map,
  routesData,
  stationsData,
  pathLayer,
  segmentLayers = [],
  transferMarkers = [];
var ROUTE_COLORS = {};
var routeLayers = [];
var stationMarkers = [];
var routesByName = {};
var routeStationPathMap = {};
var graphData, adjList;
var activeInputId = null;

var GCJ_A = 6378245.0;
var GCJ_EE = 0.00669342162296594323;

function gcj02Lat(lat, lon) {
  if (lon < 72.004 || lon > 137.8347 || lat < 0.8293 || lat > 55.8271)
    return lat;
  var x = lon - 105.0,
    y = lat - 35.0;
  var dLat =
    -100.0 +
    2.0 * x +
    3.0 * y +
    0.2 * y * y +
    0.1 * x * y +
    0.2 * Math.sqrt(Math.abs(x));
  dLat +=
    ((20.0 * Math.sin(6.0 * x * Math.PI) + 20.0 * Math.sin(2.0 * x * Math.PI)) *
      2.0) /
    3.0;
  dLat +=
    ((20.0 * Math.sin(y * Math.PI) + 40.0 * Math.sin((y / 3.0) * Math.PI)) *
      2.0) /
    3.0;
  dLat +=
    ((160.0 * Math.sin((y / 12.0) * Math.PI) +
      320.0 * Math.sin((y * Math.PI) / 30.0)) *
      2.0) /
    3.0;
  var radLat = (lat / 180.0) * Math.PI;
  var magic = Math.sin(radLat);
  magic = 1 - GCJ_EE * magic * magic;
  var sqrtMagic = Math.sqrt(magic);
  dLat =
    (dLat * 180.0) / (((GCJ_A * (1 - GCJ_EE)) / (magic * sqrtMagic)) * Math.PI);
  return lat + dLat;
}

function gcj02Lon(lat, lon) {
  if (lon < 72.004 || lon > 137.8347 || lat < 0.8293 || lat > 55.8271)
    return lon;
  var x = lon - 105.0,
    y = lat - 35.0;
  var dLon =
    300.0 +
    x +
    2.0 * y +
    0.1 * x * x +
    0.1 * x * y +
    0.1 * Math.sqrt(Math.abs(x));
  dLon +=
    ((20.0 * Math.sin(6.0 * x * Math.PI) + 20.0 * Math.sin(2.0 * x * Math.PI)) *
      2.0) /
    3.0;
  dLon +=
    ((20.0 * Math.sin(x * Math.PI) + 40.0 * Math.sin((x / 3.0) * Math.PI)) *
      2.0) /
    3.0;
  dLon +=
    ((150.0 * Math.sin((x / 12.0) * Math.PI) +
      300.0 * Math.sin((x / 30.0) * Math.PI)) *
      2.0) /
    3.0;
  var radLat = (lat / 180.0) * Math.PI;
  var magic = Math.sin(radLat);
  magic = 1 - GCJ_EE * magic * magic;
  var sqrtMagic = Math.sqrt(magic);
  dLon = (dLon * 180.0) / ((GCJ_A / sqrtMagic) * Math.cos(radLat) * Math.PI);
  return lon + dLon;
}

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
      if (
        left < this.heap.length &&
        this.heap[left].cost < this.heap[smallest].cost
      ) {
        smallest = left;
      }
      if (
        right < this.heap.length &&
        this.heap[right].cost < this.heap[smallest].cost
      ) {
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

function dijkstra(startName, endName, mode) {
  var nodes = graphData.nodes;
  var n = nodes.length;

  var startNodes = [];
  var endNodes = [];
  for (var i = 0; i < n; i++) {
    if (nodes[i].station === startName) startNodes.push(i);
    if (nodes[i].station === endName) endNodes.push(i);
  }

  if (startNodes.length === 0 || endNodes.length === 0) {
    return { path: [], error: "No path found" };
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
    var cost = mode === 1 ? 0 : 0;
    heap.insert({ nodeId: si, cost: cost, totalTime: 0, transfers: 0 });
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
    return { path: [], error: "No path found" };
  }

  var path = [];
  var cur = foundNode;
  while (cur !== -1) {
    path.unshift(cur);
    cur = prev[cur];
  }

  var pathResult = [];
  for (var i = 0; i < path.length; i++) {
    var node = nodes[path[i]];
    pathResult.push({
      station: node.station,
      line: node.line,
      lon: node.lon,
      lat: node.lat,
    });
  }

  var transferStations = [];
  var uniqueCount = 0;
  var lastStation = "";
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

  return {
    path: pathResult,
    total_time: dist[foundNode],
    transfers: transferArr[foundNode],
    transfer_stations: transferStations,
    station_count: uniqueCount,
  };
}

function initMap() {
  map = L.map("map").setView(
    [gcj02Lat(34.26, 108.95), gcj02Lon(34.26, 108.95)],
    12,
  );
  L.tileLayer(
    "https://webrd0{s}.is.autonavi.com/appmaptile?lang=zh_cn&size=1&scale=1&style=8&x={x}&y={y}&z={z}",
    {
      subdomains: "123",
      attribution: "&copy; 高德地图",
      maxZoom: 18,
    },
  ).addTo(map);
  loadData();
}

function loadData() {
  Promise.all([
    fetch("data/graph.json").then(function (r) {
      return r.json();
    }),
    fetch("data/stations.json").then(function (r) {
      return r.json();
    }),
    fetch("data/routes.json").then(function (r) {
      return r.json();
    }),
  ])
    .then(function (results) {
      graphData = results[0];
      buildAdjList();
      routesData = results[2].routes;
      stationsData = results[1].stations;
      graphData.nodes.forEach(function (n) {
        var oLat = n.lat;
        n.lat = gcj02Lat(n.lat, n.lon);
        n.lon = gcj02Lon(oLat, n.lon);
      });
      stationsData.forEach(function (s) {
        var oLat = s.lat;
        s.lat = gcj02Lat(s.lat, s.lon);
        s.lon = gcj02Lon(oLat, s.lon);
      });
      routesData.forEach(function (r) {
        r.stations.forEach(function (s) {
          var oLat = s.lat;
          s.lat = gcj02Lat(s.lat, s.lon);
          s.lon = gcj02Lon(oLat, s.lon);
        });
        if (r.path) {
          r.path = r.path.map(function (p) {
            return [gcj02Lat(p[0], p[1]), gcj02Lon(p[0], p[1])];
          });
        }
      });
      initSearchInputs();
      buildRouteIndex();
      drawRoutes();
      drawStations();
    })
    .catch(function () {
      alert("加载数据失败");
    });
}

function buildAdjList() {
  adjList = {};
  for (var i = 0; i < graphData.nodes.length; i++) {
    adjList[graphData.nodes[i].id] = [];
  }
  for (var j = 0; j < graphData.edges.length; j++) {
    var e = graphData.edges[j];
    adjList[e.from].push({
      to: e.to,
      weight: e.weight,
      line: e.line,
      is_transfer: e.is_transfer,
    });
  }
}

function buildRouteIndex() {
  routesByName = {};
  routeStationPathMap = {};
  routesData.forEach(function (route) {
    routesByName[route.name] = route;
    if (route.path && route.path.length > 0) {
      var mapping = {};
      route.stations.forEach(function (station) {
        var sLat = station.lat;
        var sLon = station.lon;
        var minDist = Infinity;
        var minIdx = 0;
        for (var k = 0; k < route.path.length; k++) {
          var pLat = route.path[k][0];
          var pLon = route.path[k][1];
          var d = (sLat - pLat) * (sLat - pLat) + (sLon - pLon) * (sLon - pLon);
          if (d < minDist) {
            minDist = d;
            minIdx = k;
          }
        }
        mapping[station.name] = minIdx;
      });
      routeStationPathMap[route.name] = mapping;
    }
  });
}

function initSearchInputs() {
  setupSearchInput("start-input", "start-dropdown");
  setupSearchInput("end-input", "end-dropdown");
  document.getElementById("start-input").addEventListener("click", function () {
    setActiveInput("start-input");
  });
  document.getElementById("end-input").addEventListener("click", function () {
    setActiveInput("end-input");
  });
}

function setActiveInput(inputId) {
  activeInputId = inputId;
  document
    .getElementById("start-input")
    .classList.toggle("input-active", inputId === "start-input");
  document
    .getElementById("end-input")
    .classList.toggle("input-active", inputId === "end-input");
}

function setupSearchInput(inputId, dropdownId) {
  var input = document.getElementById(inputId);
  var dropdown = document.getElementById(dropdownId);
  input.addEventListener("input", function () {
    var keyword = this.value.trim().toLowerCase();
    dropdown.innerHTML = "";
    if (!keyword) {
      dropdown.classList.remove("show");
      return;
    }
    var matches = stationsData
      .filter(function (s) {
        return s.name.toLowerCase().indexOf(keyword) !== -1;
      })
      .slice(0, 20);
    if (matches.length === 0) {
      dropdown.classList.remove("show");
      return;
    }
    matches.forEach(function (s) {
      var div = document.createElement("div");
      div.className = "dropdown-item";
      div.textContent = s.name + (s.is_transfer ? " (换乘)" : "");
      div.onclick = function () {
        input.value = s.name;
        dropdown.classList.remove("show");
      };
      dropdown.appendChild(div);
    });
    dropdown.classList.add("show");
  });
  input.addEventListener("blur", function () {
    setTimeout(function () {
      dropdown.classList.remove("show");
    }, 200);
  });
}

function drawRoutes() {
  routeLayers = [];
  routesData.forEach(function (route) {
    ROUTE_COLORS[route.name] = route.color;
    var coords =
      route.path ||
      route.stations.map(function (s) {
        return [s.lat, s.lon];
      });
    var layer = L.polyline(coords, { color: route.color, weight: 3, opacity: 0.7 })
      .bindTooltip(route.name, { sticky: true })
      .addTo(map);
    routeLayers.push({ name: route.name, layer: layer, originalStyle: { color: route.color, weight: 3, opacity: 0.7 } });
  });
}

function drawStations() {
  stationMarkers = [];
  stationsData.forEach(function (s) {
    var radius = s.is_transfer ? 6 : 4;
    var color = s.is_transfer ? "#E67E22" : "#4A90D9";
    var tooltipHtml =
      '<div class="station-tooltip"><strong>' +
      s.name +
      "</strong>" +
      (s.is_transfer
        ? ' <span class="tooltip-transfer-tag">换乘站</span>'
        : "") +
      '<div class="tooltip-lines">';
    s.lines.forEach(function (line) {
      var lineColor = ROUTE_COLORS[line] || "#999";
      tooltipHtml +=
        '<span class="tooltip-line-tag" style="background:' +
        lineColor +
        '">' +
        line +
        "</span>";
    });
    tooltipHtml += "</div></div>";
    var marker = L.circleMarker([s.lat, s.lon], {
      radius: radius,
      color: color,
      fillColor: color,
      fillOpacity: 0.8,
      weight: 1.5,
    }).bindTooltip(tooltipHtml, { className: "station-tooltip-container" });
    marker.on("click", function () {
      if (!activeInputId) return;
      var input = document.getElementById(activeInputId);
      input.value = s.name;
      var dropdownId =
        activeInputId === "start-input" ? "start-dropdown" : "end-dropdown";
      document.getElementById(dropdownId).classList.remove("show");
      setActiveInput(null);
    });
    marker.addTo(map);
    stationMarkers.push({ name: s.name, lines: s.lines, marker: marker, originalStyle: { radius: radius, color: color, fillColor: color, fillOpacity: 0.8, weight: 1.5 } });
  });
}

function queryPath(mode) {
  var startInput = document.getElementById("start-input");
  var endInput = document.getElementById("end-input");
  var start = startInput.value.trim();
  var end = endInput.value.trim();
  if (!start || !end) {
    alert("请输入起点和终点站名");
    return;
  }

  document.getElementById("result").className = "hidden";

  var data = dijkstra(start, end, mode);
  if (!data || data.error) {
    showError(data ? data.error : "查询失败");
    return;
  }
  showResult(data, start, end);
  highlightPath(data);
}

function showError(msg) {
  var result = document.getElementById("result");
  result.className = "";
  document.getElementById("result-error").style.display = "block";
  document.getElementById("result-error").textContent = msg;
  document.getElementById("result-content").style.display = "none";
}

function showResult(data, start, end) {
  var result = document.getElementById("result");
  result.className = "";
  document.getElementById("result-error").style.display = "none";
  document.getElementById("result-content").style.display = "";
  var totalTime = data.total_time + 3;
  document.getElementById("result-time").textContent =
    "总时间: " + totalTime.toFixed(2) + " 分钟（含等车3分钟）";
  document.getElementById("result-transfers").textContent =
    "换乘: " + data.transfers + " 次";

  var html = "<strong>路径详情:</strong><br>";
  var lastStation = "";
  for (var i = 0; i < data.path.length; i++) {
    var p = data.path[i];
    if (p.station !== lastStation) {
      var isTransfer = false;
      for (var j = 0; j < data.transfer_stations.length; j++) {
        if (data.transfer_stations[j] === p.station) {
          isTransfer = true;
          break;
        }
      }
      var color = ROUTE_COLORS[p.line] || "#999";
      html +=
        '<span class="line-tag" style="background:' +
        color +
        '">' +
        p.line +
        "</span>";
      if (isTransfer) {
        html +=
          '<strong class="transfer-marker">' + p.station + " ← 换乘</strong>";
      } else {
        html += p.station;
      }
      html += "<br>";
      lastStation = p.station;
    }
  }
  document.getElementById("result-stations").innerHTML = html;
}

function highlightPath(data) {
  if (pathLayer) {
    map.removeLayer(pathLayer);
    pathLayer = null;
  }
  segmentLayers.forEach(function (sl) {
    map.removeLayer(sl);
  });
  segmentLayers = [];
  transferMarkers.forEach(function (m) {
    map.removeLayer(m);
  });
  transferMarkers = [];

  var pathStations = {};
  for (var i = 0; i < data.path.length; i++) {
    pathStations[data.path[i].station] = true;
  }

  routeLayers.forEach(function (rl) {
    rl.layer.setStyle({ weight: 2, opacity: 0 });
  });

  stationMarkers.forEach(function (sm) {
    if (pathStations[sm.name]) {
      sm.marker.setStyle({ radius: 7, fillOpacity: 1, weight: 2, color: "#333" });
    } else {
      sm.marker.setStyle({ fillOpacity: 0, opacity: 0 });
    }
  });

  var segments = extractPathSegments(data.path);
  var layers = buildPathSegmentLayers(segments, data.path, routesByName, routeStationPathMap, ROUTE_COLORS);

  var allCoords = [];
  layers.forEach(function (l) {
    if (l.coords.length > 1) {
      var segLayer = L.polyline(l.coords, {
        color: l.color,
        weight: 5,
        opacity: 0.9,
      }).addTo(map);
      segmentLayers.push(segLayer);
      allCoords = allCoords.concat(l.coords);
    }
  });

  pathLayer = L.polyline(allCoords, {
    color: "#e74c3c",
    weight: 6,
    opacity: 0.85,
    dashArray: "8 8",
  }).addTo(map);
  map.fitBounds(pathLayer.getBounds(), { padding: [40, 40] });

  data.transfer_stations.forEach(function (name) {
    var station = stationsData.find(function (s) {
      return s.name === name;
    });
    if (station) {
      var m = L.marker([station.lat, station.lon], {
        icon: L.divIcon({
          className: "transfer-marker-icon",
          html:
            '<div style="background:#E67E22;color:#fff;border-radius:50%;' +
            "width:24px;height:24px;line-height:24px;text-align:center;" +
            'font-size:12px;border:2px solid #fff;">↔</div>',
          iconSize: [24, 24],
          iconAnchor: [12, 12],
        }),
      }).addTo(map);
      transferMarkers.push(m);
    }
  });
}

function resetMap() {
  if (pathLayer) {
    map.removeLayer(pathLayer);
    pathLayer = null;
  }
  segmentLayers.forEach(function (sl) {
    map.removeLayer(sl);
  });
  segmentLayers = [];
  transferMarkers.forEach(function (m) {
    map.removeLayer(m);
  });
  transferMarkers = [];

  routeLayers.forEach(function (rl) {
    rl.layer.setStyle(rl.originalStyle);
  });

  stationMarkers.forEach(function (sm) {
    sm.marker.setStyle(sm.originalStyle);
  });

  map.setView([gcj02Lat(34.26, 108.95), gcj02Lon(34.26, 108.95)], 12);
}

document.addEventListener("DOMContentLoaded", initMap);

var map;
var graphData;
var routesData;
var stationsData;
var adjList;
var pathLayer = null;
var segmentLayers = [];
var transferMarkers = [];
var routeLayers = [];
var stationMarkers = [];
var routesByName = {};
var routeStationPathMap = {};
var routeColors = {};
var activeInputId = null;
var allPathResults = [];
var selectedAltIndex = 0;
var currentQueryStart = "";
var currentQueryEnd = "";
var currentQueryMode = 2;

var GCJ_A = 6378245.0;
var GCJ_EE = 0.00669342162296594323;

function gcj02Lat(lat, lon) {
  if (lon < 72.004 || lon > 137.8347 || lat < 0.8293 || lat > 55.8271) {
    return lat;
  }
  var x = lon - 105.0;
  var y = lat - 35.0;
  var dLat = -100.0 + 2.0 * x + 3.0 * y + 0.2 * y * y + 0.1 * x * y + 0.2 * Math.sqrt(Math.abs(x));
  dLat += ((20.0 * Math.sin(6.0 * x * Math.PI) + 20.0 * Math.sin(2.0 * x * Math.PI)) * 2.0) / 3.0;
  dLat += ((20.0 * Math.sin(y * Math.PI) + 40.0 * Math.sin((y / 3.0) * Math.PI)) * 2.0) / 3.0;
  dLat += ((160.0 * Math.sin((y / 12.0) * Math.PI) + 320.0 * Math.sin((y * Math.PI) / 30.0)) * 2.0) / 3.0;
  var radLat = (lat / 180.0) * Math.PI;
  var magic = Math.sin(radLat);
  magic = 1 - GCJ_EE * magic * magic;
  var sqrtMagic = Math.sqrt(magic);
  dLat = (dLat * 180.0) / (((GCJ_A * (1 - GCJ_EE)) / (magic * sqrtMagic)) * Math.PI);
  return lat + dLat;
}

function gcj02Lon(lat, lon) {
  if (lon < 72.004 || lon > 137.8347 || lat < 0.8293 || lat > 55.8271) {
    return lon;
  }
  var x = lon - 105.0;
  var y = lat - 35.0;
  var dLon = 300.0 + x + 2.0 * y + 0.1 * x * x + 0.1 * x * y + 0.1 * Math.sqrt(Math.abs(x));
  dLon += ((20.0 * Math.sin(6.0 * x * Math.PI) + 20.0 * Math.sin(2.0 * x * Math.PI)) * 2.0) / 3.0;
  dLon += ((20.0 * Math.sin(x * Math.PI) + 40.0 * Math.sin((x / 3.0) * Math.PI)) * 2.0) / 3.0;
  dLon += ((150.0 * Math.sin((x / 12.0) * Math.PI) + 300.0 * Math.sin((x / 30.0) * Math.PI)) * 2.0) / 3.0;
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
  var index = this.heap.length - 1;
  while (index > 0) {
    var parent = Math.floor((index - 1) / 2);
    if (this.heap[parent].cost <= this.heap[index].cost) {
      break;
    }
    var temp = this.heap[parent];
    this.heap[parent] = this.heap[index];
    this.heap[index] = temp;
    index = parent;
  }
};

MinHeap.prototype.extractMin = function () {
  if (this.heap.length === 0) {
    return null;
  }
  var min = this.heap[0];
  var last = this.heap.pop();
  if (this.heap.length > 0) {
    this.heap[0] = last;
    var index = 0;
    while (true) {
      var left = 2 * index + 1;
      var right = 2 * index + 2;
      var smallest = index;
      if (left < this.heap.length && this.heap[left].cost < this.heap[smallest].cost) {
        smallest = left;
      }
      if (right < this.heap.length && this.heap[right].cost < this.heap[smallest].cost) {
        smallest = right;
      }
      if (smallest === index) {
        break;
      }
      var temp = this.heap[smallest];
      this.heap[smallest] = this.heap[index];
      this.heap[index] = temp;
      index = smallest;
    }
  }
  return min;
};

MinHeap.prototype.isEmpty = function () {
  return this.heap.length === 0;
};

function initMap() {
  map = L.map("map").setView([gcj02Lat(34.26, 108.95), gcj02Lon(34.26, 108.95)], 12);
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
    fetch("/api/graph").then(function (response) { return response.json(); }),
    fetch("/api/stations").then(function (response) { return response.json(); }),
    fetch("/api/routes").then(function (response) { return response.json(); }),
  ])
    .then(function (results) {
      graphData = results[0];
      stationsData = results[1].stations;
      routesData = results[2].routes;

      graphData.nodes.forEach(function (node) {
        var originalLat = node.lat;
        node.lat = gcj02Lat(node.lat, node.lon);
        node.lon = gcj02Lon(originalLat, node.lon);
      });

      stationsData.forEach(function (station) {
        var originalLat = station.lat;
        station.lat = gcj02Lat(station.lat, station.lon);
        station.lon = gcj02Lon(originalLat, station.lon);
      });

      routesData.forEach(function (route) {
        route.stations.forEach(function (station) {
          var originalLat = station.lat;
          station.lat = gcj02Lat(station.lat, station.lon);
          station.lon = gcj02Lon(originalLat, station.lon);
        });
        if (route.path) {
          route.path = route.path.map(function (point) {
            return [gcj02Lat(point[0], point[1]), gcj02Lon(point[0], point[1])];
          });
        }
      });

      buildAdjList();
      buildRouteIndex();
      initSearchInputs();
      drawRoutes();
      drawStations();

      if (typeof ScheduleConfig !== "undefined") {
        ScheduleConfig.init({
          onPeriodChange: function () {
            buildAdjList();
            if (typeof ScheduleConfigUI !== "undefined") {
              ScheduleConfigUI.refresh();
            }
          },
        });
      }

      if (typeof ScheduleConfigUI !== "undefined") {
        ScheduleConfigUI.init();
      }
    })
    .catch(function () {
      alert("项目数据加载失败。");
    });
}

function buildAdjList() {
  if (typeof ScheduleConfig !== "undefined") {
    adjList = ScheduleConfig.buildAdjustedAdjList(graphData);
    return;
  }

  adjList = {};
  graphData.nodes.forEach(function (node) {
    adjList[node.id] = [];
  });
  graphData.edges.forEach(function (edge) {
    adjList[edge.from].push({
      to: edge.to,
      weight: edge.weight,
      line: edge.line,
      is_transfer: edge.is_transfer,
    });
  });
}

function buildRouteIndex() {
  routesByName = {};
  routeStationPathMap = {};

  routesData.forEach(function (route) {
    routesByName[route.name] = route;
    routeColors[route.name] = route.color;
    if (!route.path || route.path.length === 0) {
      return;
    }

    var mapping = {};
    route.stations.forEach(function (station) {
      var minDistance = Infinity;
      var minIndex = 0;
      for (var index = 0; index < route.path.length; index++) {
        var point = route.path[index];
        var distance =
          (station.lat - point[0]) * (station.lat - point[0]) +
          (station.lon - point[1]) * (station.lon - point[1]);
        if (distance < minDistance) {
          minDistance = distance;
          minIndex = index;
        }
      }
      mapping[station.name] = minIndex;
    });
    routeStationPathMap[route.name] = mapping;
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
  document.getElementById("start-input").classList.toggle("input-active", inputId === "start-input");
  document.getElementById("end-input").classList.toggle("input-active", inputId === "end-input");
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
      .filter(function (station) {
        return station.name.toLowerCase().indexOf(keyword) !== -1;
      })
      .slice(0, 20);

    if (matches.length === 0) {
      dropdown.classList.remove("show");
      return;
    }

    matches.forEach(function (station) {
      var item = document.createElement("div");
      item.className = "dropdown-item";
      item.textContent = station.name + (station.is_transfer ? " （换乘站）" : "");
      item.onclick = function () {
        input.value = station.name;
        dropdown.classList.remove("show");
      };
      item.ontouchend = function (event) {
        event.preventDefault();
        input.value = station.name;
        dropdown.classList.remove("show");
      };
      dropdown.appendChild(item);
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
    var coords = route.path || route.stations.map(function (station) {
      return [station.lat, station.lon];
    });
    var layer = L.polyline(coords, {
      color: route.color,
      weight: 3,
      opacity: 0.7,
    }).bindTooltip(route.name, { sticky: true }).addTo(map);
    routeLayers.push({
      name: route.name,
      layer: layer,
      originalStyle: { color: route.color, weight: 3, opacity: 0.7 },
    });
  });
}

function drawStations() {
  stationMarkers = [];
  stationsData.forEach(function (station) {
    var radius = station.is_transfer ? 6 : 4;
    var color = station.is_transfer ? "#E67E22" : "#4A90D9";
    var tooltipHtml = '<div class="station-tooltip"><strong>' + escapeHtml(station.name) + "</strong>";
    if (station.is_transfer) {
      tooltipHtml += ' <span class="tooltip-transfer-tag">换乘</span>';
    }
    tooltipHtml += '<div class="tooltip-lines">';
    station.lines.forEach(function (line) {
      tooltipHtml += '<span class="tooltip-line-tag" style="background:' + (routeColors[line] || "#999") + '">' +
        escapeHtml(line) + "</span>";
    });
    tooltipHtml += "</div></div>";

    var marker = L.circleMarker([station.lat, station.lon], {
      radius: radius,
      color: color,
      fillColor: color,
      fillOpacity: 0.8,
      weight: 1.5,
    }).addTo(map);

    var hitArea = L.circleMarker([station.lat, station.lon], {
      radius: window.innerWidth <= 768 ? 20 : 14,
      color: "transparent",
      fillColor: "transparent",
      fillOpacity: 0,
      weight: 0,
      interactive: true,
    }).bindTooltip(tooltipHtml, { className: "station-tooltip-container" }).addTo(map);

    hitArea.on("click", function () {
      if (!activeInputId) {
        return;
      }
      document.getElementById(activeInputId).value = station.name;
      document.getElementById(activeInputId === "start-input" ? "start-dropdown" : "end-dropdown").classList.remove("show");
      setActiveInput(null);
    });

    stationMarkers.push({
      name: station.name,
      lines: station.lines,
      marker: marker,
      originalStyle: {
        radius: radius,
        color: color,
        fillColor: color,
        fillOpacity: 0.8,
        weight: 1.5,
      },
    });
  });
}

function dijkstra(startName, endName, mode) {
  var nodes = graphData.nodes;
  var startNodes = [];
  var endNodes = [];

  nodes.forEach(function (node, index) {
    if (node.station === startName) {
      startNodes.push(index);
    }
    if (node.station === endName) {
      endNodes.push(index);
    }
  });

  if (startNodes.length === 0 || endNodes.length === 0) {
    return {
      path: [], error: " 未找到可用路径"
    };
  }

  var endSet = {};
  endNodes.forEach(function (nodeId) {
    endSet[nodeId] = true;
  });

  var INF = 1e18;
  var dist = new Array(nodes.length).fill(INF);
  var transferCount = new Array(nodes.length).fill(0);
  var visited = new Array(nodes.length).fill(false);
  var prev = new Array(nodes.length).fill(-1);
  var heap = new MinHeap();

  startNodes.forEach(function (nodeId) {
    dist[nodeId] = 0;
    heap.insert({ nodeId: nodeId, cost: 0, totalTime: 0, transfers: 0 });
  });

  var foundNode = -1;

  while (!heap.isEmpty()) {
    var current = heap.extractMin();
    if (!current || visited[current.nodeId]) {
      continue;
    }

    visited[current.nodeId] = true;
    if (endSet[current.nodeId]) {
      foundNode = current.nodeId;
      break;
    }

    var edges = adjList[current.nodeId] || [];
    edges.forEach(function (edge) {
      if (visited[edge.to]) {
        return;
      }

      var newTime = dist[current.nodeId] + edge.weight;
      var newTransfers = transferCount[current.nodeId] + edge.is_transfer;
      var newCost;
      if (mode === 0) {
        newCost = newTime;
      } else if (mode === 1) {
        newCost = newTransfers + newTime * 1e-6;
      } else {
        newCost = newTime * 1000 + newTransfers;
      }

      var oldCost = dist[edge.to] === INF
        ? INF
        : mode === 0
          ? dist[edge.to]
          : mode === 1
            ? transferCount[edge.to] + dist[edge.to] * 1e-6
            : dist[edge.to] * 1000 + transferCount[edge.to];

      if (newCost < oldCost) {
        dist[edge.to] = newTime;
        transferCount[edge.to] = newTransfers;
        prev[edge.to] = current.nodeId;
        heap.insert({
          nodeId: edge.to,
          cost: newCost,
          totalTime: newTime,
          transfers: newTransfers,
        });
      }
    });
  }

  if (foundNode === -1) {
    return {
      path: [], error: " 未找到可用路径"
    };
  }

  var pathIds = [];
  var cursor = foundNode;
  while (cursor !== -1) {
    pathIds.unshift(cursor);
    cursor = prev[cursor];
  }

  var path = pathIds.map(function (nodeId) {
    return {
      station: nodes[nodeId].station,
      line: nodes[nodeId].line,
      lon: nodes[nodeId].lon,
      lat: nodes[nodeId].lat,
    };
  });

  return {
    path: path,
    total_time: dist[foundNode],
    transfers: transferCount[foundNode],
  };
}

function getScheduleConfigPayload() {
  if (typeof ScheduleConfig !== "undefined" && typeof ScheduleConfig.exportState === "function") {
    return ScheduleConfig.exportState();
  }
  return null;
}

function queryPath(mode) {
  var start = document.getElementById("start-input").value.trim();
  var end = document.getElementById("end-input").value.trim();
  if (!start || !end) {
    alert("请输入起点站和终点站");
    return;
  }

  currentQueryStart = start;
  currentQueryEnd = end;
  currentQueryMode = mode;
  document.getElementById("result").className = "hidden";
  disableQueryButtons(true);

  fetch("/api/query", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      start: start,
      end: end,
      mode: mode,
      include_alternatives: true,
      schedule_config: getScheduleConfigPayload(),
    }),
  })
    .then(function (response) { return response.json(); })
    .then(function (payload) {
      disableQueryButtons(false);
      if (payload.error) {
        showError(payload.error);
        return;
      }

      allPathResults = payload.results || [];
      selectedAltIndex = payload.selected_index || 0;
      if (allPathResults.length === 0) {
        showError("未找到可用路径");
        return;
      }

      showResult(allPathResults, currentQueryStart, currentQueryEnd);
      highlightPath(allPathResults, selectedAltIndex);
      renderAlternativeList();
    })
    .catch(function () {
      disableQueryButtons(false);
      showError("查询失败");
    });
}

function disableQueryButtons(disabled) {
  ["btn-combined", "btn-time", "btn-transfer"].forEach(function (id) {
    var button = document.getElementById(id);
    if (button) {
      button.disabled = disabled;
    }
  });
}

function showError(message) {
  var result = document.getElementById("result");
  result.className = "";
  document.getElementById("result-error").style.display = "block";
  document.getElementById("result-error").textContent = message;
  document.getElementById("result-content").style.display = "none";
  var vizButton = document.getElementById("viz-btn");
  if (vizButton) {
    vizButton.style.display = "none";
  }
}

function showResult(results, start, end) {
  var selected = results[selectedAltIndex];
  var data = selected.data;
  var result = document.getElementById("result");
  result.className = "";
  document.getElementById("result-error").style.display = "none";
  document.getElementById("result-content").style.display = "";

  var totalTime = data.total_time + 3;
  var periodInfo = "";
  if (data.current_period) {
    periodInfo = " [" + data.current_period.name + "]";
  }

  document.getElementById("result-time").innerHTML =
    '<span class="result-label-badge">' + escapeHtml(selected.label) + "</span> " +
  totalTime.toFixed(2) + "  分钟" + periodInfo;
  document.getElementById("result-transfers").textContent = "换乘次数 " + data.transfers;

  document.getElementById("result-stations").innerHTML =
    buildSummaryHtml(data, start, end) +
    buildStationHtml(data);

  var vizButton = document.getElementById("viz-btn");
  if (!vizButton) {
    vizButton = document.createElement("button");
    vizButton.id = "viz-btn";
    vizButton.className = "viz-trigger-btn";
    vizButton.textContent = "Dijkstra算法可视化";
    document.getElementById("result-content").appendChild(vizButton);
  }
  vizButton.onclick = function () {
    DijkstraViz.open(currentQueryStart, currentQueryEnd, currentQueryMode, selectedAltIndex);
  };
  vizButton.style.display = "";
}

function buildSummaryHtml(data, start, end) {
  var routeLines = uniqueLines(data.lines_used || []).map(escapeHtml).join("、");
  return (
    '<div class="result-summary-card">' +
    "<strong>" + escapeHtml(data.mode_label || "方案") + "</strong> " +
    escapeHtml(start || currentQueryStart) + " → " + escapeHtml(end || currentQueryEnd) +
    "<br>站点数：" + data.station_count +
    "<br>涉及线路：" + (routeLines || "无") +
    "</div>"
  );
}

function buildItineraryHtml(itinerary) {
  if (!itinerary || itinerary.length === 0) {
    return "";
  }

  var html = '<div class="section-title">乘车方案</div>';
  itinerary.forEach(function (step, index) {
    html += '<div class="itinerary-step">';
    html += '<span class="step-index">' + (index + 1) + "</span>";
    html += '<div class="step-body">';
    if (step.type === "ride") {
      html += '<span class="line-tag" style="background:' + (routeColors[step.line] || "#999") + '">' + escapeHtml(step.line) + "</span> ";
      html += "乘坐<strong>" + escapeHtml(step.from) + "</strong> 至 <strong>" + escapeHtml(step.to) + "</strong>";
      html += " (" + Math.max(step.station_count - 1, 0) + "  站)";
    } else {
      html += "在<strong>" + escapeHtml(step.station) + "</strong> 换乘： ";
      html += escapeHtml(step.from_line) + " -> " + escapeHtml(step.to_line);
    }
    html += "</div></div>";
  });
  return html;
}

function buildStationHtml(data) {
  var transferStations = data.transfer_stations || [];
  var displayPath = [];
  var lastKey = "";

  (data.path || []).forEach(function (node) {
    var key = node.line + "::" + node.station;
    if (key === lastKey) {
      return;
    }
    lastKey = key;
    displayPath.push({
      line: node.line,
      station: node.station,
      isTransfer: transferStations.indexOf(node.station) !== -1,
    });
  });

  var html = '<div class="section-title">路径详情</div>';
  displayPath.forEach(function (node) {
    var stationClass = node.isTransfer ? "station-name station-name-transfer" : "station-name";
    html += '<div class="station-item">';
    html += '<span class="line-tag" style="background:' + (routeColors[node.line] || "#999") + '">' + escapeHtml(node.line) + "</span>";
    html += '<span class="' + stationClass + '">' + escapeHtml(node.station) + "</span>";
    html += "</div>";
  });
  return html;
}

function renderAlternativeList() {
  var container = document.getElementById("alternatives-container");
  if (!container) {
    return;
  }
  if (allPathResults.length <= 1) {
    container.style.display = "none";
    return;
  }

  container.style.display = "";
  document.getElementById("alt-count").textContent = allPathResults.length - 1;
  var html = "";
  for (var index = 1; index < allPathResults.length; index++) {
    var result = allPathResults[index];
    var totalTime = result.data.total_time + 3;
    var activeClass = selectedAltIndex === index ? " alt-item-active" : "";
    html += '<div class="alt-item' + activeClass + '" onclick="selectAlternative(' + index + ')">';
    html += '<div class="alt-item-header">';
    html += '<span class="alt-item-num">' + index + "</span>";
    html += '<span class="alt-item-label">' + escapeHtml(result.label) + "</span>";
    html += '<span class="alt-item-stats">' + totalTime.toFixed(1) + " 分钟/ " + result.data.transfers + " 次换乘</span>";
    html += "</div></div>";
  }
  document.getElementById("alternatives-list").innerHTML = html;
}

function selectAlternative(index) {
  if (index < 0 || index >= allPathResults.length) {
    return;
  }
  selectedAltIndex = index;
  showResult(allPathResults, currentQueryStart, currentQueryEnd);
  highlightPath(allPathResults, index);
  renderAlternativeList();
}

var altSectionExpanded = true;
function toggleAltSection() {
  var list = document.getElementById("alternatives-list");
  var icon = document.getElementById("alt-toggle-icon");
  if (!list || !icon) {
    return;
  }
  altSectionExpanded = !altSectionExpanded;
  list.style.display = altSectionExpanded ? "" : "none";
  icon.textContent = altSectionExpanded ? "▾" : "▸";
}

function highlightPath(results, index) {
  var data = results[index].data;

  if (pathLayer) {
    map.removeLayer(pathLayer);
    pathLayer = null;
  }
  segmentLayers.forEach(function (layer) { map.removeLayer(layer); });
  segmentLayers = [];
  transferMarkers.forEach(function (marker) { map.removeLayer(marker); });
  transferMarkers = [];

  var pathStations = {};
  data.path.forEach(function (node) {
    pathStations[node.station] = true;
  });

  routeLayers.forEach(function (routeLayer) {
    routeLayer.layer.setStyle({ weight: 2, opacity: 0.08 });
  });

  stationMarkers.forEach(function (stationMarker) {
    if (pathStations[stationMarker.name]) {
      stationMarker.marker.setStyle({
        radius: 7,
        fillOpacity: 1,
        weight: 2,
        color: "#333",
      });
    } else {
      stationMarker.marker.setStyle({ fillOpacity: 0.1, opacity: 0.1 });
    }
  });

  var segments = extractPathSegments(data.path);
  var pathSegments = buildPathSegmentLayers(segments, data.path, routesByName, routeStationPathMap, routeColors);
  var allCoords = [];

  pathSegments.forEach(function (segment) {
    var coords = segment.coords || [];
    if (coords.length <= 1) {
      return;
    }
    var layer = L.polyline(coords, {
      color: segment.color,
      weight: 5,
      opacity: 0.9,
    }).addTo(map);
    segmentLayers.push(layer);
    if (allCoords.length > 0) {
      coords = coords.slice(1);
    }
    allCoords = allCoords.concat(coords);
  });

  if (allCoords.length === 0) {
    allCoords = data.path.map(function (node) { return [node.lat, node.lon]; });
  }

  var mainColor = ["#e74c3c", "#e67e22", "#8e44ad", "#2ecc71", "#3498db"][index % 5];
  pathLayer = L.polyline(allCoords, {
    color: mainColor,
    weight: 6,
    opacity: 0.85,
    dashArray: index === 0 ? null : "8 8",
  }).addTo(map);
  map.fitBounds(pathLayer.getBounds(), { padding: [40, 40] });

  data.transfer_stations.forEach(function (stationName) {
    var station = stationsData.find(function (entry) { return entry.name === stationName; });
    if (!station) {
      return;
    }
    var marker = L.marker([station.lat, station.lon], {
      icon: L.divIcon({
        className: "transfer-marker-icon",
        html: '<div style="background:#E67E22;color:#fff;border-radius:50%;width:24px;height:24px;line-height:24px;text-align:center;font-size:12px;border:2px solid #fff;">↺</div>',
        iconSize: [24, 24],
        iconAnchor: [12, 12],
      }),
    }).addTo(map);
    transferMarkers.push(marker);
  });
}

function resetMap() {
  if (pathLayer) {
    map.removeLayer(pathLayer);
    pathLayer = null;
  }
  segmentLayers.forEach(function (layer) { map.removeLayer(layer); });
  segmentLayers = [];
  transferMarkers.forEach(function (marker) { map.removeLayer(marker); });
  transferMarkers = [];

  routeLayers.forEach(function (routeLayer) {
    routeLayer.layer.setStyle(routeLayer.originalStyle);
  });
  stationMarkers.forEach(function (stationMarker) {
    stationMarker.marker.setStyle(stationMarker.originalStyle);
  });
  map.setView([gcj02Lat(34.26, 108.95), gcj02Lon(34.26, 108.95)], 12);
}

function uniqueLines(lines) {
  var seen = {};
  var ordered = [];
  (lines || []).forEach(function (line) {
    if (!seen[line]) {
      seen[line] = true;
      ordered.push(line);
    }
  });
  return ordered;
}

function escapeHtml(text) {
  return String(text)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function initMobileSidebar() {
  var toggleButton = document.getElementById("sidebar-toggle");
  var sidebar = document.getElementById("sidebar");
  var mapElement = document.getElementById("map");
  if (!toggleButton || !sidebar || !mapElement) {
    return;
  }

  toggleButton.addEventListener("click", function () {
    sidebar.classList.toggle("sidebar-open");
    toggleButton.textContent = sidebar.classList.contains("sidebar-open") ? "✕" : "☰";
    setTimeout(function () {
      if (map) {
        map.invalidateSize();
      }
    }, 400);
  });

  mapElement.addEventListener("click", function () {
    if (!sidebar.classList.contains("sidebar-open")) {
      return;
    }
    sidebar.classList.remove("sidebar-open");
    toggleButton.textContent = "☰";
    setTimeout(function () {
      if (map) {
        map.invalidateSize();
      }
    }, 400);
  });

  window.addEventListener("resize", function () {
    if (window.innerWidth > 768) {
      sidebar.classList.remove("sidebar-open");
      toggleButton.textContent = "☰";
    }
    if (map) {
      map.invalidateSize();
    }
  });
}

document.addEventListener("DOMContentLoaded", function () {
  initMap();
  initMobileSidebar();
});

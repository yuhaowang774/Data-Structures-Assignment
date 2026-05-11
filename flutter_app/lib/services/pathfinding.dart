class HeapItem {
  final int nodeId;
  final double cost;
  HeapItem(this.nodeId, this.cost);
}

class MinHeap {
  final List<HeapItem> _heap = [];

  bool get isEmpty => _heap.isEmpty;

  void insert(int nodeId, double cost) {
    _heap.add(HeapItem(nodeId, cost));
    var i = _heap.length - 1;
    while (i > 0) {
      final parent = (i - 1) ~/ 2;
      if (_heap[parent].cost <= _heap[i].cost) break;
      final tmp = _heap[parent];
      _heap[parent] = _heap[i];
      _heap[i] = tmp;
      i = parent;
    }
  }

  HeapItem? extractMin() {
    if (_heap.isEmpty) return null;
    final min = _heap[0];
    final last = _heap.removeLast();
    if (_heap.isNotEmpty) {
      _heap[0] = last;
      var i = 0;
      while (true) {
        final left = 2 * i + 1;
        final right = 2 * i + 2;
        var smallest = i;
        if (left < _heap.length && _heap[left].cost < _heap[smallest].cost) {
          smallest = left;
        }
        if (right < _heap.length && _heap[right].cost < _heap[smallest].cost) {
          smallest = right;
        }
        if (smallest == i) break;
        final tmp = _heap[smallest];
        _heap[smallest] = _heap[i];
        _heap[i] = tmp;
        i = smallest;
      }
    }
    return min;
  }
}

class NodeRef {
  final int id;
  final String station;
  final String line;
  final double lon;
  final double lat;

  NodeRef({
    required this.id,
    required this.station,
    required this.line,
    required this.lon,
    required this.lat,
  });
}

class GraphEdge {
  final int to;
  final double weight;
  final String line;
  final int isTransfer;

  GraphEdge({
    required this.to,
    required this.weight,
    required this.line,
    required this.isTransfer,
  });
}

List<List<GraphEdge>> buildAdjList(List<dynamic> nodes, List<dynamic> edges) {
  final n = nodes.length;
  final adjList = List<List<GraphEdge>>.filled(n, [], growable: true);
  for (var i = 0; i < n; i++) {
    adjList[i] = [];
  }
  for (final e in edges) {
    final map = e as Map<String, dynamic>;
    final from = map['from'] as int;
    adjList[from].add(GraphEdge(
      to: map['to'] as int,
      weight: (map['weight'] as num).toDouble(),
      line: map['line'] as String,
      isTransfer: map['is_transfer'] as int,
    ));
  }
  return adjList;
}

class PathResult {
  final List<NodeRef> path;
  final double totalTime;
  final int transferCount;
  final List<String> transferStations;
  final int stationCount;
  final String? error;

  PathResult({
    required this.path,
    required this.totalTime,
    required this.transferCount,
    required this.transferStations,
    required this.stationCount,
    this.error,
  });
}

PathResult dijkstra(
  List<List<GraphEdge>> adjList,
  List<dynamic> nodes,
  String startName,
  String endName,
  int mode,
) {
  final n = nodes.length;
  final startNodes = <int>[];
  final endNodes = <int>[];

  for (var i = 0; i < n; i++) {
    final node = nodes[i] as Map<String, dynamic>;
    if (node['station'] == startName) startNodes.add(i);
    if (node['station'] == endName) endNodes.add(i);
  }

  if (startNodes.isEmpty || endNodes.isEmpty) {
    return PathResult(
      path: [],
      totalTime: 0,
      transferCount: 0,
      transferStations: [],
      stationCount: 0,
      error: '未找到站点',
    );
  }

  final endSet = <int>{};
  for (final e in endNodes) {
    endSet.add(e);
  }

  const inf = 1e18;
  final dist = List<double>.filled(n, inf);
  final transferArr = List<int>.filled(n, 0);
  final visited = List<bool>.filled(n, false);
  final prev = List<int>.filled(n, -1);

  final heap = MinHeap();

  for (final si in startNodes) {
    dist[si] = 0;
    transferArr[si] = 0;
    heap.insert(si, 0.0);
  }

  var foundNode = -1;

  while (!heap.isEmpty) {
    final cur = heap.extractMin();
    if (cur == null) break;
    if (visited[cur.nodeId]) continue;
    visited[cur.nodeId] = true;

    if (endSet.contains(cur.nodeId)) {
      foundNode = cur.nodeId;
      break;
    }

    for (final edge in adjList[cur.nodeId]) {
      if (visited[edge.to]) continue;

      final newTime = dist[cur.nodeId] + edge.weight;
      final newTransfers = transferArr[cur.nodeId] + edge.isTransfer;

      final newCost = mode == 0
          ? newTime
          : newTransfers.toDouble() + newTime * 1e-6;
      final currentCost = dist[edge.to] == inf
          ? inf
          : mode == 0
              ? dist[edge.to]
              : transferArr[edge.to].toDouble() + dist[edge.to] * 1e-6;

      if (newCost < currentCost) {
        dist[edge.to] = newTime;
        transferArr[edge.to] = newTransfers;
        prev[edge.to] = cur.nodeId;
        heap.insert(edge.to, newCost);
      }
    }
  }

  if (foundNode == -1) {
    return PathResult(
      path: [],
      totalTime: 0,
      transferCount: 0,
      transferStations: [],
      stationCount: 0,
      error: '未找到可达路径',
    );
  }

  final pathIndices = <int>[];
  var cur = foundNode;
  while (cur != -1) {
    pathIndices.insert(0, cur);
    cur = prev[cur];
  }

  final pathResult = pathIndices.map((idx) {
    final node = nodes[idx] as Map<String, dynamic>;
    return NodeRef(
      id: node['id'] as int,
      station: node['station'] as String,
      line: node['line'] as String,
      lon: (node['lon'] as num).toDouble(),
      lat: (node['lat'] as num).toDouble(),
    );
  }).toList();

  final transferStations = <String>[];
  var uniqueCount = 0;
  var lastStation = '';
  for (var i = 0; i < pathResult.length; i++) {
    if (pathResult[i].station != lastStation) {
      uniqueCount++;
      lastStation = pathResult[i].station;
    }
    if (i > 0 && i < pathResult.length - 1) {
      if (pathResult[i].station == pathResult[i - 1].station &&
          pathResult[i].line != pathResult[i - 1].line) {
        transferStations.add(pathResult[i].station);
      }
    }
  }

  return PathResult(
    path: pathResult,
    totalTime: dist[foundNode],
    transferCount: transferArr[foundNode],
    transferStations: transferStations,
    stationCount: uniqueCount,
  );
}

class PathSegment {
  final String fromStation;
  final String toStation;
  final String line;
  final double duration;

  PathSegment({
    required this.fromStation,
    required this.toStation,
    required this.line,
    required this.duration,
  });
}

List<PathSegment> buildSegments(PathResult result) {
  if (result.path.isEmpty) return [];

  final segments = <PathSegment>[];
  var segStart = 0;

  for (var i = 1; i < result.path.length; i++) {
    if (result.path[i].line != result.path[segStart].line) {
      final startNode = result.path[segStart];
      final endNode = result.path[i - 1];
      double duration = 0;
      for (var j = segStart; j < i - 1; j++) {
        duration += (result.path[j + 1].id - result.path[j].id).abs().toDouble();
      }
      segments.add(PathSegment(
        fromStation: startNode.station,
        toStation: endNode.station,
        line: startNode.line,
        duration: duration,
      ));
      segStart = i;
    }
  }

  final startNode = result.path[segStart];
  final endNode = result.path.last;
  double duration = 0;
  for (var j = segStart; j < result.path.length - 1; j++) {
    duration += (result.path[j + 1].id - result.path[j].id).abs().toDouble();
  }
  segments.add(PathSegment(
    fromStation: startNode.station,
    toStation: endNode.station,
    line: startNode.line,
    duration: duration,
  ));

  return segments;
}

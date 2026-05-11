import 'package:flutter_test/flutter_test.dart';
import 'package:flutter_app/services/pathfinding.dart';

void main() {
  group('MinHeap', () {
    test('insert and extractMin returns elements in cost order', () {
      final heap = MinHeap();
      heap.insert(5, 5.0);
      heap.insert(3, 3.0);
      heap.insert(7, 7.0);
      heap.insert(1, 1.0);
      expect(heap.extractMin()!.nodeId, 1);
      expect(heap.extractMin()!.nodeId, 3);
      expect(heap.extractMin()!.nodeId, 5);
      expect(heap.extractMin()!.nodeId, 7);
    });

    test('isEmpty returns true when empty', () {
      final heap = MinHeap();
      expect(heap.isEmpty, true);
    });

    test('isEmpty returns false when not empty', () {
      final heap = MinHeap();
      heap.insert(1, 1.0);
      expect(heap.isEmpty, false);
    });

    test('extractMin on empty heap returns null', () {
      final heap = MinHeap();
      expect(heap.extractMin(), isNull);
    });

    test('handles duplicate costs', () {
      final heap = MinHeap();
      heap.insert(3, 3.0);
      heap.insert(3, 3.0);
      heap.insert(1, 1.0);
      expect(heap.extractMin()!.cost, 1.0);
      expect(heap.extractMin()!.cost, 3.0);
      expect(heap.extractMin()!.cost, 3.0);
    });
  });

  group('buildAdjList', () {
    test('builds adjacency list from nodes and edges', () {
      final nodes = [
        {'id': 0, 'station': 'A', 'line': 'L1', 'lon': 108.0, 'lat': 34.0},
        {'id': 1, 'station': 'B', 'line': 'L1', 'lon': 108.1, 'lat': 34.1},
        {'id': 2, 'station': 'C', 'line': 'L1', 'lon': 108.2, 'lat': 34.2},
      ];
      final edges = [
        {'from': 0, 'to': 1, 'weight': 1.5, 'line': 'L1', 'is_transfer': 0},
        {'from': 1, 'to': 2, 'weight': 2.0, 'line': 'L1', 'is_transfer': 0},
      ];
      final adjList = buildAdjList(nodes, edges);
      expect(adjList.length, 3);
      expect(adjList[0].length, 1);
      expect(adjList[0][0].to, 1);
      expect(adjList[0][0].weight, 1.5);
      expect(adjList[1].length, 1);
      expect(adjList[1][0].to, 2);
    });

    test('handles transfer edges', () {
      final nodes = [
        {'id': 0, 'station': 'A', 'line': 'L1', 'lon': 108.0, 'lat': 34.0},
        {'id': 1, 'station': 'A', 'line': 'L2', 'lon': 108.0, 'lat': 34.0},
      ];
      final edges = [
        {'from': 0, 'to': 1, 'weight': 0.0, 'line': '换乘', 'is_transfer': 1},
      ];
      final adjList = buildAdjList(nodes, edges);
      expect(adjList[0].length, 1);
      expect(adjList[0][0].isTransfer, 1);
      expect(adjList[0][0].weight, 0.0);
    });
  });

  group('dijkstra', () {
    late List<dynamic> nodes;
    late List<List<GraphEdge>> adjList;

    setUp(() {
      nodes = [
        {'id': 0, 'station': 'A', 'line': 'L1', 'lon': 108.0, 'lat': 34.0},
        {'id': 1, 'station': 'B', 'line': 'L1', 'lon': 108.1, 'lat': 34.1},
        {'id': 2, 'station': 'B', 'line': 'L2', 'lon': 108.1, 'lat': 34.1},
        {'id': 3, 'station': 'D', 'line': 'L2', 'lon': 108.3, 'lat': 34.3},
      ];
      final edges = [
        {'from': 0, 'to': 1, 'weight': 2.0, 'line': 'L1', 'is_transfer': 0},
        {'from': 1, 'to': 2, 'weight': 0.0, 'line': '换乘', 'is_transfer': 1},
        {'from': 2, 'to': 3, 'weight': 3.0, 'line': 'L2', 'is_transfer': 0},
        {'from': 0, 'to': 3, 'weight': 20.0, 'line': 'L3', 'is_transfer': 0},
      ];
      adjList = buildAdjList(nodes, edges);
    });

    test('mode 0 finds shortest time path', () {
      final result = dijkstra(adjList, nodes, 'A', 'D', 0);
      expect(result.error, isNull);
      expect(result.totalTime, closeTo(5.0, 0.001));
      expect(result.path.first.station, 'A');
      expect(result.path.last.station, 'D');
    });

    test('mode 1 finds fewest transfers path', () {
      final result = dijkstra(adjList, nodes, 'A', 'D', 1);
      expect(result.error, isNull);
      expect(result.transferCount, 0);
    });

    test('returns error for non-existent station', () {
      final result = dijkstra(adjList, nodes, 'A', '不存在', 0);
      expect(result.error, isNotNull);
      expect(result.path, isEmpty);
    });

    test('returns error for unreachable station', () {
      final isolatedNodes = [
        {'id': 0, 'station': 'A', 'line': 'L1', 'lon': 108.0, 'lat': 34.0},
        {'id': 1, 'station': 'B', 'line': 'L1', 'lon': 108.1, 'lat': 34.1},
      ];
      final List<List<GraphEdge>> isolatedAdj = [[], []];
      final result = dijkstra(isolatedAdj, isolatedNodes, 'A', 'B', 0);
      expect(result.error, isNotNull);
    });

    test('counts transferStations correctly', () {
      final result = dijkstra(adjList, nodes, 'A', 'D', 0);
      expect(result.transferStations, contains('B'));
    });

    test('counts stationCount correctly', () {
      final result = dijkstra(adjList, nodes, 'A', 'D', 0);
      expect(result.stationCount, 3);
    });
  });

  group('buildSegments', () {
    test('splits path by line changes', () {
      final result = PathResult(
        path: [
          NodeRef(id: 0, station: 'A', line: 'L1', lon: 108.0, lat: 34.0),
          NodeRef(id: 1, station: 'B', line: 'L1', lon: 108.1, lat: 34.1),
          NodeRef(id: 2, station: 'B', line: 'L2', lon: 108.1, lat: 34.1),
          NodeRef(id: 3, station: 'C', line: 'L2', lon: 108.2, lat: 34.2),
        ],
        totalTime: 5.0,
        transferCount: 1,
        transferStations: ['B'],
        stationCount: 3,
      );
      final segments = buildSegments(result);
      expect(segments.length, 2);
      expect(segments[0].fromStation, 'A');
      expect(segments[0].toStation, 'B');
      expect(segments[0].line, 'L1');
      expect(segments[1].fromStation, 'B');
      expect(segments[1].toStation, 'C');
      expect(segments[1].line, 'L2');
    });

    test('single line produces one segment', () {
      final result = PathResult(
        path: [
          NodeRef(id: 0, station: 'A', line: 'L1', lon: 108.0, lat: 34.0),
          NodeRef(id: 1, station: 'B', line: 'L1', lon: 108.1, lat: 34.1),
          NodeRef(id: 2, station: 'C', line: 'L1', lon: 108.2, lat: 34.2),
        ],
        totalTime: 5.0,
        transferCount: 0,
        transferStations: [],
        stationCount: 3,
      );
      final segments = buildSegments(result);
      expect(segments.length, 1);
      expect(segments[0].fromStation, 'A');
      expect(segments[0].toStation, 'C');
      expect(segments[0].line, 'L1');
    });

    test('empty path produces no segments', () {
      final result = PathResult(
        path: [],
        totalTime: 0,
        transferCount: 0,
        transferStations: [],
        stationCount: 0,
        error: '未找到路径',
      );
      final segments = buildSegments(result);
      expect(segments, isEmpty);
    });
  });
}

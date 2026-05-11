import 'package:flutter/material.dart' hide Route;
import 'package:latlong2/latlong.dart';
import 'package:flutter_app/models/station.dart';
import 'package:flutter_app/models/route.dart';
import 'package:flutter_app/services/data_loader.dart';
import 'package:flutter_app/services/pathfinding.dart';
import 'package:flutter_app/widgets/map_view.dart';
import 'package:flutter_app/widgets/search_panel.dart';
import 'package:flutter_app/widgets/result_panel.dart';

class HomePage extends StatefulWidget {
  const HomePage({super.key});

  @override
  State<HomePage> createState() => _HomePageState();
}

class _HomePageState extends State<HomePage> {
  final _mapViewKey = GlobalKey<MapViewState>();
  final _sheetController = DraggableScrollableController();

  List<Station>? _stations;
  List<Route>? _routes;
  List<List<GraphEdge>>? _adjList;
  List<dynamic>? _graphNodes;

  PathResult? _result;
  List<PathSegment> _segments = [];

  bool _isLoading = true;
  String? _loadError;

  @override
  void initState() {
    super.initState();
    _loadData();
  }

  Future<void> _loadData() async {
    try {
      final data = await DataLoader.loadData();
      final graph = data['graph'] as Map<String, dynamic>;
      final routes = data['routes'] as Map<String, dynamic>;

      final graphNodes = graph['nodes'] as List<dynamic>;
      final graphEdges = graph['edges'] as List<dynamic>;
      final routesList = routes['routes'] as List<dynamic>;

      final stations = deriveStations(graphNodes);
      final parsedRoutes = parseRoutes(routesList);
      final adjList = buildAdjList(graphNodes, graphEdges);

      setState(() {
        _stations = stations;
        _routes = parsedRoutes;
        _adjList = adjList;
        _graphNodes = graphNodes;
        _isLoading = false;
      });
    } catch (e) {
      setState(() {
        _loadError = '数据加载失败，请重新启动应用';
        _isLoading = false;
      });
    }
  }

  void _onSearch(String start, String end, int mode) {
    if (_adjList == null || _graphNodes == null) return;

    final result = dijkstra(_adjList!, _graphNodes!, start, end, mode);
    final segments = buildSegments(result);

    if (result.error == null) {
      final pathPoints = result.path
          .map((n) => LatLng(n.lat, n.lon))
          .toList();
      final transferPoints = result.transferStations
          .map((name) {
            final station = _stations!.firstWhere((s) => s.name == name);
            return LatLng(station.lat, station.lon);
          })
          .toList();
      _mapViewKey.currentState?.updatePath(pathPoints, transferPoints);
    } else {
      _mapViewKey.currentState?.clearPath();
    }

    setState(() {
      _result = result;
      _segments = segments;
    });

    _sheetController.animateTo(
      0.35,
      duration: const Duration(milliseconds: 300),
      curve: Curves.easeOut,
    );
  }

  @override
  void dispose() {
    _sheetController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    if (_isLoading) {
      return const Scaffold(
        body: Center(child: CircularProgressIndicator()),
      );
    }

    if (_loadError != null) {
      return Scaffold(
        body: Center(
          child: Text(_loadError!, style: const TextStyle(color: Colors.red)),
        ),
      );
    }

    return Scaffold(
      body: Stack(
        children: [
          MapView(
            key: _mapViewKey,
            routes: _routes!,
            stations: _stations!,
          ),
          DraggableScrollableSheet(
            controller: _sheetController,
            initialChildSize: 0.08,
            minChildSize: 0.08,
            maxChildSize: 0.50,
            snap: true,
            snapSizes: const [0.08, 0.35, 0.50],
            builder: (context, scrollController) {
              return Container(
                decoration: const BoxDecoration(
                  color: Colors.white,
                  borderRadius: BorderRadius.vertical(top: Radius.circular(16)),
                  boxShadow: [
                    BoxShadow(
                      color: Colors.black26,
                      blurRadius: 10,
                      offset: Offset(0, -2),
                    ),
                  ],
                ),
                child: ListView(
                  controller: scrollController,
                  padding: EdgeInsets.zero,
                  children: [
                    Center(
                      child: Container(
                        margin: const EdgeInsets.symmetric(vertical: 8),
                        width: 40,
                        height: 4,
                        decoration: BoxDecoration(
                          color: Colors.grey[300],
                          borderRadius: BorderRadius.circular(2),
                        ),
                      ),
                    ),
                    SearchPanel(
                      stations: _stations!,
                      onSearch: _onSearch,
                    ),
                    if (_result != null)
                      ResultPanel(
                        result: _result!,
                        segments: _segments,
                      ),
                  ],
                ),
              );
            },
          ),
        ],
      ),
    );
  }
}

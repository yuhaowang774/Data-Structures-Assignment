import 'dart:convert';
import 'package:flutter/services.dart';
import 'package:flutter_app/models/station.dart';
import 'package:flutter_app/models/route.dart';

List<Station> deriveStations(List<dynamic> graphNodes) {
  final Map<String, List<Map<String, dynamic>>> groups = {};
  for (final node in graphNodes) {
    final n = node as Map<String, dynamic>;
    final name = n['station'] as String;
    groups.putIfAbsent(name, () => []);
    groups[name]!.add(n);
  }

  final List<Station> stations = [];
  for (final entry in groups.entries) {
    final first = entry.value.first;
    final lines = entry.value
        .map((n) => n['line'] as String)
        .toSet()
        .toList();
    stations.add(Station(
      name: entry.key,
      lat: (first['lat'] as num).toDouble(),
      lon: (first['lon'] as num).toDouble(),
      lines: lines,
      isTransfer: lines.length > 1,
    ));
  }
  return stations;
}

List<Route> parseRoutes(List<dynamic> routesData) {
  return routesData.map((r) {
    final map = r as Map<String, dynamic>;
    final stations = (map['stations'] as List<dynamic>).map((s) {
      final sm = s as Map<String, dynamic>;
      return RoutePoint(
        name: sm['name'] as String,
        lat: (sm['lat'] as num).toDouble(),
        lon: (sm['lon'] as num).toDouble(),
      );
    }).toList();
    return Route(
      name: map['name'] as String,
      color: map['color'] as String,
      stations: stations,
    );
  }).toList();
}

class DataLoader {
  static Future<Map<String, dynamic>> loadData() async {
    final graphStr = await rootBundle.loadString('assets/data/graph.json');
    final routesStr = await rootBundle.loadString('assets/data/routes.json');
    return {
      'graph': json.decode(graphStr),
      'routes': json.decode(routesStr),
    };
  }
}

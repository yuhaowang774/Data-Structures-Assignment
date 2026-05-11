import 'package:flutter_test/flutter_test.dart';
import 'package:flutter_app/services/data_loader.dart';

void main() {
  group('deriveStations', () {
    test('deduplicates nodes by station name', () {
      final nodes = [
        {'id': 0, 'station': '北大街', 'line': '地铁1号线', 'lon': 108.95, 'lat': 34.27},
        {'id': 1, 'station': '北大街', 'line': '地铁2号线', 'lon': 108.951, 'lat': 34.271},
        {'id': 2, 'station': '纺织城', 'line': '地铁1号线', 'lon': 109.078, 'lat': 34.273},
      ];
      final stations = deriveStations(nodes);
      expect(stations.length, 2);
    });

    test('takes first node coordinates in group', () {
      final nodes = [
        {'id': 0, 'station': '北大街', 'line': '地铁1号线', 'lon': 108.95, 'lat': 34.27},
        {'id': 1, 'station': '北大街', 'line': '地铁2号线', 'lon': 108.951, 'lat': 34.271},
      ];
      final stations = deriveStations(nodes);
      expect(stations[0].lon, 108.95);
      expect(stations[0].lat, 34.27);
    });

    test('collects all lines and marks transfer', () {
      final nodes = [
        {'id': 0, 'station': '北大街', 'line': '地铁1号线', 'lon': 108.95, 'lat': 34.27},
        {'id': 1, 'station': '北大街', 'line': '地铁2号线', 'lon': 108.951, 'lat': 34.271},
        {'id': 2, 'station': '纺织城', 'line': '地铁1号线', 'lon': 109.078, 'lat': 34.273},
      ];
      final stations = deriveStations(nodes);
      final beiDaJie = stations.firstWhere((s) => s.name == '北大街');
      expect(beiDaJie.lines, ['地铁1号线', '地铁2号线']);
      expect(beiDaJie.isTransfer, true);

      final fangZhiCheng = stations.firstWhere((s) => s.name == '纺织城');
      expect(fangZhiCheng.lines, ['地铁1号线']);
      expect(fangZhiCheng.isTransfer, false);
    });

    test('returns empty list for empty input', () {
      final stations = deriveStations([]);
      expect(stations, isEmpty);
    });
  });

  group('parseRoutes', () {
    test('parses route list from JSON', () {
      final routesData = [
        {
          'name': '地铁1号线',
          'color': '#0079C2',
          'stations': [
            {'name': '纺织城', 'lat': 34.273, 'lon': 109.078},
            {'name': '半坡', 'lat': 34.268, 'lon': 109.062},
          ],
        },
      ];
      final routes = parseRoutes(routesData);
      expect(routes.length, 1);
      expect(routes[0].name, '地铁1号线');
      expect(routes[0].color, '#0079C2');
      expect(routes[0].stations.length, 2);
      expect(routes[0].stations[0].name, '纺织城');
    });

    test('returns empty list for empty input', () {
      final routes = parseRoutes([]);
      expect(routes, isEmpty);
    });
  });
}

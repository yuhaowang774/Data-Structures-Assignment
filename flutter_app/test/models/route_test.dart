import 'package:flutter_test/flutter_test.dart';
import 'package:flutter_app/models/route.dart';

void main() {
  group('RoutePoint', () {
    test('creates from constructor', () {
      final point = RoutePoint(name: '纺织城', lat: 34.273, lon: 109.078);
      expect(point.name, '纺织城');
      expect(point.lat, 34.273);
      expect(point.lon, 109.078);
    });
  });

  group('Route', () {
    test('creates from constructor', () {
      final route = Route(
        name: '地铁1号线',
        color: '#0079C2',
        stations: [
          RoutePoint(name: '纺织城', lat: 34.273, lon: 109.078),
          RoutePoint(name: '半坡', lat: 34.268, lon: 109.062),
        ],
      );
      expect(route.name, '地铁1号线');
      expect(route.color, '#0079C2');
      expect(route.stations.length, 2);
      expect(route.stations[0].name, '纺织城');
    });
  });
}

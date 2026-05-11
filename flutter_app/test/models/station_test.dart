import 'package:flutter_test/flutter_test.dart';
import 'package:flutter_app/models/station.dart';

void main() {
  group('Station', () {
    test('creates from constructor', () {
      final station = Station(
        name: '北大街',
        lat: 34.27,
        lon: 108.95,
        lines: ['地铁1号线', '地铁2号线'],
        isTransfer: true,
      );
      expect(station.name, '北大街');
      expect(station.lat, 34.27);
      expect(station.lon, 108.95);
      expect(station.lines, ['地铁1号线', '地铁2号线']);
      expect(station.isTransfer, true);
    });

    test('isTransfer is false when only one line', () {
      final station = Station(
        name: '纺织城',
        lat: 34.273,
        lon: 109.078,
        lines: ['地铁1号线'],
        isTransfer: false,
      );
      expect(station.isTransfer, false);
    });
  });
}

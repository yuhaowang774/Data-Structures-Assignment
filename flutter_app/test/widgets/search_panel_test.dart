import 'package:flutter_test/flutter_test.dart';
import 'package:flutter_app/models/station.dart';

void main() {
  group('Station filter logic', () {
    late List<Station> stations;

    setUp(() {
      stations = [
        Station(name: '北大街', lat: 34.27, lon: 108.95, lines: ['地铁1号线', '地铁2号线'], isTransfer: true),
        Station(name: '北客站', lat: 34.38, lon: 108.96, lines: ['地铁2号线'], isTransfer: false),
        Station(name: '北池头', lat: 34.23, lon: 108.98, lines: ['地铁3号线'], isTransfer: false),
        Station(name: '纺织城', lat: 34.273, lon: 109.078, lines: ['地铁1号线'], isTransfer: false),
      ];
    });

    test('filters stations by substring match', () {
      final result = stations.where((s) => s.name.contains('北')).toList();
      expect(result.length, 3);
    });

    test('empty input returns no results when filtered', () {
      final result = stations.where((s) => s.name.contains('不存在')).toList();
      expect(result, isEmpty);
    });

    test('limits results to 8', () {
      final manyStations = List.generate(
        20,
        (i) => Station(name: '站$i', lat: 34.0, lon: 108.0, lines: ['L1'], isTransfer: false),
      );
      final result = manyStations.where((s) => s.name.contains('站')).take(8).toList();
      expect(result.length, 8);
    });

    test('no match returns empty', () {
      final result = stations.where((s) => s.name.contains('不存在')).toList();
      expect(result, isEmpty);
    });
  });
}

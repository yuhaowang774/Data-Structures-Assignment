import 'package:flutter/material.dart' hide Route;
import 'package:flutter_map/flutter_map.dart';
import 'package:latlong2/latlong.dart';
import 'package:flutter_app/models/route.dart';
import 'package:flutter_app/models/station.dart';
import 'package:flutter_app/services/coord_transform.dart';

class MapView extends StatefulWidget {
  final List<Route> routes;
  final List<Station> stations;

  const MapView({
    super.key,
    required this.routes,
    required this.stations,
  });

  @override
  State<MapView> createState() => MapViewState();
}

class MapViewState extends State<MapView> {
  final MapController _mapController = MapController();
  List<Polyline> _queryPolylines = [];
  List<CircleMarker> _queryMarkers = [];

  void updatePath(List<LatLng> pathPoints, List<LatLng> transferPoints) {
    setState(() {
      _queryPolylines = [
        Polyline(
          points: pathPoints,
          color: Colors.red,
          strokeWidth: 5.0,
          pattern: StrokePattern.dashed(segments: [8, 8]),
        ),
      ];
      _queryMarkers = transferPoints
          .map((p) => CircleMarker(
                point: p,
                radius: 8,
                color: Colors.orange,
                borderColor: Colors.white,
                borderStrokeWidth: 2,
              ))
          .toList();
    });
    if (pathPoints.isNotEmpty) {
      _mapController.fitCamera(
        CameraFit.bounds(
          bounds: LatLngBounds.fromPoints(pathPoints),
          padding: EdgeInsets.all(40),
        ),
      );
    }
  }

  void clearPath() {
    setState(() {
      _queryPolylines = [];
      _queryMarkers = [];
    });
  }

  @override
  Widget build(BuildContext context) {
    final routePolylines = widget.routes.map((route) {
      final points = route.stations.map((s) {
        final gcj = wgs84ToGcj02(s.lat, s.lon);
        return LatLng(gcj.lat, gcj.lon);
      }).toList();
      return Polyline(
        points: points,
        color: _parseColor(route.color),
        strokeWidth: 3.0,
      );
    }).toList();

    final stationCircles = widget.stations.map((s) {
      final gcj = wgs84ToGcj02(s.lat, s.lon);
      return CircleMarker(
        point: LatLng(gcj.lat, gcj.lon),
        radius: s.isTransfer ? 6 : 4,
        color: s.isTransfer ? const Color(0xFFE67E22) : const Color(0xFF4A90D9),
        borderColor: Colors.white,
        borderStrokeWidth: 1.5,
      );
    }).toList();

    return FlutterMap(
      mapController: _mapController,
      options: MapOptions(
        initialCenter: () {
          final c = wgs84ToGcj02(34.261, 108.942);
          return LatLng(c.lat, c.lon);
        }(),
        initialZoom: 12.0,
        minZoom: 10.0,
        maxZoom: 18.0,
      ),
      children: [
        TileLayer(
          urlTemplate: 'http://{s}.is.autonavi.com/appmaptile?x={x}&y={y}&z={z}&style=8',
          subdomains: ['wprd01', 'wprd02', 'wprd03', 'wprd04'],
          userAgentPackageName: 'com.example.flutter_app',
        ),
        PolylineLayer(
          polylines: [...routePolylines, ..._queryPolylines],
        ),
        CircleLayer(
          circles: [...stationCircles, ..._queryMarkers],
        ),
      ],
    );
  }

  Color _parseColor(String hex) {
    final code = hex.replaceAll('#', '');
    return Color(int.parse('FF$code', radix: 16));
  }
}

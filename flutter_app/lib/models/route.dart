class RoutePoint {
  final String name;
  final double lat;
  final double lon;

  RoutePoint({
    required this.name,
    required this.lat,
    required this.lon,
  });
}

class Route {
  final String name;
  final String color;
  final List<RoutePoint> stations;

  Route({
    required this.name,
    required this.color,
    required this.stations,
  });
}

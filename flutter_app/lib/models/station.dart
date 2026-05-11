class Station {
  final String name;
  final double lat;
  final double lon;
  final List<String> lines;
  final bool isTransfer;

  Station({
    required this.name,
    required this.lat,
    required this.lon,
    required this.lines,
    required this.isTransfer,
  });
}

import 'package:flutter/material.dart';
import 'package:flutter_app/services/pathfinding.dart';

class ResultPanel extends StatelessWidget {
  final PathResult result;
  final List<PathSegment> segments;

  const ResultPanel({
    super.key,
    required this.result,
    required this.segments,
  });

  @override
  Widget build(BuildContext context) {
    if (result.error != null) {
      return Padding(
        padding: const EdgeInsets.all(16),
        child: Text(
          result.error!,
          style: const TextStyle(color: Color(0xFFE74C3C), fontSize: 14),
          textAlign: TextAlign.center,
        ),
      );
    }

    final totalTime = (result.totalTime + 3).toStringAsFixed(2);

    return Padding(
      padding: const EdgeInsets.all(16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        mainAxisSize: MainAxisSize.min,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text(
                '总时间: $totalTime 分钟（含等车3分钟）',
                style: const TextStyle(fontSize: 14, fontWeight: FontWeight.bold),
              ),
              Text(
                '换乘: ${result.transferCount} 次',
                style: const TextStyle(fontSize: 14, fontWeight: FontWeight.bold),
              ),
            ],
          ),
          const SizedBox(height: 10),
          Container(
            padding: const EdgeInsets.all(12),
            decoration: BoxDecoration(
              border: Border.all(color: Color(0xFFE0E0E0)),
              borderRadius: BorderRadius.circular(4),
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: segments.map((seg) {
                final isTransfer = result.transferStations.contains(seg.fromStation);
                return Padding(
                  padding: const EdgeInsets.only(bottom: 4),
                  child: Row(
                    children: [
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 1),
                        decoration: BoxDecoration(
                          color: const Color(0xFF4A90D9),
                          borderRadius: BorderRadius.circular(3),
                        ),
                        child: Text(
                          seg.line,
                          style: const TextStyle(color: Colors.white, fontSize: 11),
                        ),
                      ),
                      const SizedBox(width: 4),
                      Text(
                        '${seg.fromStation} → ${seg.toStation}',
                        style: TextStyle(
                          fontSize: 13,
                          fontWeight: isTransfer ? FontWeight.bold : FontWeight.normal,
                          color: isTransfer ? const Color(0xFFE67E22) : Colors.black,
                        ),
                      ),
                      if (isTransfer) ...[
                        const SizedBox(width: 4),
                        const Text(
                          '← 换乘',
                          style: TextStyle(
                            color: Color(0xFFE67E22),
                            fontWeight: FontWeight.bold,
                            fontSize: 13,
                          ),
                        ),
                      ],
                    ],
                  ),
                );
              }).toList(),
            ),
          ),
        ],
      ),
    );
  }
}

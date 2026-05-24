var fs = require('fs');
var path = require('path');

var resultsPath = process.argv[2];
if (!resultsPath) {
  console.error('Usage: node generate-report.js <results.json>');
  process.exit(1);
}

var results = JSON.parse(fs.readFileSync(resultsPath, 'utf-8'));

var lines = [];
lines.push('# 西安地铁导航对比结果 — 全部案例');
lines.push('');
lines.push('> 运行时间: ' + (results[0] && results[0].id ? '2026-05-20' : 'N/A'));
lines.push('> 有效对比: ' + results.filter(function(r) { return r.comparison && r.comparison.local_ok && r.comparison.amap_ok; }).length + ' / ' + results.length + ' 组');
lines.push('');
lines.push('---');
lines.push('');

results.forEach(function(r) {
  var c = r.comparison;
  var local = r.local;
  var amap = r.amap;

  lines.push('## ' + r.id + ' ' + r.origin + ' → ' + r.dest + ' (' + (r.type === 'manual' ? '手工' : '随机') + ')');
  lines.push('');

  if (!c) {
    lines.push('> 对比数据缺失');
    lines.push('');
    return;
  }

  if (c.local_error && c.amap_error) {
    lines.push('> 本地错误: ' + c.local_error);
    lines.push('> 高德错误: ' + c.amap_error);
    lines.push('');
    return;
  }

  lines.push('| 指标 | 本地系统 | 高德地图 | 差异 |');
  lines.push('|------|---------|---------|------|');

  if (c.local_ok && c.amap_ok) {
    lines.push('| 总耗时(min) | ' + c.local_time_min.toFixed(2) + ' | ' + c.amap_time_min.toFixed(2) + ' | ' + c.time_diff_min.toFixed(2) + ' (' + c.time_diff_pct.toFixed(1) + '%) |');
    lines.push('| 换乘次数 | ' + c.local_transfers + ' | ' + c.amap_transfers + ' | ' + (c.transfer_diff > 0 ? '+' : '') + c.transfer_diff + ' |');
    lines.push('| 途经站数 | ' + c.local_station_count + ' | ' + c.amap_station_count + ' | ' + (c.station_diff > 0 ? '+' : '') + c.station_diff + ' |');
    lines.push('| 步行距离(m) | 0 | ' + c.amap_walking_m + ' | -' + c.amap_walking_m + ' |');
    lines.push('| Jaccard一致率 | - | - | ' + c.jaccard.toFixed(4) + ' |');
    lines.push('| 线路一致 | - | - | ' + (c.line_comparison && c.line_comparison.lines_match ? '✓ 是' : '✗ 否') + ' |');
  } else if (c.local_ok) {
    lines.push('| 总耗时(min) | ' + c.local_time_min.toFixed(2) + ' | N/A | - |');
    lines.push('| 换乘次数 | ' + c.local_transfers + ' | N/A | - |');
    lines.push('| 途经站数 | ' + c.local_station_count + ' | N/A | - |');
    lines.push('| 高德错误 | - | ' + (c.amap_error || '未知') + ' | - |');
  } else if (c.amap_ok) {
    lines.push('| 总耗时(min) | N/A | ' + c.amap_time_min.toFixed(2) + ' | - |');
    lines.push('| 换乘次数 | N/A | ' + c.amap_transfers + ' | - |');
    lines.push('| 本地错误 | ' + (c.local_error || '未知') + ' | - | - |');
  }

  lines.push('');

  if (local && !local.error && local.segments) {
    lines.push('**本地路线:**');
    lines.push('');
    local.segments.forEach(function(seg) {
      lines.push('- **' + seg.line + '**: ' + seg.from + ' → ' + seg.to + ' (' + seg.stations.length + '站)');
      if (seg.stations.length <= 10) {
        lines.push('  - ' + seg.stations.join(' → '));
      } else {
        lines.push('  - ' + seg.stations.slice(0, 5).join(' → ') + ' → ... → ' + seg.stations.slice(-3).join(' → '));
      }
    });
    if (local.transfer_stations && local.transfer_stations.length > 0) {
      lines.push('- 换乘站: ' + local.transfer_stations.join('、'));
    }
    lines.push('');
  }

  if (amap && !amap.error && amap.schemes && amap.schemes.length > 0) {
    var scheme = amap.schemes[0];
    lines.push('**高德路线:**');
    lines.push('');
    if (scheme.metro_segments && scheme.metro_segments.length > 0) {
      scheme.metro_segments.forEach(function(seg) {
        var viaCount = seg.via_stops ? seg.via_stops.length : 0;
        lines.push('- **' + seg.line_short + '**: ' + seg.departure_stop + ' → ' + seg.arrival_stop + ' (' + (viaCount + 2) + '站)');
        var allStops = [seg.departure_stop].concat(seg.via_stops || [], [seg.arrival_stop]);
        if (allStops.length <= 10) {
          lines.push('  - ' + allStops.join(' → '));
        } else {
          lines.push('  - ' + allStops.slice(0, 5).join(' → ') + ' → ... → ' + allStops.slice(-3).join(' → '));
        }
      });
      if (scheme.transfer_stations && scheme.transfer_stations.length > 0) {
        lines.push('- 换乘站: ' + scheme.transfer_stations.join('、'));
      }
    } else {
      lines.push('- 无纯地铁方案');
    }
    if (scheme.has_non_metro) {
      lines.push('- ⚠ 含非地铁段（公交/步行）');
    }
    lines.push('');
  }

  if (c && c.local_ok && c.amap_ok && c.transfer_comparison) {
    var tc = c.transfer_comparison;
    if (tc.local_only.length > 0 || tc.amap_only.length > 0) {
      lines.push('**换乘站差异:**');
      if (tc.common.length > 0) lines.push('- 共同换乘: ' + tc.common.join('、'));
      if (tc.local_only.length > 0) lines.push('- 仅本地: ' + tc.local_only.join('、'));
      if (tc.amap_only.length > 0) lines.push('- 仅高德: ' + tc.amap_only.join('、'));
      lines.push('');
    }
  }

  lines.push('---');
  lines.push('');
});

var outPath = path.join(path.dirname(resultsPath), 'full-report.md');
fs.writeFileSync(outPath, lines.join('\n'), 'utf-8');
console.log('Report written to: ' + outPath);

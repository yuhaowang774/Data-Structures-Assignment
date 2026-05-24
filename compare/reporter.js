var fs = require('fs');
var path = require('path');

function getTimestamp() {
  var d = new Date();
  return d.getFullYear() +
    String(d.getMonth() + 1).padStart(2, '0') +
    String(d.getDate()).padStart(2, '0') + '_' +
    String(d.getHours()).padStart(2, '0') +
    String(d.getMinutes()).padStart(2, '0');
}

function buildRawResults(testCases, localResults, amapResults, compareResults) {
  var results = [];
  for (var i = 0; i < testCases.length; i++) {
    var entry = {
      id: testCases[i].id,
      type: testCases[i].type,
      origin: testCases[i].origin,
      dest: testCases[i].dest,
      origin_coord: testCases[i].originCoord,
      dest_coord: testCases[i].destCoord,
      local: localResults[i] ? (localResults[i].error ? { error: localResults[i].error } : {
        total_time: localResults[i].total_time,
        total_time_with_wait: localResults[i].total_time + 3,
        transfers: localResults[i].transfers,
        transfer_stations: localResults[i].transfer_stations,
        station_count: localResults[i].station_count,
        segments: localResults[i].segments,
        path: localResults[i].path.map(function (p) { return { station: p.station, line: p.line }; }),
      }) : null,
      amap: amapResults[i] ? (amapResults[i].error ? { error: amapResults[i].error } : {
        schemes: amapResults[i].schemes ? amapResults[i].schemes.map(function (s) {
          return {
            duration_sec: s.duration_sec,
            walking_distance_m: s.walking_distance_m,
            metro_transfers: s.metro_transfers,
            transfer_stations: s.transfer_stations,
            metro_segments: s.metro_segments.map(function (ms) {
              return {
                line_name: ms.line_name,
                line_short: ms.line_short,
                departure_stop: ms.departure_stop,
                arrival_stop: ms.arrival_stop,
                via_stops: ms.via_stops,
                duration_sec: ms.duration_sec,
              };
            }),
            has_non_metro: s.has_non_metro,
          };
        }) : null,
      }) : null,
      comparison: compareResults[i] || null,
    };
    results.push(entry);
  }
  return results;
}

function buildSummaryCsv(compareResults, testCases) {
  var header = 'id,type,origin,dest,local_time_min,amap_time_min,time_diff_min,time_diff_pct,local_transfers,amap_transfers,transfer_diff,local_stations,amap_stations,station_diff,walking_m,jaccard,lines_match';
  var rows = [header];

  for (var i = 0; i < compareResults.length; i++) {
    var c = compareResults[i];
    var tc = testCases[i];
    var row = [
      tc.id,
      tc.type,
      tc.origin,
      tc.dest,
      c.local_ok ? (c.local_time_min || '').toFixed(2) : 'N/A',
      c.amap_ok ? (c.amap_time_min || '').toFixed(2) : 'N/A',
      (c.time_diff_min !== undefined) ? c.time_diff_min.toFixed(2) : 'N/A',
      (c.time_diff_pct !== undefined) ? c.time_diff_pct.toFixed(1) : 'N/A',
      c.local_ok ? c.local_transfers : 'N/A',
      c.amap_ok ? c.amap_transfers : 'N/A',
      (c.transfer_diff !== undefined) ? c.transfer_diff : 'N/A',
      c.local_ok ? c.local_station_count : 'N/A',
      c.amap_ok ? c.amap_station_count : 'N/A',
      (c.station_diff !== undefined) ? c.station_diff : 'N/A',
      c.amap_ok ? c.amap_walking_m : 'N/A',
      (c.jaccard !== undefined) ? c.jaccard.toFixed(4) : 'N/A',
      c.line_comparison ? c.line_comparison.lines_match : 'N/A',
    ];
    rows.push(row.join(','));
  }
  return rows.join('\n');
}

function buildStats(compareResults) {
  var validResults = compareResults.filter(function (c) {
    return c.local_ok && c.amap_ok;
  });

  if (validResults.length === 0) {
    return { valid_count: 0, message: 'No valid comparison results' };
  }

  var timeDiffs = validResults.map(function (c) { return c.time_diff_min; });
  var timeDiffPcts = validResults.map(function (c) { return c.time_diff_pct; });
  var jaccards = validResults.map(function (c) { return c.jaccard; });
  var transferDiffs = validResults.map(function (c) { return c.transfer_diff; });

  var avgTimeDiff = timeDiffs.reduce(function (a, b) { return a + b; }, 0) / timeDiffs.length;
  var avgTimeDiffPct = timeDiffPcts.reduce(function (a, b) { return a + b; }, 0) / timeDiffPcts.length;
  var avgJaccard = jaccards.reduce(function (a, b) { return a + b; }, 0) / jaccards.length;

  var sortedJaccard = jaccards.slice().sort(function (a, b) { return a - b; });
  var medianJaccard = sortedJaccard[Math.floor(sortedJaccard.length / 2)];

  var sortedTimeDiff = timeDiffs.slice().sort(function (a, b) { return Math.abs(a) - Math.abs(b); });
  var maxDeviationCases = sortedTimeDiff.slice(-5).reverse();

  var localOnlyNoPath = compareResults.filter(function (c) {
    return !c.local_ok && c.amap_ok;
  }).map(function (c, i) {
    var idx = compareResults.indexOf(c);
    return idx;
  });

  var amapOnlyNoPath = compareResults.filter(function (c) {
    return c.local_ok && !c.amap_ok;
  }).map(function (c, i) {
    var idx = compareResults.indexOf(c);
    return idx;
  });

  var linesMatchCount = validResults.filter(function (c) {
    return c.line_comparison && c.line_comparison.lines_match;
  }).length;

  var transferSameCount = validResults.filter(function (c) {
    return c.transfer_diff === 0;
  }).length;

  return {
    total_cases: compareResults.length,
    valid_count: validResults.length,
    local_no_path_count: compareResults.filter(function (c) { return !c.local_ok; }).length,
    amap_no_path_count: compareResults.filter(function (c) { return !c.amap_ok; }).length,
    time_diff: {
      avg_min: Math.round(avgTimeDiff * 100) / 100,
      avg_pct: Math.round(avgTimeDiffPct * 10) / 10,
      local_faster_count: timeDiffs.filter(function (d) { return d < 0; }).length,
      amap_faster_count: timeDiffs.filter(function (d) { return d > 0; }).length,
      equal_count: timeDiffs.filter(function (d) { return Math.abs(d) < 0.01; }).length,
    },
    jaccard: {
      avg: Math.round(avgJaccard * 10000) / 10000,
      median: Math.round(medianJaccard * 10000) / 10000,
      min: Math.round(sortedJaccard[0] * 10000) / 10000,
      max: Math.round(sortedJaccard[sortedJaccard.length - 1] * 10000) / 10000,
    },
    transfer: {
      same_count: transferSameCount,
      same_pct: Math.round(transferSameCount / validResults.length * 1000) / 10,
    },
    lines: {
      match_count: linesMatchCount,
      match_pct: Math.round(linesMatchCount / validResults.length * 1000) / 10,
    },
  };
}

function Reporter(outputDir) {
  this.outputDir = outputDir;
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }
}

Reporter.prototype.write = function (testCases, localResults, amapResults, compareResults) {
  var ts = getTimestamp();

  var rawResults = buildRawResults(testCases, localResults, amapResults, compareResults);
  var rawPath = path.join(this.outputDir, 'results_' + ts + '.json');
  fs.writeFileSync(rawPath, JSON.stringify(rawResults, null, 2), 'utf-8');

  var csv = buildSummaryCsv(compareResults, testCases);
  var csvPath = path.join(this.outputDir, 'summary_' + ts + '.csv');
  fs.writeFileSync(csvPath, '\uFEFF' + csv, 'utf-8');

  var stats = buildStats(compareResults);
  stats.timestamp = ts;
  var statsPath = path.join(this.outputDir, 'stats_' + ts + '.json');
  fs.writeFileSync(statsPath, JSON.stringify(stats, null, 2), 'utf-8');

  return { rawPath: rawPath, csvPath: csvPath, statsPath: statsPath, stats: stats };
};

module.exports = Reporter;

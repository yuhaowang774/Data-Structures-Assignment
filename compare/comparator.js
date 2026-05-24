function getLocalStationSet(localResult) {
  var set = {};
  for (var i = 0; i < localResult.path.length; i++) {
    if (i === 0 || localResult.path[i].station !== localResult.path[i - 1].station) {
      set[localResult.path[i].station] = true;
    }
  }
  return set;
}

function getAmapStationSet(amapScheme) {
  var set = {};
  for (var i = 0; i < amapScheme.metro_segments.length; i++) {
    var seg = amapScheme.metro_segments[i];
    var stops = seg.all_stops || [seg.departure_stop].concat(seg.via_stops || [], [seg.arrival_stop]);
    for (var j = 0; j < stops.length; j++) {
      set[stops[j]] = true;
    }
  }
  return set;
}

function jaccardIndex(setA, setB) {
  var keysA = Object.keys(setA);
  var keysB = Object.keys(setB);
  var intersection = 0;
  for (var i = 0; i < keysA.length; i++) {
    if (setB[keysA[i]]) intersection++;
  }
  var union = keysA.length + keysB.length - intersection;
  if (union === 0) return 1.0;
  return intersection / union;
}

function compareTransferStations(localTransfers, amapTransfers) {
  var localSet = {};
  for (var i = 0; i < localTransfers.length; i++) {
    localSet[localTransfers[i]] = true;
  }
  var amapSet = {};
  for (var i = 0; i < amapTransfers.length; i++) {
    amapSet[amapTransfers[i]] = true;
  }

  var common = [];
  var localOnly = [];
  var amapOnly = [];

  var allKeys = {};
  for (var k in localSet) allKeys[k] = true;
  for (var k in amapSet) allKeys[k] = true;

  for (var k in allKeys) {
    if (localSet[k] && amapSet[k]) common.push(k);
    else if (localSet[k]) localOnly.push(k);
    else amapOnly.push(k);
  }

  return { common: common, local_only: localOnly, amap_only: amapOnly };
}

function compareSegmentLines(localSegments, amapSegments) {
  var localLines = localSegments.map(function (s) { return s.line; });
  var amapLines = amapSegments.map(function (s) { return s.line_short; });
  return { local_lines: localLines, amap_lines: amapLines, lines_match: JSON.stringify(localLines) === JSON.stringify(amapLines) };
}

function compare(localResult, amapResult, config) {
  if (localResult.error && amapResult.error) {
    return { error: 'Both failed', local_error: localResult.error, amap_error: amapResult.error };
  }

  var amapScheme = null;
  if (!amapResult.error && amapResult.schemes && amapResult.schemes.length > 0) {
    amapScheme = amapResult.schemes[0];
  }

  var result = {
    local_ok: !localResult.error,
    amap_ok: !!amapScheme,
  };

  if (localResult.error) {
    result.local_error = localResult.error;
  }
  if (amapResult.error) {
    result.amap_error = amapResult.error;
  }

  if (!result.local_ok && !result.amap_ok) return result;

  if (result.local_ok) {
    result.local_time_min = localResult.total_time + (config.WAIT_TIME_MIN || 3);
    result.local_base_time_min = localResult.total_time;
    result.local_transfers = localResult.transfers;
    result.local_station_count = localResult.station_count;
    result.local_segments = localResult.segments;
    result.local_transfer_stations = localResult.transfer_stations;
    result.local_station_set = getLocalStationSet(localResult);
  }

  if (result.amap_ok) {
    result.amap_time_min = amapScheme.duration_sec / 60;
    result.amap_walking_m = amapScheme.walking_distance_m;
    result.amap_transfers = amapScheme.metro_transfers;
    result.amap_transfer_stations = amapScheme.transfer_stations;
    result.amap_metro_segments = amapScheme.metro_segments;
    result.amap_has_non_metro = amapScheme.has_non_metro;
    result.amap_station_set = getAmapStationSet(amapScheme);

    var amapStationCount = 0;
    for (var k in result.amap_station_set) amapStationCount++;
    result.amap_station_count = amapStationCount;
  }

  if (result.local_ok && result.amap_ok) {
    result.time_diff_min = result.local_time_min - result.amap_time_min;
    result.time_diff_pct = result.amap_time_min > 0 ? (result.time_diff_min / result.amap_time_min * 100) : 0;
    result.transfer_diff = result.local_transfers - result.amap_transfers;
    result.station_diff = result.local_station_count - result.amap_station_count;
    result.walking_diff_m = 0 - result.amap_walking_m;
    result.jaccard = jaccardIndex(result.local_station_set, result.amap_station_set);
    result.transfer_comparison = compareTransferStations(localResult.transfer_stations, amapScheme.transfer_stations);
    result.line_comparison = compareSegmentLines(localResult.segments, amapScheme.metro_segments);
  }

  return result;
}

module.exports = { compare: compare };

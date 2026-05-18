function extractPathSegments(pathResult) {
  if (!pathResult || pathResult.length === 0) return [];
  var segments = [];
  var segStart = 0;
  for (var i = 1; i < pathResult.length; i++) {
    if (pathResult[i].line !== pathResult[segStart].line) {
      segments.push({
        line: pathResult[segStart].line,
        startIdx: segStart,
        endIdx: i - 1,
        fromStation: pathResult[segStart].station,
        toStation: pathResult[i - 1].station
      });
      segStart = i;
    }
  }
  segments.push({
    line: pathResult[segStart].line,
    startIdx: segStart,
    endIdx: pathResult.length - 1,
    fromStation: pathResult[segStart].station,
    toStation: pathResult[pathResult.length - 1].station
  });
  return segments;
}

function getPathSegmentCoords(lineName, fromStation, toStation, routesByName, routeStationPathMap) {
  var route = routesByName[lineName];
  if (!route) return null;

  if (route.path && route.path.length > 0 && routeStationPathMap[lineName]) {
    var mapping = routeStationPathMap[lineName];
    var fromIdx = mapping[fromStation];
    var toIdx = mapping[toStation];
    if (fromIdx === undefined || toIdx === undefined) return null;

    var coords = [];
    if (fromIdx <= toIdx) {
      for (var i = fromIdx; i <= toIdx; i++) {
        coords.push(route.path[i]);
      }
    } else {
      for (var i = fromIdx; i >= toIdx; i--) {
        coords.push(route.path[i]);
      }
    }
    return coords;
  }

  var fromSIdx = -1, toSIdx = -1;
  for (var i = 0; i < route.stations.length; i++) {
    if (route.stations[i].name === fromStation) fromSIdx = i;
    if (route.stations[i].name === toStation) toSIdx = i;
  }
  if (fromSIdx === -1 || toSIdx === -1) return null;

  var coords = [];
  if (fromSIdx <= toSIdx) {
    for (var i = fromSIdx; i <= toSIdx; i++) {
      coords.push([route.stations[i].lat, route.stations[i].lon]);
    }
  } else {
    for (var i = fromSIdx; i >= toSIdx; i--) {
      coords.push([route.stations[i].lat, route.stations[i].lon]);
    }
  }
  return coords;
}

function buildSegmentCoords(segments, pathResult, routesByName, routeStationPathMap) {
  var allCoords = [];
  for (var s = 0; s < segments.length; s++) {
    var seg = segments[s];
    var fromStation = seg.fromStation;
    var toStation = seg.toStation;
    if (fromStation === toStation) {
      allCoords.push([pathResult[seg.startIdx].lat, pathResult[seg.startIdx].lon]);
      continue;
    }
    var segCoords = getPathSegmentCoords(seg.line, fromStation, toStation, routesByName, routeStationPathMap);
    if (segCoords && segCoords.length > 0) {
      if (allCoords.length > 0) {
        segCoords = segCoords.slice(1);
      }
      allCoords = allCoords.concat(segCoords);
    } else {
      for (var k = seg.startIdx; k <= seg.endIdx; k++) {
        var coord = [pathResult[k].lat, pathResult[k].lon];
        if (allCoords.length > 0) {
          var last = allCoords[allCoords.length - 1];
          if (last[0] === coord[0] && last[1] === coord[1]) continue;
        }
        allCoords.push(coord);
      }
    }
  }
  return allCoords;
}

function buildPathSegmentLayers(segments, pathResult, routesByName, routeStationPathMap, routeColors) {
  var layers = [];
  for (var s = 0; s < segments.length; s++) {
    var seg = segments[s];
    var fromStation = seg.fromStation;
    var toStation = seg.toStation;
    var color = routeColors[seg.line] || '#999';
    var coords;
    if (fromStation === toStation) {
      coords = [[pathResult[seg.startIdx].lat, pathResult[seg.startIdx].lon]];
    } else {
      coords = getPathSegmentCoords(seg.line, fromStation, toStation, routesByName, routeStationPathMap);
      if (!coords || coords.length === 0) {
        coords = [];
        for (var k = seg.startIdx; k <= seg.endIdx; k++) {
          coords.push([pathResult[k].lat, pathResult[k].lon]);
        }
      }
    }
    layers.push({ line: seg.line, color: color, coords: coords });
  }
  return layers;
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { extractPathSegments, getPathSegmentCoords, buildSegmentCoords, buildPathSegmentLayers };
}

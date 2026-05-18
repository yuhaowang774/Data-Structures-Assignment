var assert = require('assert');
var logic = require('./path-logic');

var extractPathSegments = logic.extractPathSegments;
var getPathSegmentCoords = logic.getPathSegmentCoords;
var buildSegmentCoords = logic.buildSegmentCoords;
var buildPathSegmentLayers = logic.buildPathSegmentLayers;

function runTests() {
  var passed = 0;
  var failed = 0;

  function test(name, fn) {
    try {
      fn();
      console.log('  PASS: ' + name);
      passed++;
    } catch (e) {
      console.log('  FAIL: ' + name);
      console.log('    ' + e.message);
      failed++;
    }
  }

  console.log('\n=== extractPathSegments ===\n');

  test('single line path returns one segment', function () {
    var path = [
      { station: 'A', line: 'L1' },
      { station: 'B', line: 'L1' },
      { station: 'C', line: 'L1' }
    ];
    var segs = extractPathSegments(path);
    assert.strictEqual(segs.length, 1);
    assert.strictEqual(segs[0].line, 'L1');
    assert.strictEqual(segs[0].fromStation, 'A');
    assert.strictEqual(segs[0].toStation, 'C');
  });

  test('two lines with transfer returns two segments', function () {
    var path = [
      { station: 'A', line: 'L1' },
      { station: 'B', line: 'L1' },
      { station: 'B', line: 'L2' },
      { station: 'C', line: 'L2' }
    ];
    var segs = extractPathSegments(path);
    assert.strictEqual(segs.length, 2);
    assert.strictEqual(segs[0].line, 'L1');
    assert.strictEqual(segs[0].fromStation, 'A');
    assert.strictEqual(segs[0].toStation, 'B');
    assert.strictEqual(segs[1].line, 'L2');
    assert.strictEqual(segs[1].fromStation, 'B');
    assert.strictEqual(segs[1].toStation, 'C');
  });

  test('three lines with two transfers returns three segments', function () {
    var path = [
      { station: 'A', line: 'L1' },
      { station: 'X', line: 'L1' },
      { station: 'X', line: 'L2' },
      { station: 'Y', line: 'L2' },
      { station: 'Y', line: 'L3' },
      { station: 'Z', line: 'L3' }
    ];
    var segs = extractPathSegments(path);
    assert.strictEqual(segs.length, 3);
    assert.strictEqual(segs[0].line, 'L1');
    assert.strictEqual(segs[1].line, 'L2');
    assert.strictEqual(segs[2].line, 'L3');
    assert.strictEqual(segs[0].fromStation, 'A');
    assert.strictEqual(segs[0].toStation, 'X');
    assert.strictEqual(segs[1].fromStation, 'X');
    assert.strictEqual(segs[1].toStation, 'Y');
    assert.strictEqual(segs[2].fromStation, 'Y');
    assert.strictEqual(segs[2].toStation, 'Z');
  });

  test('empty path returns empty array', function () {
    assert.deepStrictEqual(extractPathSegments([]), []);
  });

  test('single station returns one segment with same from/to', function () {
    var path = [{ station: 'A', line: 'L1' }];
    var segs = extractPathSegments(path);
    assert.strictEqual(segs.length, 1);
    assert.strictEqual(segs[0].fromStation, 'A');
    assert.strictEqual(segs[0].toStation, 'A');
  });

  console.log('\n=== getPathSegmentCoords (with path data) ===\n');

  var routesByName = {
    'L1': {
      name: 'L1',
      stations: [
        { name: 'A', lat: 34.0, lon: 108.0 },
        { name: 'B', lat: 34.1, lon: 108.1 },
        { name: 'C', lat: 34.2, lon: 108.2 },
        { name: 'D', lat: 34.3, lon: 108.3 }
      ],
      path: [
        [34.0, 108.0],
        [34.02, 108.02],
        [34.05, 108.05],
        [34.1, 108.1],
        [34.12, 108.12],
        [34.15, 108.15],
        [34.2, 108.2],
        [34.22, 108.22],
        [34.25, 108.25],
        [34.3, 108.3]
      ]
    },
    'L2': {
      name: 'L2',
      stations: [
        { name: 'X', lat: 34.5, lon: 109.0 },
        { name: 'Y', lat: 34.6, lon: 109.1 }
      ]
    }
  };

  var routeStationPathMap = {
    'L1': { 'A': 0, 'B': 3, 'C': 6, 'D': 9 }
  };

  test('extracts forward segment from path data', function () {
    var coords = getPathSegmentCoords('L1', 'A', 'C', routesByName, routeStationPathMap);
    assert.strictEqual(coords.length, 7);
    assert.deepStrictEqual(coords[0], [34.0, 108.0]);
    assert.deepStrictEqual(coords[6], [34.2, 108.2]);
  });

  test('extracts reverse segment from path data', function () {
    var coords = getPathSegmentCoords('L1', 'C', 'A', routesByName, routeStationPathMap);
    assert.strictEqual(coords.length, 7);
    assert.deepStrictEqual(coords[0], [34.2, 108.2]);
    assert.deepStrictEqual(coords[6], [34.0, 108.0]);
  });

  test('extracts short forward segment', function () {
    var coords = getPathSegmentCoords('L1', 'B', 'C', routesByName, routeStationPathMap);
    assert.strictEqual(coords.length, 4);
    assert.deepStrictEqual(coords[0], [34.1, 108.1]);
    assert.deepStrictEqual(coords[3], [34.2, 108.2]);
  });

  test('falls back to station coords when no path data', function () {
    var coords = getPathSegmentCoords('L2', 'X', 'Y', routesByName, routeStationPathMap);
    assert.strictEqual(coords.length, 2);
    assert.deepStrictEqual(coords[0], [34.5, 109.0]);
    assert.deepStrictEqual(coords[1], [34.6, 109.1]);
  });

  test('returns null for unknown line', function () {
    var coords = getPathSegmentCoords('L99', 'A', 'B', routesByName, routeStationPathMap);
    assert.strictEqual(coords, null);
  });

  test('returns null for unknown station', function () {
    var coords = getPathSegmentCoords('L1', 'Z', 'B', routesByName, routeStationPathMap);
    assert.strictEqual(coords, null);
  });

  console.log('\n=== buildSegmentCoords (integration) ===\n');

  test('builds coords for single segment path', function () {
    var path = [
      { station: 'A', line: 'L1', lat: 34.0, lon: 108.0 },
      { station: 'B', line: 'L1', lat: 34.1, lon: 108.1 },
      { station: 'C', line: 'L1', lat: 34.2, lon: 108.2 }
    ];
    var segs = extractPathSegments(path);
    var coords = buildSegmentCoords(segs, path, routesByName, routeStationPathMap);
    assert.ok(coords.length >= 3);
    assert.deepStrictEqual(coords[0], [34.0, 108.0]);
  });

  test('builds coords for multi-segment path with transfer', function () {
    var path = [
      { station: 'A', line: 'L1', lat: 34.0, lon: 108.0 },
      { station: 'B', line: 'L1', lat: 34.1, lon: 108.1 },
      { station: 'B', line: 'L2', lat: 34.1, lon: 108.1 },
      { station: 'X', line: 'L2', lat: 34.5, lon: 109.0 }
    ];
    var segs = extractPathSegments(path);
    var coords = buildSegmentCoords(segs, path, routesByName, routeStationPathMap);
    assert.ok(coords.length >= 3);
  });

  console.log('\n=== buildPathSegmentLayers (segment-based display) ===\n');

  var routeColors = { 'L1': '#FF0000', 'L2': '#00FF00' };

  test('returns one layer per segment with correct line and color', function () {
    var path = [
      { station: 'A', line: 'L1', lat: 34.0, lon: 108.0 },
      { station: 'B', line: 'L1', lat: 34.1, lon: 108.1 },
      { station: 'B', line: 'L2', lat: 34.1, lon: 108.1 },
      { station: 'X', line: 'L2', lat: 34.5, lon: 109.0 }
    ];
    var segs = extractPathSegments(path);
    var layers = buildPathSegmentLayers(segs, path, routesByName, routeStationPathMap, routeColors);
    assert.strictEqual(layers.length, 2);
    assert.strictEqual(layers[0].line, 'L1');
    assert.strictEqual(layers[0].color, '#FF0000');
    assert.strictEqual(layers[1].line, 'L2');
    assert.strictEqual(layers[1].color, '#00FF00');
  });

  test('each layer only contains coords for its segment, not the entire line', function () {
    var path = [
      { station: 'B', line: 'L1', lat: 34.1, lon: 108.1 },
      { station: 'C', line: 'L1', lat: 34.2, lon: 108.2 }
    ];
    var segs = extractPathSegments(path);
    var layers = buildPathSegmentLayers(segs, path, routesByName, routeStationPathMap, routeColors);
    assert.strictEqual(layers.length, 1);
    assert.strictEqual(layers[0].line, 'L1');
    assert.ok(layers[0].coords.length < 10, 'segment coords should be less than full line path (10 points)');
    assert.deepStrictEqual(layers[0].coords[0], [34.1, 108.1]);
  });

  test('single station segment produces one coord', function () {
    var path = [
      { station: 'A', line: 'L1', lat: 34.0, lon: 108.0 }
    ];
    var segs = extractPathSegments(path);
    var layers = buildPathSegmentLayers(segs, path, routesByName, routeStationPathMap, routeColors);
    assert.strictEqual(layers.length, 1);
    assert.strictEqual(layers[0].coords.length, 1);
    assert.deepStrictEqual(layers[0].coords[0], [34.0, 108.0]);
  });

  test('fallback coords when no path data available', function () {
    var path = [
      { station: 'X', line: 'L2', lat: 34.5, lon: 109.0 },
      { station: 'Y', line: 'L2', lat: 34.6, lon: 109.1 }
    ];
    var segs = extractPathSegments(path);
    var layers = buildPathSegmentLayers(segs, path, routesByName, routeStationPathMap, routeColors);
    assert.strictEqual(layers.length, 1);
    assert.strictEqual(layers[0].coords.length, 2);
    assert.deepStrictEqual(layers[0].coords[0], [34.5, 109.0]);
    assert.deepStrictEqual(layers[0].coords[1], [34.6, 109.1]);
  });

  test('uses default color when line color not found', function () {
    var path = [
      { station: 'X', line: 'L2', lat: 34.5, lon: 109.0 },
      { station: 'Y', line: 'L2', lat: 34.6, lon: 109.1 }
    ];
    var segs = extractPathSegments(path);
    var layers = buildPathSegmentLayers(segs, path, routesByName, routeStationPathMap, {});
    assert.strictEqual(layers[0].color, '#999');
  });

  console.log('\n=== Results ===\n');
  console.log('  Passed: ' + passed);
  console.log('  Failed: ' + failed);
  process.exit(failed > 0 ? 1 : 0);
}

runTests();

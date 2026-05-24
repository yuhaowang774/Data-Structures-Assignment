var fs = require('fs');
var path = require('path');

var MANUAL_CASES = [
  { origin: '三桥', dest: '半坡', desc: '同线直达(1号线)' },
  { origin: '小寨', dest: '钟楼', desc: '1次换乘大站' },
  { origin: '丈八北路', dest: '万寿路', desc: '1次换乘多选' },
  { origin: '保税区', dest: '航天新城', desc: '2次换乘长距离' },
  { origin: '杨官寨', dest: '秦陵西', desc: '跨远郊超长路线' },
  { origin: '北大街', dest: '钟楼', desc: '近距离相邻站' },
  { origin: '后卫寨', dest: '纺织城', desc: '1号线全程' },
  { origin: '草滩', dest: '常宁宫', desc: '2号线全程' },
  { origin: '鱼化寨', dest: '保税区', desc: '3号线长距离' },
  { origin: '创新港', dest: '纺织城', desc: '5号线全程' },
];

function haversineMeters(lat1, lon1, lat2, lon2) {
  var R = 6371000;
  var dLat = (lat2 - lat1) * Math.PI / 180;
  var dLon = (lon2 - lon1) * Math.PI / 180;
  var a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function generate(stationsData, config) {
  var stationMap = {};
  stationsData.forEach(function (s) {
    stationMap[s.name] = s;
  });

  var cases = [];
  var id = 1;

  MANUAL_CASES.forEach(function (mc) {
    var oStation = stationMap[mc.origin];
    var dStation = stationMap[mc.dest];
    if (!oStation || !dStation) return;
    cases.push({
      id: 'T' + String(id++).padStart(2, '0'),
      type: 'manual',
      desc: mc.desc,
      origin: mc.origin,
      dest: mc.dest,
      originCoord: [oStation.lon, oStation.lat],
      destCoord: [dStation.lon, dStation.lat],
    });
  });

  var names = stationsData.map(function (s) { return s.name; });
  var used = {};
  cases.forEach(function (c) {
    used[c.origin + '→' + c.dest] = true;
    used[c.dest + '→' + c.origin] = true;
  });

  var maxAttempts = config.RANDOM_CASE_COUNT * 10;
  var attempts = 0;
  while (cases.length < 10 + config.RANDOM_CASE_COUNT && attempts < maxAttempts) {
    attempts++;
    var oi = Math.floor(Math.random() * names.length);
    var di = Math.floor(Math.random() * names.length);
    if (oi === di) continue;

    var oName = names[oi];
    var dName = names[di];
    var key = oName + '→' + dName;
    if (used[key]) continue;

    var oS = stationMap[oName];
    var dS = stationMap[dName];
    var dist = haversineMeters(oS.lat, oS.lon, dS.lat, dS.lon);
    if (dist < config.MIN_DISTANCE_M) continue;

    used[key] = true;
    used[dName + '→' + oName] = true;

    cases.push({
      id: 'T' + String(id++).padStart(2, '0'),
      type: 'random',
      origin: oName,
      dest: dName,
      originCoord: [oS.lon, oS.lat],
      destCoord: [dS.lon, dS.lat],
    });
  }

  return cases;
}

module.exports = { generate: generate };

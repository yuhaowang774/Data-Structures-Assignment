var https = require('https');
var http = require('http');

var GCJ_A = 6378245.0;
var GCJ_EE = 0.00669342162296594323;

function gcj02Lat(lat, lon) {
  if (lon < 72.004 || lon > 137.8347 || lat < 0.8293 || lat > 55.8271) return lat;
  var x = lon - 105.0, y = lat - 35.0;
  var dLat = -100.0 + 2.0 * x + 3.0 * y + 0.2 * y * y + 0.1 * x * y + 0.2 * Math.sqrt(Math.abs(x));
  dLat += ((20.0 * Math.sin(6.0 * x * Math.PI) + 20.0 * Math.sin(2.0 * x * Math.PI)) * 2.0) / 3.0;
  dLat += ((20.0 * Math.sin(y * Math.PI) + 40.0 * Math.sin((y / 3.0) * Math.PI)) * 2.0) / 3.0;
  dLat += ((160.0 * Math.sin((y / 12.0) * Math.PI) + 320.0 * Math.sin((y * Math.PI) / 30.0)) * 2.0) / 3.0;
  var radLat = (lat / 180.0) * Math.PI;
  var magic = Math.sin(radLat);
  magic = 1 - GCJ_EE * magic * magic;
  var sqrtMagic = Math.sqrt(magic);
  dLat = (dLat * 180.0) / (((GCJ_A * (1 - GCJ_EE)) / (magic * sqrtMagic)) * Math.PI);
  return lat + dLat;
}

function gcj02Lon(lat, lon) {
  if (lon < 72.004 || lon > 137.8347 || lat < 0.8293 || lat > 55.8271) return lon;
  var x = lon - 105.0, y = lat - 35.0;
  var dLon = 300.0 + x + 2.0 * y + 0.1 * x * x + 0.1 * x * y + 0.1 * Math.sqrt(Math.abs(x));
  dLon += ((20.0 * Math.sin(6.0 * x * Math.PI) + 20.0 * Math.sin(2.0 * x * Math.PI)) * 2.0) / 3.0;
  dLon += ((20.0 * Math.sin(x * Math.PI) + 40.0 * Math.sin((x / 3.0) * Math.PI)) * 2.0) / 3.0;
  dLon += ((150.0 * Math.sin((x / 12.0) * Math.PI) + 300.0 * Math.sin((x / 30.0) * Math.PI)) * 2.0) / 3.0;
  var radLat = (lat / 180.0) * Math.PI;
  var magic = Math.sin(radLat);
  magic = 1 - GCJ_EE * magic * magic;
  var sqrtMagic = Math.sqrt(magic);
  dLon = (dLon * 180.0) / ((GCJ_A / sqrtMagic) * Math.cos(radLat) * Math.PI);
  return lon + dLon;
}

function wgs84ToGcj02(lon, lat) {
  return [gcj02Lon(lat, lon), gcj02Lat(lat, lon)];
}

function sleep(ms) {
  return new Promise(function (resolve) { setTimeout(resolve, ms); });
}

function httpGet(urlStr, timeout) {
  return new Promise(function (resolve, reject) {
    var mod = urlStr.startsWith('https') ? https : http;
    var req = mod.get(urlStr, function (res) {
      var body = '';
      res.on('data', function (chunk) { body += chunk; });
      res.on('end', function () {
        try { resolve(JSON.parse(body)); }
        catch (e) { reject(new Error('JSON parse error: ' + e.message)); }
      });
    });
    req.on('error', reject);
    req.setTimeout(timeout || 10000, function () {
      req.destroy(new Error('Request timeout'));
    });
  });
}

function AmapClient(config) {
  this.key = config.AMAP_KEY;
  this.city = config.CITY;
  this.base = config.AMAP_BASE;
  this.qps = config.QPS;
  this.retryMax = config.RETRY_MAX;
  this.retryBaseDelay = config.RETRY_BASE_DELAY;
  this.timeout = config.TIMEOUT;
  this.tokens = 0;
  this.maxTokens = this.qps;
  this._startRefill();
}

AmapClient.prototype._startRefill = function () {
  var self = this;
  this._refillInterval = setInterval(function () {
    if (self.tokens < self.maxTokens) {
      self.tokens++;
    }
  }, Math.floor(1000 / self.qps));
  this.tokens = this.maxTokens;
};

AmapClient.prototype._acquireToken = function () {
  var self = this;
  return new Promise(function (resolve) {
    function tryAcquire() {
      if (self.tokens > 0) {
        self.tokens--;
        resolve();
      } else {
        setTimeout(tryAcquire, 50);
      }
    }
    tryAcquire();
  });
};

AmapClient.prototype._requestWithRetry = function (urlStr) {
  var self = this;
  var attempt = 0;

  function tryOnce() {
    attempt++;
    return httpGet(urlStr, self.timeout).then(function (data) {
      if (data.status === '1') return data;
      var retryableCodes = ['10003', '10004', '30000', '30001', '30002'];
      if (retryableCodes.indexOf(data.infocode) !== -1) {
        if (attempt < self.retryMax) {
          var delay = self.retryBaseDelay * Math.pow(2, attempt - 1);
          return sleep(delay).then(tryOnce);
        }
      }
      return data;
    }).catch(function (err) {
      if (attempt < self.retryMax) {
        var delay = self.retryBaseDelay * Math.pow(2, attempt - 1);
        return sleep(delay).then(tryOnce);
      }
      throw err;
    });
  }

  return tryOnce();
};

AmapClient.prototype.queryTransit = function (originCoord, destCoord, strategy) {
  var self = this;
  var gcjOrigin = wgs84ToGcj02(originCoord[0], originCoord[1]);
  var gcjDest = wgs84ToGcj02(destCoord[0], destCoord[1]);

  var urlStr = self.base +
    '?key=' + self.key +
    '&origin=' + gcjOrigin[0].toFixed(6) + ',' + gcjOrigin[1].toFixed(6) +
    '&destination=' + gcjDest[0].toFixed(6) + ',' + gcjDest[1].toFixed(6) +
    '&city=' + encodeURIComponent(self.city) +
    '&strategy=' + (strategy || 0) +
    '&nightflag=0' +
    '&output=json';

  return self._acquireToken().then(function () {
    return self._requestWithRetry(urlStr);
  }).then(function (data) {
    if (data.status !== '1') {
      return { error: 'Amap API error: ' + (data.info || 'unknown'), infocode: data.infocode, raw: data };
    }
    return self._parseResponse(data);
  }).catch(function (err) {
    return { error: err.message };
  });
};

AmapClient.prototype._parseResponse = function (data) {
  var route = data.route;
  if (!route || !route.transits || route.transits.length === 0) {
    return { error: 'No transit results', raw: data };
  }

  var allParsed = [];
  for (var t = 0; t < route.transits.length; t++) {
    var transit = route.transits[t];
    var metroSegments = [];
    var walkingSegments = [];
    var hasNonMetro = false;

    for (var s = 0; s < transit.segments.length; s++) {
      var seg = transit.segments[s];

      if (seg.walking && seg.walking.distance > 0) {
        walkingSegments.push({
          distance_m: parseInt(seg.walking.distance, 10),
          duration_sec: parseInt(seg.walking.duration, 10) || 0,
        });
      }

      if (seg.bus && seg.bus.buslines && seg.bus.buslines.length > 0) {
        var busline = seg.bus.buslines[0];
        if (busline.type === '地铁线路') {
          var viaStops = [];
          if (busline.via_stops) {
            viaStops = busline.via_stops.map(function (vs) { return vs.name; });
          }
          var allStops = [busline.departure_stop.name].concat(viaStops, [busline.arrival_stop.name]);
          var lineName = busline.name.replace(/\(.*\)/, '');
          metroSegments.push({
            line_name: busline.name,
            line_short: lineName,
            departure_stop: busline.departure_stop.name,
            arrival_stop: busline.arrival_stop.name,
            via_stops: viaStops,
            all_stops: allStops,
            duration_sec: parseInt(busline.duration, 10),
            distance_m: parseInt(busline.distance, 10),
          });
        } else {
          hasNonMetro = true;
        }
      }
    }

    var metroTransfers = Math.max(0, metroSegments.length - 1);
    var transferStations = [];
    for (var i = 1; i < metroSegments.length; i++) {
      transferStations.push(metroSegments[i].departure_stop);
    }

    allParsed.push({
      scheme_index: t,
      duration_sec: parseInt(transit.duration, 10),
      walking_distance_m: parseInt(transit.walking_distance, 10),
      cost: parseFloat(transit.cost) || 0,
      metro_transfers: metroTransfers,
      transfer_stations: transferStations,
      metro_segments: metroSegments,
      walking_segments: walkingSegments,
      has_non_metro: hasNonMetro,
      has_metro: metroSegments.length > 0,
      raw_transit: transit,
    });
  }

  var metroSchemes = allParsed.filter(function (s) { return s.has_metro; });
  var results;
  if (metroSchemes.length > 0) {
    metroSchemes.sort(function (a, b) { return a.duration_sec - b.duration_sec; });
    results = metroSchemes.slice(0, 2);
  } else {
    results = allParsed.slice(0, 2);
  }

  return { schemes: results };
};

AmapClient.prototype.destroy = function () {
  if (this._refillInterval) {
    clearInterval(this._refillInterval);
  }
};

module.exports = AmapClient;

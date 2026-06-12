import json
import math
import time
import urllib.parse
import urllib.request


GCJ_A = 6378245.0
GCJ_EE = 0.00669342162296594323


def gcj02_lat(lat, lon):
    if lon < 72.004 or lon > 137.8347 or lat < 0.8293 or lat > 55.8271:
        return lat
    x = lon - 105.0
    y = lat - 35.0
    d_lat = -100.0 + 2.0 * x + 3.0 * y + 0.2 * y * y + 0.1 * x * y + 0.2 * math.sqrt(abs(x))
    d_lat += ((20.0 * math.sin(6.0 * x * math.pi) + 20.0 * math.sin(2.0 * x * math.pi)) * 2.0) / 3.0
    d_lat += ((20.0 * math.sin(y * math.pi) + 40.0 * math.sin((y / 3.0) * math.pi)) * 2.0) / 3.0
    d_lat += ((160.0 * math.sin((y / 12.0) * math.pi) + 320.0 * math.sin((y * math.pi) / 30.0)) * 2.0) / 3.0
    rad_lat = (lat / 180.0) * math.pi
    magic = math.sin(rad_lat)
    magic = 1 - GCJ_EE * magic * magic
    sqrt_magic = math.sqrt(magic)
    d_lat = (d_lat * 180.0) / (((GCJ_A * (1 - GCJ_EE)) / (magic * sqrt_magic)) * math.pi)
    return lat + d_lat


def gcj02_lon(lat, lon):
    if lon < 72.004 or lon > 137.8347 or lat < 0.8293 or lat > 55.8271:
        return lon
    x = lon - 105.0
    y = lat - 35.0
    d_lon = 300.0 + x + 2.0 * y + 0.1 * x * x + 0.1 * x * y + 0.1 * math.sqrt(abs(x))
    d_lon += ((20.0 * math.sin(6.0 * x * math.pi) + 20.0 * math.sin(2.0 * x * math.pi)) * 2.0) / 3.0
    d_lon += ((20.0 * math.sin(x * math.pi) + 40.0 * math.sin((x / 3.0) * math.pi)) * 2.0) / 3.0
    d_lon += ((150.0 * math.sin((x / 12.0) * math.pi) + 300.0 * math.sin((x / 30.0) * math.pi)) * 2.0) / 3.0
    rad_lat = (lat / 180.0) * math.pi
    magic = math.sin(rad_lat)
    magic = 1 - GCJ_EE * magic * magic
    sqrt_magic = math.sqrt(magic)
    d_lon = (d_lon * 180.0) / ((GCJ_A / sqrt_magic) * math.cos(rad_lat) * math.pi)
    return lon + d_lon


def wgs84_to_gcj02(lon, lat):
    return gcj02_lon(lat, lon), gcj02_lat(lat, lon)


class AmapClient:
    def __init__(self, config):
        self.key = config.AMAP_KEY
        self.city = config.CITY
        self.base = config.AMAP_BASE
        self.retry_max = config.RETRY_MAX
        self.retry_base_delay = config.RETRY_BASE_DELAY
        self.timeout = config.TIMEOUT
        self.min_interval = 1.0 / max(config.QPS, 1)
        self._last_request_at = 0.0

    def _rate_limit(self):
        now = time.time()
        wait = self.min_interval - (now - self._last_request_at)
        if wait > 0:
            time.sleep(wait)
        self._last_request_at = time.time()

    def _fetch_json(self, url):
        self._rate_limit()
        with urllib.request.urlopen(url, timeout=self.timeout) as response:
            return json.loads(response.read().decode("utf-8"))

    def _request_with_retry(self, url):
        for attempt in range(1, self.retry_max + 1):
            try:
                data = self._fetch_json(url)
                if data.get("status") == "1":
                    return data
                if data.get("infocode") not in {"10003", "10004", "30000", "30001", "30002"}:
                    return data
            except Exception as exc:  # pragma: no cover - network dependent
                error = exc
            time.sleep(self.retry_base_delay * (2 ** (attempt - 1)))
        raise error

    def query_transit(self, origin_coord, dest_coord, strategy):
        origin_lon, origin_lat = wgs84_to_gcj02(origin_coord[0], origin_coord[1])
        dest_lon, dest_lat = wgs84_to_gcj02(dest_coord[0], dest_coord[1])
        query = urllib.parse.urlencode(
            {
                "key": self.key,
                "origin": f"{origin_lon:.6f},{origin_lat:.6f}",
                "destination": f"{dest_lon:.6f},{dest_lat:.6f}",
                "city": self.city,
                "strategy": strategy or 0,
                "nightflag": 0,
                "output": "json",
            }
        )
        try:
            data = self._request_with_retry(f"{self.base}?{query}")
        except Exception as exc:  # pragma: no cover - network dependent
            return {"error": str(exc)}

        if data.get("status") != "1":
            return {"error": f"Amap API error: {data.get('info', 'unknown')}", "infocode": data.get("infocode"), "raw": data}
        return self._parse_response(data)

    def _parse_response(self, data):
        route = data.get("route") or {}
        transits = route.get("transits") or []
        if not transits:
            return {"error": "No transit results", "raw": data}

        parsed = []
        for index, transit in enumerate(transits):
            metro_segments = []
            walking_segments = []
            has_non_metro = False

            for segment in transit.get("segments", []):
                walking = segment.get("walking") or {}
                if int(walking.get("distance", 0)) > 0:
                    walking_segments.append(
                        {
                            "distance_m": int(walking.get("distance", 0)),
                            "duration_sec": int(walking.get("duration", 0)),
                        }
                    )

                bus = segment.get("bus") or {}
                buslines = bus.get("buslines") or []
                if not buslines:
                    continue

                busline = buslines[0]
                if busline.get("type") != "地铁线路":
                    has_non_metro = True
                    continue

                via_stops = [stop["name"] for stop in busline.get("via_stops", [])]
                departure = busline["departure_stop"]["name"]
                arrival = busline["arrival_stop"]["name"]
                metro_segments.append(
                    {
                        "line_name": busline.get("name", ""),
                        "line_short": busline.get("name", "").split("(")[0],
                        "departure_stop": departure,
                        "arrival_stop": arrival,
                        "via_stops": via_stops,
                        "all_stops": [departure] + via_stops + [arrival],
                        "duration_sec": int(busline.get("duration", 0)),
                        "distance_m": int(busline.get("distance", 0)),
                    }
                )

            parsed.append(
                {
                    "scheme_index": index,
                    "duration_sec": int(transit.get("duration", 0)),
                    "walking_distance_m": int(transit.get("walking_distance", 0)),
                    "cost": float(transit.get("cost", 0) or 0),
                    "metro_transfers": max(0, len(metro_segments) - 1),
                    "transfer_stations": [segment["departure_stop"] for segment in metro_segments[1:]],
                    "metro_segments": metro_segments,
                    "walking_segments": walking_segments,
                    "has_non_metro": has_non_metro,
                    "has_metro": bool(metro_segments),
                    "raw_transit": transit,
                }
            )

        metro_only = [scheme for scheme in parsed if scheme["has_metro"]]
        if metro_only:
            metro_only.sort(key=lambda scheme: scheme["duration_sec"])
            return {"schemes": metro_only[:2]}
        return {"schemes": parsed[:2]}

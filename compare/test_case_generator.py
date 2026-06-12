import math
import random


MANUAL_CASES = [
    {"origin": "三桥", "dest": "半坡", "desc": "same line direct"},
    {"origin": "小寨", "dest": "钟楼", "desc": "single transfer core section"},
    {"origin": "丈八北路", "dest": "万寿路", "desc": "single transfer with options"},
    {"origin": "保税区", "dest": "航天新城", "desc": "long multi-transfer case"},
    {"origin": "杨官寨", "dest": "秦陵西", "desc": "outer suburban long route"},
    {"origin": "北大街", "dest": "钟楼", "desc": "short adjacent route"},
    {"origin": "后卫寨", "dest": "纺织城", "desc": "line 1 full trip"},
    {"origin": "草滩", "dest": "常宁宫", "desc": "line 2 full trip"},
    {"origin": "鱼化寨", "dest": "保税区", "desc": "line 3 long route"},
    {"origin": "创新港", "dest": "纺织城", "desc": "line 5 full trip"},
]


def haversine_meters(lat1, lon1, lat2, lon2):
    radius = 6371000
    d_lat = math.radians(lat2 - lat1)
    d_lon = math.radians(lon2 - lon1)
    value = (
        math.sin(d_lat / 2) ** 2
        + math.cos(math.radians(lat1))
        * math.cos(math.radians(lat2))
        * math.sin(d_lon / 2) ** 2
    )
    return radius * 2 * math.atan2(math.sqrt(value), math.sqrt(1 - value))


def generate(stations, config):
    station_map = {station["name"]: station for station in stations}
    cases = []
    used = set()

    for index, manual_case in enumerate(MANUAL_CASES, start=1):
        origin_station = station_map.get(manual_case["origin"])
        dest_station = station_map.get(manual_case["dest"])
        if not origin_station or not dest_station:
            continue
        cases.append(
            {
                "id": f"T{index:02d}",
                "type": "manual",
                "desc": manual_case["desc"],
                "origin": manual_case["origin"],
                "dest": manual_case["dest"],
                "origin_coord": [origin_station["lon"], origin_station["lat"]],
                "dest_coord": [dest_station["lon"], dest_station["lat"]],
            }
        )
        used.add((manual_case["origin"], manual_case["dest"]))
        used.add((manual_case["dest"], manual_case["origin"]))

    names = [station["name"] for station in stations]
    target_count = len(cases) + config.RANDOM_CASE_COUNT
    attempts = 0
    max_attempts = config.RANDOM_CASE_COUNT * 10
    next_index = len(cases) + 1

    while len(cases) < target_count and attempts < max_attempts:
        attempts += 1
        origin_name, dest_name = random.sample(names, 2)
        if (origin_name, dest_name) in used:
            continue

        origin_station = station_map[origin_name]
        dest_station = station_map[dest_name]
        distance = haversine_meters(
            origin_station["lat"],
            origin_station["lon"],
            dest_station["lat"],
            dest_station["lon"],
        )
        if distance < config.MIN_DISTANCE_M:
            continue

        used.add((origin_name, dest_name))
        used.add((dest_name, origin_name))
        cases.append(
            {
                "id": f"T{next_index:02d}",
                "type": "random",
                "origin": origin_name,
                "dest": dest_name,
                "origin_coord": [origin_station["lon"], origin_station["lat"]],
                "dest_coord": [dest_station["lon"], dest_station["lat"]],
            }
        )
        next_index += 1

    return cases

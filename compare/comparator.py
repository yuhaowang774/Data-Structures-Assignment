def get_local_station_set(local_result):
    station_set = set()
    last_station = None
    for node in local_result["path"]:
        if node["station"] != last_station:
            station_set.add(node["station"])
            last_station = node["station"]
    return station_set


def get_amap_station_set(amap_scheme):
    station_set = set()
    for segment in amap_scheme["metro_segments"]:
        for stop in segment.get("all_stops") or [segment["departure_stop"], *segment.get("via_stops", []), segment["arrival_stop"]]:
            station_set.add(stop)
    return station_set


def jaccard_index(set_a, set_b):
    union = set_a | set_b
    if not union:
        return 1.0
    return len(set_a & set_b) / len(union)


def compare_transfer_stations(local_transfers, amap_transfers):
    local_set = set(local_transfers)
    amap_set = set(amap_transfers)
    return {
        "common": sorted(local_set & amap_set),
        "local_only": sorted(local_set - amap_set),
        "amap_only": sorted(amap_set - local_set),
    }


def normalize_line_name(name):
    if not name:
        return name
    if name.startswith("地铁") and name.endswith("号线"):
        return name
    if name.startswith("地铁") and "号线" not in name:
        return name.replace("号", "号线", 1)
    return name


def compare_segment_lines(local_segments, amap_segments):
    local_lines = [normalize_line_name(segment["line"]) for segment in local_segments]
    amap_lines = [normalize_line_name(segment["line_short"]) for segment in amap_segments]
    return {
        "local_lines": local_lines,
        "amap_lines": amap_lines,
        "lines_match": local_lines == amap_lines,
    }


def compare(local_result, amap_result, config):
    if local_result.get("error") and amap_result.get("error"):
        return {"error": "Both failed", "local_error": local_result["error"], "amap_error": amap_result["error"]}

    amap_scheme = None
    if not amap_result.get("error") and amap_result.get("schemes"):
        amap_scheme = amap_result["schemes"][0]

    result = {
        "local_ok": not local_result.get("error"),
        "amap_ok": amap_scheme is not None,
    }

    if local_result.get("error"):
        result["local_error"] = local_result["error"]
    if amap_result.get("error"):
        result["amap_error"] = amap_result["error"]
    if not result["local_ok"] and not result["amap_ok"]:
        return result

    if result["local_ok"]:
        local_station_set = get_local_station_set(local_result)
        result["local_time_min"] = local_result["total_time"] + config.WAIT_TIME_MIN
        result["local_base_time_min"] = local_result["total_time"]
        result["local_transfers"] = local_result["transfers"]
        result["local_station_count"] = local_result["station_count"]
        result["local_segments"] = local_result.get("segments", [])
        result["local_transfer_stations"] = local_result.get("transfer_stations", [])

    if result["amap_ok"]:
        amap_station_set = get_amap_station_set(amap_scheme)
        result["amap_time_min"] = amap_scheme["duration_sec"] / 60.0
        result["amap_walking_m"] = amap_scheme["walking_distance_m"]
        result["amap_transfers"] = amap_scheme["metro_transfers"]
        result["amap_transfer_stations"] = amap_scheme["transfer_stations"]
        result["amap_metro_segments"] = amap_scheme["metro_segments"]
        result["amap_has_non_metro"] = amap_scheme["has_non_metro"]
        result["amap_station_count"] = len(amap_station_set)

    if result["local_ok"] and result["amap_ok"]:
        result["time_diff_min"] = result["local_time_min"] - result["amap_time_min"]
        result["time_diff_pct"] = (result["time_diff_min"] / result["amap_time_min"] * 100) if result["amap_time_min"] else 0
        result["transfer_diff"] = result["local_transfers"] - result["amap_transfers"]
        result["station_diff"] = result["local_station_count"] - result["amap_station_count"]
        result["walking_diff_m"] = -result["amap_walking_m"]
        result["jaccard"] = jaccard_index(local_station_set, amap_station_set)
        result["transfer_comparison"] = compare_transfer_stations(result["local_transfer_stations"], result["amap_transfer_stations"])
        result["line_comparison"] = compare_segment_lines(result["local_segments"], result["amap_metro_segments"])

    return result

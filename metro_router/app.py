import argparse
import copy
import json
import os
import platform
import subprocess
import tempfile
from datetime import datetime

from flask import Flask, jsonify, render_template, request

app = Flask(__name__)

DATA_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "data")
CORE_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "core")

GRAPH_FILE = os.path.join(DATA_DIR, "graph.txt")
STATIONS_FILE = os.path.join(DATA_DIR, "stations.json")
ROUTES_FILE = os.path.join(DATA_DIR, "routes.json")

if platform.system() == "Windows":
    EXE_PATH = os.path.join(CORE_DIR, "metro_router.exe")
else:
    EXE_PATH = os.path.join(CORE_DIR, "metro_router")

MODE_LABELS = {
    "0": "时间最短",
    "1": "换乘最少",
    "2": "综合最优",
}

DEFAULT_PERIODS = [
    {"id": "morning_peak", "name": "早高峰", "start": "07:00", "end": "09:30", "type": "peak"},
    {"id": "evening_peak", "name": "晚高峰", "start": "17:00", "end": "19:30", "type": "peak"},
    {"id": "midday", "name": "午间平峰", "start": "09:30", "end": "17:00", "type": "offpeak"},
    {"id": "morning_offpeak", "name": "早间平峰", "start": "06:00", "end": "07:00", "type": "offpeak"},
    {"id": "evening_offpeak", "name": "晚间平峰", "start": "19:30", "end": "23:00", "type": "offpeak"},
]

DEFAULT_MULTIPLIERS = {
    "peak": {"run": 1.3, "transfer": 1.5},
    "offpeak": {"run": 1.0, "transfer": 1.0},
}

CORE_SOURCE_FILES = [
    os.path.join(CORE_DIR, "main.c"),
    os.path.join(CORE_DIR, "dijkstra.c"),
    os.path.join(CORE_DIR, "graph.c"),
    os.path.join(CORE_DIR, "min_heap.c"),
    os.path.join(CORE_DIR, "graph.h"),
    os.path.join(CORE_DIR, "dijkstra.h"),
    os.path.join(CORE_DIR, "min_heap.h"),
]


def load_graph_json(path):
    with open(path, "r", encoding="utf-8") as f:
        header = f.readline().strip().split()
        if len(header) != 2:
            raise ValueError("Invalid graph header")

        node_count = int(header[0])
        edge_count = int(header[1])

        nodes = []
        for _ in range(node_count):
            parts = f.readline().strip().split()
            if len(parts) != 5:
                raise ValueError("Invalid graph node line")
            node_id, station, line, lon, lat = parts
            nodes.append(
                {
                    "id": int(node_id),
                    "station": station,
                    "line": line,
                    "lon": float(lon),
                    "lat": float(lat),
                }
            )

        edges = []
        for _ in range(edge_count):
            parts = f.readline().strip().split()
            if len(parts) != 5:
                raise ValueError("Invalid graph edge line")
            from_id, to_id, weight, line_name, is_transfer = parts
            edges.append(
                {
                    "from": int(from_id),
                    "to": int(to_id),
                    "weight": float(weight),
                    "line": line_name,
                    "is_transfer": int(is_transfer),
                }
            )

    return {"nodes": nodes, "edges": edges}


with open(STATIONS_FILE, "r", encoding="utf-8") as f:
    stations_data = json.load(f)

with open(ROUTES_FILE, "r", encoding="utf-8") as f:
    routes_data = json.load(f)

graph_data = load_graph_json(GRAPH_FILE)
station_names = {station["name"] for station in stations_data["stations"]}


def core_build_is_current():
    if not os.path.exists(EXE_PATH):
        return False

    exe_mtime = os.path.getmtime(EXE_PATH)
    for source_path in CORE_SOURCE_FILES:
        if os.path.exists(source_path) and os.path.getmtime(source_path) > exe_mtime:
            return False
    return True


def time_to_minutes(value):
    hour, minute = value.split(":")
    return int(hour) * 60 + int(minute)


def normalize_schedule_config(schedule_config=None):
    config = {
        "periods": copy.deepcopy(DEFAULT_PERIODS),
        "multipliers": copy.deepcopy(DEFAULT_MULTIPLIERS),
        "lineOverrides": {},
        "mode": "auto",
        "manualPeriodId": "midday",
        "simulatedTime": None,
    }

    if not schedule_config:
        return config

    if isinstance(schedule_config.get("periods"), list) and schedule_config["periods"]:
        config["periods"] = schedule_config["periods"]

    if isinstance(schedule_config.get("multipliers"), dict):
        for period_type, values in schedule_config["multipliers"].items():
            if not isinstance(values, dict):
                continue
            config["multipliers"].setdefault(period_type, {})
            if "run" in values:
                config["multipliers"][period_type]["run"] = float(values["run"])
            if "transfer" in values:
                config["multipliers"][period_type]["transfer"] = float(values["transfer"])

    if isinstance(schedule_config.get("lineOverrides"), dict):
        config["lineOverrides"] = schedule_config["lineOverrides"]

    if schedule_config.get("mode") in {"auto", "manual"}:
        config["mode"] = schedule_config["mode"]

    if schedule_config.get("manualPeriodId"):
        config["manualPeriodId"] = str(schedule_config["manualPeriodId"])

    if schedule_config.get("simulatedTime"):
        config["simulatedTime"] = str(schedule_config["simulatedTime"])

    return config


def get_current_period(schedule_config):
    periods = schedule_config["periods"]

    if schedule_config["mode"] == "manual":
        for period in periods:
            if period["id"] == schedule_config["manualPeriodId"]:
                return period
        return periods[0]

    if schedule_config["simulatedTime"]:
        current_minutes = time_to_minutes(schedule_config["simulatedTime"])
    else:
        now = datetime.now()
        current_minutes = now.hour * 60 + now.minute

    for period in periods:
        if time_to_minutes(period["start"]) <= current_minutes < time_to_minutes(period["end"]):
            return period

    return {"id": "closed", "name": "非运营时段", "start": "23:00", "end": "06:00", "type": "offpeak"}


def get_weight_factor(schedule_config, line_name, is_transfer):
    period = get_current_period(schedule_config)
    period_type = period.get("type", "offpeak")
    base = schedule_config["multipliers"].get(period_type, DEFAULT_MULTIPLIERS["offpeak"])
    factor = float(base["transfer"] if is_transfer else base["run"])

    line_overrides = schedule_config.get("lineOverrides", {})
    override = line_overrides.get(line_name, {}).get(period_type, {})
    if is_transfer and "transfer" in override:
        factor = float(override["transfer"])
    if (not is_transfer) and "run" in override:
        factor = float(override["run"])

    return factor


def build_adjusted_graph(schedule_config=None, penalty_stations=None, penalty_weight=0.0):
    schedule = normalize_schedule_config(schedule_config)
    penalty_stations = set(penalty_stations or [])
    node_map = {node["id"]: node for node in graph_data["nodes"]}

    adjusted = {
        "nodes": copy.deepcopy(graph_data["nodes"]),
        "edges": [],
        "current_period": get_current_period(schedule),
    }

    for edge in graph_data["edges"]:
        adjusted_edge = copy.deepcopy(edge)
        factor = get_weight_factor(schedule, adjusted_edge["line"], adjusted_edge["is_transfer"] == 1)
        adjusted_edge["weight"] = round(adjusted_edge["weight"] * factor, 2)

        from_station = node_map[adjusted_edge["from"]]["station"]
        if from_station in penalty_stations:
            adjusted_edge["weight"] = round(adjusted_edge["weight"] + penalty_weight, 2)

        adjusted["edges"].append(adjusted_edge)

    return adjusted


def write_graph_file(graph_json, path):
    with open(path, "w", encoding="utf-8") as f:
        f.write(f"{len(graph_json['nodes'])} {len(graph_json['edges'])}\n")
        for node in graph_json["nodes"]:
            f.write(
                f"{node['id']} {node['station']} {node['line']} "
                f"{node['lon']:.6f} {node['lat']:.6f}\n"
            )
        for edge in graph_json["edges"]:
            f.write(
                f"{edge['from']} {edge['to']} {edge['weight']:.6f} "
                f"{edge['line']} {edge['is_transfer']}\n"
            )


def build_itinerary(path, transfer_stations):
    if not path:
        return []

    steps = []
    current_line = path[0]["line"]
    current_stations = [path[0]["station"]]

    for i in range(1, len(path)):
        prev_node = path[i - 1]
        node = path[i]

        if node["station"] == prev_node["station"] and node["line"] != prev_node["line"]:
            if len(current_stations) > 1:
                steps.append(
                    {
                        "type": "ride",
                        "line": current_line,
                        "from": current_stations[0],
                        "to": current_stations[-1],
                        "station_count": len(current_stations),
                        "stations": current_stations[:],
                    }
                )
            steps.append(
                {
                    "type": "transfer",
                    "station": node["station"],
                    "from_line": prev_node["line"],
                    "to_line": node["line"],
                    "is_key_transfer": node["station"] in transfer_stations,
                }
            )
            current_line = node["line"]
            current_stations = [node["station"]]
            continue

        if current_stations[-1] != node["station"]:
            current_stations.append(node["station"])

    if len(current_stations) > 1:
        steps.append(
            {
                "type": "ride",
                "line": current_line,
                "from": current_stations[0],
                "to": current_stations[-1],
                "station_count": len(current_stations),
                "stations": current_stations[:],
            }
        )

    return steps


def build_segments(path):
    if not path:
        return []

    segments = []
    start_idx = 0
    for idx in range(1, len(path)):
        if path[idx]["line"] != path[start_idx]["line"]:
            stations = []
            for station_idx in range(start_idx, idx):
                if not stations or stations[-1] != path[station_idx]["station"]:
                    stations.append(path[station_idx]["station"])
            segments.append(
                {
                    "line": path[start_idx]["line"],
                    "from": path[start_idx]["station"],
                    "to": path[idx - 1]["station"],
                    "stations": stations,
                }
            )
            start_idx = idx

    stations = []
    for station_idx in range(start_idx, len(path)):
        if not stations or stations[-1] != path[station_idx]["station"]:
            stations.append(path[station_idx]["station"])
    segments.append(
        {
            "line": path[start_idx]["line"],
            "from": path[start_idx]["station"],
            "to": path[-1]["station"],
            "stations": stations,
        }
    )

    return segments


def enrich_result(result, mode, schedule_config=None):
    if result.get("error"):
        return result

    transfer_stations = set(result.get("transfer_stations", []))
    unique_path = []
    last_station = None
    for node in result.get("path", []):
        if node["station"] != last_station:
            unique_path.append(node)
            last_station = node["station"]

    itinerary = build_itinerary(result.get("path", []), transfer_stations)
    result["mode"] = str(mode)
    result["mode_label"] = MODE_LABELS.get(str(mode), "综合最优")
    result["unique_path"] = unique_path
    result["itinerary"] = itinerary
    result["lines_used"] = [step["line"] for step in itinerary if step["type"] == "ride"]
    result["segments"] = build_segments(result.get("path", []))
    result["schedule"] = normalize_schedule_config(schedule_config) if schedule_config else normalize_schedule_config()
    result["current_period"] = get_current_period(result["schedule"])
    return result


def python_dijkstra(graph_json, start, end, mode, penalty_stations=None, penalty_weight=0.0):
    nodes = graph_json["nodes"]
    edges = graph_json["edges"]
    adj_list = {}
    for node in nodes:
        adj_list[node["id"]] = []
    for edge in edges:
        adj_list[edge["from"]].append(edge)

    start_nodes = [node["id"] for node in nodes if node["station"] == start]
    end_nodes = {node["id"] for node in nodes if node["station"] == end}
    if not start_nodes or not end_nodes:
        return {"error": "未找到可用路径"}

    penalty_stations = set(penalty_stations or [])
    inf = float("inf")
    dist = [inf] * len(nodes)
    cost_arr = [inf] * len(nodes)
    time_arr = [0.0] * len(nodes)
    transfer_arr = [0] * len(nodes)
    prev = [-1] * len(nodes)
    visited = [False] * len(nodes)
    heap = []

    for node_id in start_nodes:
        dist[node_id] = 0.0
        cost_arr[node_id] = 0.0
        heap.append((0.0, node_id))

    import heapq

    heapq.heapify(heap)
    found_node = -1

    while heap:
        _, current = heapq.heappop(heap)
        if visited[current]:
            continue
        visited[current] = True
        if current in end_nodes:
            found_node = current
            break

        for edge in adj_list.get(current, []):
            neighbor = edge["to"]
            if visited[neighbor]:
                continue

            edge_penalty = 0.0
            if nodes[current]["station"] in penalty_stations:
                edge_penalty = penalty_weight

            new_time = time_arr[current] + edge["weight"]
            new_transfers = transfer_arr[current] + edge["is_transfer"]
            penalized_time = new_time + edge_penalty

            if str(mode) == "0":
                new_cost = penalized_time
            elif str(mode) == "1":
                new_cost = float(new_transfers) + penalized_time * 1e-6
            else:
                new_cost = penalized_time * 1000.0 + float(new_transfers)

            if new_cost < cost_arr[neighbor]:
                cost_arr[neighbor] = new_cost
                dist[neighbor] = penalized_time
                time_arr[neighbor] = new_time
                transfer_arr[neighbor] = new_transfers
                prev[neighbor] = current
                heapq.heappush(heap, (new_cost, neighbor))

    if found_node < 0:
        return {"error": "未找到可用路径"}

    path_ids = []
    cursor = found_node
    while cursor != -1:
        path_ids.append(cursor)
        cursor = prev[cursor]
    path_ids.reverse()

    path = []
    transfer_stations = []
    unique_station_count = 0
    last_station = None
    for idx, node_id in enumerate(path_ids):
        node = nodes[node_id]
        path.append(
            {
                "station": node["station"],
                "line": node["line"],
                "lon": node["lon"],
                "lat": node["lat"],
            }
        )
        if node["station"] != last_station:
            unique_station_count += 1
            last_station = node["station"]
        if idx > 0:
            prev_node = nodes[path_ids[idx - 1]]
            if node["station"] == prev_node["station"] and node["line"] != prev_node["line"]:
                transfer_stations.append(node["station"])

    return {
        "path": path,
        "total_time": round(time_arr[found_node], 2),
        "transfers": transfer_arr[found_node],
        "transfer_stations": transfer_stations,
        "station_count": unique_station_count,
    }


def run_c_query(start, end, mode, graph_path):
    try:
        result = subprocess.run(
            [EXE_PATH, graph_path, str(mode)],
            input=f"{start}\n{end}\n",
            capture_output=True,
            text=True,
            encoding="utf-8",
            timeout=10,
        )
    except (FileNotFoundError, OSError) as exc:
        return {"error": f"Failed to start core program: {exc}"}, 500

    stdout = result.stdout.strip()
    stderr = result.stderr.strip()
    if result.returncode == -1073741515:
        return {
            "error": (
                "Core program failed with Windows status 0xC0000135 "
                "(STATUS_DLL_NOT_FOUND). Rebuild metro_router.exe on this machine."
            )
        }, 500

    if not stdout:
        if result.returncode == 0:
            return {"error": "Core program exited successfully but produced no stdout."}, 500
        return {"error": stderr or "Core program failed"}, 500

    try:
        payload = json.loads(stdout)
    except json.JSONDecodeError:
        return {"error": "Invalid response from core program"}, 500

    if result.returncode != 0 and payload.get("error"):
        status_code = 404 if payload["error"] == "No path found" else 500
        return payload, status_code

    status_code = 200 if not payload.get("error") else 404
    return payload, status_code


def run_query(start, end, mode, schedule_config=None, penalty_stations=None, penalty_weight=10000.0):
    if not start or not end:
        return {"error": "Missing start or end parameter"}, 400
    if start not in station_names:
        return {"error": f"Unknown start station: {start}"}, 400
    if end not in station_names:
        return {"error": f"Unknown end station: {end}"}, 400
    if str(mode) not in {"0", "1", "2"}:
        return {"error": "mode must be 0, 1, or 2"}, 400

    graph_path = GRAPH_FILE
    temp_path = None

    try:
        if not core_build_is_current():
            return {"error": "Core executable is missing or outdated. Rebuild metro_router.exe first."}, 500

        adjusted_graph = None
        if schedule_config or penalty_stations:
            adjusted_graph = build_adjusted_graph(schedule_config, penalty_stations, penalty_weight)
            temp_file = tempfile.NamedTemporaryFile(
                mode="w",
                suffix=".txt",
                prefix="graph_query_",
                dir=DATA_DIR,
                delete=False,
                encoding="utf-8",
            )
            temp_path = temp_file.name
            temp_file.close()
            write_graph_file(adjusted_graph, temp_path)
            graph_path = temp_path

        payload, status_code = run_c_query(start, end, mode, graph_path)
        if payload.get("error"):
            return payload, status_code

        return enrich_result(payload, mode, schedule_config), status_code
    except subprocess.TimeoutExpired:
        return {"error": "Core query timeout"}, 500
    finally:
        if temp_path and os.path.exists(temp_path):
            os.remove(temp_path)


def results_are_similar(existing, candidate):
    if abs(existing["total_time"] - candidate["total_time"]) >= 0.01:
        return False
    if existing["transfers"] != candidate["transfers"]:
        return False

    same_count = 0
    min_len = min(len(existing["path"]), len(candidate["path"]))
    max_len = max(len(existing["path"]), len(candidate["path"]))
    if max_len == 0:
        return True

    for idx in range(min_len):
        left = existing["path"][idx]
        right = candidate["path"][idx]
        if left["station"] == right["station"] and left["line"] == right["line"]:
            same_count += 1

    return same_count / max_len > 0.8


def find_alternative_paths(start, end, mode, schedule_config=None):
    primary, status_code = run_query(start, end, mode, schedule_config=schedule_config)
    if status_code != 200:
        return {"error": primary.get("error", "查询失败")}, status_code

    results = [{"label": "最优方案", "data": primary}]
    start_station = primary["path"][0]["station"]
    end_station = primary["path"][-1]["station"]

    mid_stations = []
    seen = set()
    for node in primary["path"][1:-1]:
        station = node["station"]
        if station not in seen and station not in {start_station, end_station}:
            seen.add(station)
            mid_stations.append(station)

    for station in mid_stations:
        if len(results) >= 5:
            break

        candidate, candidate_status = run_query(
            start,
            end,
            mode,
            schedule_config=schedule_config,
            penalty_stations={station},
            penalty_weight=10000.0,
        )
        if candidate_status != 200 or candidate.get("error"):
            continue

        if any(results_are_similar(existing["data"], candidate) for existing in results):
            continue

        results.append({"label": f"备选方案", "data": candidate})

    results.sort(key=lambda item: (item["data"]["total_time"], item["data"]["transfers"]))
    if results:
        results[0]["label"] = "最优方案"
    for idx in range(1, len(results)):
        results[idx]["label"] = f"备选方案 {idx}"

    return {"results": results, "selected_index": 0}, 200


@app.route("/")
def index():
    return render_template("index.html")


@app.route("/api/graph")
def api_graph():
    return jsonify(graph_data)


@app.route("/api/stations")
def api_stations():
    return jsonify(stations_data)


@app.route("/api/routes")
def api_routes():
    return jsonify(routes_data)


@app.route("/api/path", methods=["GET", "POST"])
def api_path():
    if request.method == "POST":
        body = request.get_json(silent=True) or {}
        start = body.get("start", "")
        end = body.get("end", "")
        mode = str(body.get("mode", "0"))
        schedule_config = body.get("schedule_config")
    else:
        start = request.args.get("start", "")
        end = request.args.get("end", "")
        mode = request.args.get("mode", "0")
        schedule_config = None

    payload, status_code = run_query(start, end, mode, schedule_config=schedule_config)
    return jsonify(payload), status_code


@app.route("/api/query", methods=["POST"])
def api_query():
    body = request.get_json(silent=True) or {}
    start = body.get("start", "")
    end = body.get("end", "")
    mode = str(body.get("mode", "2"))
    schedule_config = body.get("schedule_config")
    include_alternatives = bool(body.get("include_alternatives", True))

    if include_alternatives:
        payload, status_code = find_alternative_paths(start, end, mode, schedule_config=schedule_config)
    else:
        result, status_code = run_query(start, end, mode, schedule_config=schedule_config)
        if status_code == 200:
            payload = {"results": [{"label": "最优方案", "data": result}], "selected_index": 0}
        else:
            payload = result

    return jsonify(payload), status_code


@app.route("/api/compare", methods=["GET", "POST"])
def api_compare():
    if request.method == "POST":
        body = request.get_json(silent=True) or {}
        start = body.get("start", "")
        end = body.get("end", "")
        schedule_config = body.get("schedule_config")
    else:
        start = request.args.get("start", "")
        end = request.args.get("end", "")
        schedule_config = None

    time_result, time_status = run_query(start, end, "0", schedule_config=schedule_config)
    if time_status != 200:
        return jsonify(time_result), time_status

    transfer_result, transfer_status = run_query(start, end, "1", schedule_config=schedule_config)
    if transfer_status != 200:
        return jsonify(transfer_result), transfer_status

    balanced_result, balanced_status = run_query(start, end, "2", schedule_config=schedule_config)
    if balanced_status != 200:
        return jsonify(balanced_result), balanced_status

    return jsonify(
        {
            "start": start,
            "end": end,
            "time_shortest": time_result,
            "transfer_priority": transfer_result,
            "balanced": balanced_result,
        }
    )


def parse_args():
    parser = argparse.ArgumentParser(description="Start the metro router web server.")
    parser.add_argument("--host", default="127.0.0.1")
    parser.add_argument("--port", type=int, default=5000)
    parser.add_argument("--no-debug", action="store_true", help="Disable Flask debug mode.")
    return parser.parse_args()


if __name__ == "__main__":
    args = parse_args()
    debug = not args.no_debug
    app.run(host=args.host, debug=debug, use_reloader=debug, port=args.port)

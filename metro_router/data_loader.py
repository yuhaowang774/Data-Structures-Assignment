import geopandas as gpd
import pandas as pd
import json
import re
import os

BASE_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'CPTOND-2025', 'dataset', 'metro', 'shapefiles', 'sian')
OUTPUT_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'data')
SPEED_KMH = 40.0
TRANSFER_TIME_MIN = 2.0

LINE_COLORS = {
    '地铁1号线': '#00A650',
    '地铁2号线': '#E60012',
    '地铁3号线': '#8FC31F',
    '地铁4号线': '#7B2D8E',
    '地铁5号线': '#00B7EE',
    '地铁6号线': '#D5A216',
    '地铁9号线': '#FF6A00',
    '地铁10号线': '#008C95',
    '地铁14号线': '#8B5CF6',
    '地铁16号线': '#E91E8C',
    '西咸新区智轨示范线1号线': '#999999',
}

def extract_line_name(route_cn):
    m = re.match(r'(地铁\d+号线|西咸新区智轨示范线\d+号线)', route_cn)
    return m.group(1) if m else route_cn.split('(')[0]

def load_data():
    stops = gpd.read_file(os.path.join(BASE_DIR, 'sian_metro_stops.shp'), encoding='utf-8')
    segments = gpd.read_file(os.path.join(BASE_DIR, 'sian_metro_segments.shp'), encoding='utf-8')
    stops_unique = gpd.read_file(os.path.join(BASE_DIR, 'sian_metro_stops_unique.shp'), encoding='utf-8')
    return stops, segments, stops_unique

def build_graph(stops, segments):
    stops['line_short'] = stops['route_cn'].apply(extract_line_name)

    line_directions = {}
    for _, row in stops.iterrows():
        key = row['line_short']
        if key not in line_directions:
            line_directions[key] = row['route_cn']
    forward_route_cns = set(line_directions.values())
    stops_forward = stops[stops['route_cn'].isin(forward_route_cns)].copy()
    dedup = stops_forward.drop_duplicates(subset=['name_cn', 'line_short'])
    dedup = dedup.sort_values(['line_short', 'sequence'])

    nodes = []
    node_map = {}
    idx = 0
    for _, row in dedup.iterrows():
        key = (row['name_cn'], row['line_short'])
        if key not in node_map:
            node_map[key] = idx
            nodes.append({
                'id': idx,
                'station': row['name_cn'],
                'line': row['line_short'],
                'lon': row.geometry.x,
                'lat': row.geometry.y,
            })
            idx += 1

    seg_dist = {}
    for _, row in segments.iterrows():
        key = tuple(sorted([row['s_stop_cn'], row['e_stop_cn']]))
        seg_dist[key] = float(row['distance'])

    edges = []
    for line_name, group in dedup.groupby('line_short'):
        group = group.sort_values('sequence')
        stations = group['name_cn'].tolist()
        for i in range(len(stations) - 1):
            s1, s2 = stations[i], stations[i + 1]
            key = tuple(sorted([s1, s2]))
            dist_km = seg_dist.get(key, 1.5)
            weight = dist_km / SPEED_KMH * 60.0
            from_id = node_map[(s1, line_name)]
            to_id = node_map[(s2, line_name)]
            edges.append({
                'from': from_id,
                'to': to_id,
                'weight': round(weight, 2),
                'line': line_name,
                'is_transfer': 0,
            })
            edges.append({
                'from': to_id,
                'to': from_id,
                'weight': round(weight, 2),
                'line': line_name,
                'is_transfer': 0,
            })

    station_lines = {}
    for node in nodes:
        station_lines.setdefault(node['station'], []).append(node['line'])

    for station, lines in station_lines.items():
        if len(lines) > 1:
            for i in range(len(lines)):
                for j in range(i + 1, len(lines)):
                    id_a = node_map[(station, lines[i])]
                    id_b = node_map[(station, lines[j])]
                    edges.append({
                        'from': id_a,
                        'to': id_b,
                        'weight': TRANSFER_TIME_MIN,
                        'line': '换乘',
                        'is_transfer': 1,
                    })
                    edges.append({
                        'from': id_b,
                        'to': id_a,
                        'weight': TRANSFER_TIME_MIN,
                        'line': '换乘',
                        'is_transfer': 1,
                    })

    return nodes, edges, node_map

def write_graph_txt(nodes, edges, filepath):
    with open(filepath, 'w', encoding='utf-8') as f:
        f.write(f"{len(nodes)} {len(edges)}\n")
        for node in nodes:
            f.write(f"{node['id']} {node['station']} {node['line']} {node['lon']:.6f} {node['lat']:.6f}\n")
        for edge in edges:
            f.write(f"{edge['from']} {edge['to']} {edge['weight']:.2f} {edge['line']} {edge['is_transfer']}\n")

def write_stations_json(nodes, filepath):
    station_map = {}
    for node in nodes:
        s = station_map.setdefault(node['station'], {
            'name': node['station'],
            'lat': node['lat'],
            'lon': node['lon'],
            'lines': [],
            'is_transfer': False,
        })
        if node['line'] not in s['lines']:
            s['lines'].append(node['line'])
    for s in station_map.values():
        s['is_transfer'] = len(s['lines']) > 1
    data = {'stations': sorted(station_map.values(), key=lambda x: x['name'])}
    with open(filepath, 'w', encoding='utf-8') as f:
        json.dump(data, f, ensure_ascii=False, indent=2)

def write_routes_json(nodes, filepath):
    route_map = {}
    for node in nodes:
        route_map.setdefault(node['line'], []).append({
            'name': node['station'],
            'lat': node['lat'],
            'lon': node['lon'],
        })
    routes = []
    for line_name, stations in route_map.items():
        routes.append({
            'name': line_name,
            'color': LINE_COLORS.get(line_name, '#666666'),
            'stations': stations,
        })
    with open(filepath, 'w', encoding='utf-8') as f:
        json.dump({'routes': routes}, f, ensure_ascii=False, indent=2)

def main():
    os.makedirs(OUTPUT_DIR, exist_ok=True)
    print("Loading Shapefile data...")
    stops, segments, stops_unique = load_data()
    print(f"  Stops: {len(stops)}, Segments: {len(segments)}")

    print("Building graph...")
    nodes, edges, node_map = build_graph(stops, segments)
    print(f"  Nodes: {len(nodes)}, Edges: {len(edges)}")

    transfer_count = sum(1 for n in nodes if any(
        n['station'] == other['station'] and n['line'] != other['line']
        for other in nodes
    )) // 2
    print(f"  Transfer stations: ~{transfer_count}")

    write_graph_txt(nodes, edges, os.path.join(OUTPUT_DIR, 'graph.txt'))
    write_stations_json(nodes, os.path.join(OUTPUT_DIR, 'stations.json'))
    write_routes_json(nodes, os.path.join(OUTPUT_DIR, 'routes.json'))
    print("Done! Files written to data/")

if __name__ == '__main__':
    main()

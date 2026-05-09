import geopandas as gpd
import pandas as pd
from shapely.geometry import Point, LineString
import os
import copy

PYTHON_PATH = r"C:\Users\WYH01\AppData\Local\Programs\Python\Python310\python.exe"
BASE_DIR = r"c:\Users\WYH01\Desktop\数据结构课程作业\CPTOND-2025\dataset\metro\shapefiles\sian"
OUTPUT_DIR = BASE_DIR

LINE8_STATIONS = [
    {"name_cn": "山门口", "name_en": "Shanmenkou", "lat": 34.199812, "lon": 108.900269, "transfer": "7号线(规划)"},
    {"name_cn": "安化门", "name_en": "Anhuamen", "lat": 34.200044, "lon": 108.914946, "transfer": None},
    {"name_cn": "东仪路", "name_en": "Dongyilu", "lat": 34.200126, "lon": 108.923619, "transfer": "11号线(规划)"},
    {"name_cn": "电视塔", "name_en": "Dianshita", "lat": 34.199669, "lon": 108.942059, "transfer": "2号线"},
    {"name_cn": "大唐不夜城", "name_en": "Datangbuyecheng", "lat": 34.198413, "lon": 108.959295, "transfer": None},
    {"name_cn": "曲江池西", "name_en": "Qujiangchixi", "lat": 34.198993, "lon": 108.970705, "transfer": "4号线"},
    {"name_cn": "寒窑", "name_en": "Hanyao", "lat": 34.201559, "lon": 108.983774, "transfer": None},
    {"name_cn": "新开门", "name_en": "Xinkaimen", "lat": 34.201477, "lon": 108.993555, "transfer": None},
    {"name_cn": "缪家寨", "name_en": "Miaojiazhai", "lat": 34.209181, "lon": 109.008507, "transfer": None},
    {"name_cn": "植物园", "name_en": "Zhiwuyuan", "lat": 34.211646, "lon": 109.020133, "transfer": None},
    {"name_cn": "马腾空", "name_en": "Matengkong", "lat": 34.220860, "lon": 109.022673, "transfer": "5号线"},
    {"name_cn": "东等驾坡", "name_en": "Dongdengjiapo", "lat": 34.230243, "lon": 109.015003, "transfer": None},
    {"name_cn": "西等驾坡", "name_en": "Xidengjiapo", "lat": 34.242633, "lon": 109.009349, "transfer": None},
    {"name_cn": "万寿南路", "name_en": "Wanshounanlu", "lat": 34.252561, "lon": 109.009834, "transfer": "6号线"},
    {"name_cn": "韩森寨", "name_en": "Hansenzhai", "lat": 34.260364, "lon": 109.009310, "transfer": None},
    {"name_cn": "万寿路", "name_en": "Wanshoulu", "lat": 34.270895, "lon": 109.008759, "transfer": "1号线"},
    {"name_cn": "幸福林带北", "name_en": "Xingfulindai Bei", "lat": 34.283632, "lon": 109.009360, "transfer": None},
    {"name_cn": "米家崖", "name_en": "Mijiaya", "lat": 34.304030, "lon": 109.010294, "transfer": None},
    {"name_cn": "广泰门", "name_en": "Guangtaimen", "lat": 34.312740, "lon": 109.009137, "transfer": "3号线"},
    {"name_cn": "北辰东路", "name_en": "Beichendonglu", "lat": 34.318643, "lon": 108.998326, "transfer": None},
    {"name_cn": "井上村", "name_en": "Jingshangcun", "lat": 34.318619, "lon": 108.979062, "transfer": "10号线"},
    {"name_cn": "余家寨", "name_en": "Yujiazhai", "lat": 34.318722, "lon": 108.967112, "transfer": "4号线"},
    {"name_cn": "市第三医院", "name_en": "Shi Di San Yiyuan", "lat": 34.319460, "lon": 108.955618, "transfer": None},
    {"name_cn": "市图书馆", "name_en": "Shi Tushuguan", "lat": 34.319365, "lon": 108.942673, "transfer": "2号线"},
    {"name_cn": "霸城门", "name_en": "Bachengmen", "lat": 34.319440, "lon": 108.925121, "transfer": None},
    {"name_cn": "大风阁", "name_en": "Dafengge", "lat": 34.303679, "lon": 108.918548, "transfer": None},
    {"name_cn": "红庙坡", "name_en": "Hongmiaopo", "lat": 34.291772, "lon": 108.917670, "transfer": None},
    {"name_cn": "景曜门", "name_en": "Jingyaomen", "lat": 34.286446, "lon": 108.908542, "transfer": None},
    {"name_cn": "光化门", "name_en": "Guanghuamen", "lat": 34.288028, "lon": 108.897862, "transfer": None},
    {"name_cn": "白家口", "name_en": "Baijiakou", "lat": 34.283525, "lon": 108.886785, "transfer": None},
    {"name_cn": "开远门", "name_en": "Kaiyuanmen", "lat": 34.271429, "lon": 108.886998, "transfer": "1号线"},
    {"name_cn": "土门", "name_en": "Tumen", "lat": 34.261021, "lon": 108.884799, "transfer": None},
    {"name_cn": "金光门", "name_en": "Jinguangmen", "lat": 34.253358, "lon": 108.884313, "transfer": "5号线"},
    {"name_cn": "延平门", "name_en": "Yanpingmen", "lat": 34.238519, "lon": 108.883066, "transfer": "3号线"},
    {"name_cn": "科技二路", "name_en": "Keji Er Lu", "lat": 34.227263, "lon": 108.884955, "transfer": None},
    {"name_cn": "木塔寺西", "name_en": "Mutasi Xi", "lat": 34.214059, "lon": 108.885084, "transfer": None},
    {"name_cn": "省体育馆", "name_en": "Sheng Tiyuguan", "lat": 34.204719, "lon": 108.885261, "transfer": "6号线"},
]

LINE15_STATIONS = [
    {"name_cn": "细柳", "name_en": "Xiliu", "lat": 34.161394, "lon": 108.787622, "transfer": None},
    {"name_cn": "府君庙", "name_en": "Fujunmiao", "lat": 34.161359, "lon": 108.800297, "transfer": None},
    {"name_cn": "祝村西", "name_en": "Zhucun Xi", "lat": 34.161394, "lon": 108.813868, "transfer": "12号线(规划)"},
    {"name_cn": "祝村", "name_en": "Zhucun", "lat": 34.161420, "lon": 108.830374, "transfer": None},
    {"name_cn": "郭杜西", "name_en": "Guodu Xi", "lat": 34.161512, "lon": 108.842148, "transfer": "6号线"},
    {"name_cn": "郭杜", "name_en": "Guodu", "lat": 34.161207, "lon": 108.859176, "transfer": None},
    {"name_cn": "樱花广场", "name_en": "Yinghua Guangchang", "lat": 34.161251, "lon": 108.874039, "transfer": None},
    {"name_cn": "邮电大学", "name_en": "Youdian Daxue", "lat": 34.159446, "lon": 108.898798, "transfer": "7号线(规划)"},
    {"name_cn": "长安广场", "name_en": "Chang'an Guangchang", "lat": 34.158555, "lon": 108.924107, "transfer": None},
    {"name_cn": "航天城", "name_en": "Hangtiancheng", "lat": 34.159636, "lon": 108.939947, "transfer": "2号线"},
    {"name_cn": "皇子坡", "name_en": "Huangzipo", "lat": 34.156050, "lon": 108.956871, "transfer": None},
    {"name_cn": "东长安街", "name_en": "Dong Chang'an Jie", "lat": 34.155770, "lon": 108.970090, "transfer": "4号线"},
    {"name_cn": "东兆余", "name_en": "Dongzhaoyu", "lat": 34.156869, "lon": 108.991571, "transfer": None},
]

LINE8_INFO = {
    "route_cn_inner": "地铁8号线(内环)",
    "route_en_inner": "Metro Line 8 (Inner Loop)",
    "route_cn_outer": "地铁8号线(外环)",
    "route_en_outer": "Metro Line 8 (Outer Loop)",
    "city_code": "029",
    "route_type": "地铁",
    "type_en": "subway",
    "company_cn": "西安市轨道交通集团",
    "company_en": "Xi'an Rail Transit Group",
    "s_stop_cn": "山门口",
    "s_stop_en": "Shanmenkou",
    "e_stop_cn": "山门口",
    "e_stop_en": "Shanmenkou",
    "distance": 49.896,
    "total_stop": 37,
    "start_time": "0610",
    "end_time": "2300",
    "loop": 1,
    "status": 1,
    "basic_prc": 2,
    "total_prc": 6,
    "city_cn": "西安",
    "city_en": "sian",
}

LINE15_INFO = {
    "route_cn_forward": "地铁15号线(细柳--东兆余)",
    "route_en_forward": "Metro Line 15 (Xiliu--Dongzhaoyu)",
    "route_cn_backward": "地铁15号线(东兆余--细柳)",
    "route_en_backward": "Metro Line 15 (Dongzhaoyu--Xiliu)",
    "city_code": "029",
    "route_type": "地铁",
    "type_en": "subway",
    "company_cn": "西安市轨道交通集团",
    "company_en": "Xi'an Rail Transit Group",
    "s_stop_cn_forward": "细柳",
    "s_stop_en_forward": "Xiliu",
    "e_stop_cn_forward": "东兆余",
    "e_stop_en_forward": "Dongzhaoyu",
    "s_stop_cn_backward": "东兆余",
    "s_stop_en_backward": "Dongzhaoyu",
    "e_stop_cn_backward": "细柳",
    "e_stop_en_backward": "Xiliu",
    "distance": 19.459,
    "total_stop": 13,
    "start_time": "0600",
    "end_time": "2245",
    "loop": 0,
    "status": 1,
    "basic_prc": 2,
    "total_prc": 5,
    "city_cn": "西安",
    "city_en": "sian",
}


def update_transfer_coordinates_from_existing(stations, existing_stops):
    existing_coords = {}
    for _, row in existing_stops.iterrows():
        name = row["name_cn"]
        if name not in existing_coords:
            existing_coords[name] = (row.geometry.x, row.geometry.y)

    updated = 0
    for st in stations:
        if st["name_cn"] in existing_coords:
            old_lon, old_lat = st["lon"], st["lat"]
            new_lon, new_lat = existing_coords[st["name_cn"]]
            st["lon"] = new_lon
            st["lat"] = new_lat
            updated += 1
    return updated


def generate_route_geometry(stations, is_loop=False):
    coords = [(st["lon"], st["lat"]) for st in stations]
    if is_loop and len(coords) > 2:
        coords.append(coords[0])
    return LineString(coords)


def generate_segment_geometries(stations, is_loop=False):
    segments = []
    n = len(stations)
    for i in range(n - 1):
        s = stations[i]
        e = stations[i + 1]
        seg = {
            "s_stop_cn": s["name_cn"],
            "s_stop_en": s["name_en"],
            "e_stop_cn": e["name_cn"],
            "e_stop_en": e["name_en"],
            "geometry": LineString([(s["lon"], s["lat"]), (e["lon"], e["lat"])]),
        }
        segments.append(seg)
    if is_loop and n > 2:
        s = stations[-1]
        e = stations[0]
        seg = {
            "s_stop_cn": s["name_cn"],
            "s_stop_en": s["name_en"],
            "e_stop_cn": e["name_cn"],
            "e_stop_en": e["name_en"],
            "geometry": LineString([(s["lon"], s["lat"]), (e["lon"], e["lat"])]),
        }
        segments.append(seg)
    return segments


def generate_stop_id(name_cn, route_id, seq):
    hash_val = hash(f"{name_cn}_{route_id}_{seq}") & 0xFFFFFFFF
    return f"BV{hash_val:08X}"


def main():
    print("读取现有CPTOND-2025西安地铁数据...")
    existing_routes = gpd.read_file(os.path.join(BASE_DIR, "sian_metro_routes.shp"))
    existing_stops = gpd.read_file(os.path.join(BASE_DIR, "sian_metro_stops.shp"))
    existing_segments = gpd.read_file(os.path.join(BASE_DIR, "sian_metro_segments.shp"))
    existing_stops_unique = gpd.read_file(os.path.join(BASE_DIR, "sian_metro_stops_unique.shp"))

    print(f"现有数据: {len(existing_routes)}条线路, {len(existing_stops)}个站点记录, {len(existing_segments)}个路段, {len(existing_stops_unique)}个唯一站点")

    max_route_id_num = 0
    for _, row in existing_routes.iterrows():
        rid = row.get("route_id", "")
        if rid and rid.startswith("61010002"):
            try:
                num = int(rid[-4:])
                if num > max_route_id_num:
                    max_route_id_num = num
            except ValueError:
                pass

    line8_route_id_base = max_route_id_num + 1
    line15_route_id_base = max_route_id_num + 3

    line8_route_id_inner = f"61010002{line8_route_id_base:04d}"
    line8_route_id_outer = f"61010002{line8_route_id_base + 1:04d}"
    line15_route_id_forward = f"61010002{line15_route_id_base:04d}"
    line15_route_id_backward = f"61010002{line15_route_id_base + 1:04d}"

    print(f"生成route_id: 8号线内环={line8_route_id_inner}, 8号线外环={line8_route_id_outer}")
    print(f"              15号线正向={line15_route_id_forward}, 15号线反向={line15_route_id_backward}")

    print("使用现有CPTOND数据校正换乘站坐标...")
    updated_8 = update_transfer_coordinates_from_existing(LINE8_STATIONS, existing_stops)
    updated_15 = update_transfer_coordinates_from_existing(LINE15_STATIONS, existing_stops)
    print(f"8号线校正了{updated_8}个换乘站坐标, 15号线校正了{updated_15}个换乘站坐标")

    new_routes = []
    new_stops = []
    new_segments = []

    # === Line 8 Inner Loop (内环: 逆时针, 从山门口开始) ===
    inner_stations = LINE8_STATIONS[:]
    inner_geom = generate_route_geometry(inner_stations, is_loop=True)

    new_routes.append({
        "route_cn": LINE8_INFO["route_cn_inner"],
        "route_en": LINE8_INFO["route_en_inner"],
        "city_code": LINE8_INFO["city_code"],
        "route_type": LINE8_INFO["route_type"],
        "company_cn": LINE8_INFO["company_cn"],
        "company_en": LINE8_INFO["company_en"],
        "s_stop_cn": LINE8_INFO["s_stop_cn"],
        "s_stop_en": LINE8_INFO["s_stop_en"],
        "e_stop_cn": LINE8_INFO["e_stop_cn"],
        "e_stop_en": LINE8_INFO["e_stop_en"],
        "distance": LINE8_INFO["distance"],
        "total_stop": LINE8_INFO["total_stop"],
        "start_time": LINE8_INFO["start_time"],
        "end_time": LINE8_INFO["end_time"],
        "loop": LINE8_INFO["loop"],
        "status": LINE8_INFO["status"],
        "basic_prc": LINE8_INFO["basic_prc"],
        "total_prc": LINE8_INFO["total_prc"],
        "city_cn": LINE8_INFO["city_cn"],
        "city_en": LINE8_INFO["city_en"],
        "merged_cnt": 1,
        "type_en": LINE8_INFO["type_en"],
        "length": LINE8_INFO["distance"],
        "geometry": inner_geom,
    })

    for i, st in enumerate(inner_stations):
        new_stops.append({
            "name_cn": st["name_cn"],
            "name_en": st["name_en"],
            "stop_id": generate_stop_id(st["name_cn"], line8_route_id_inner, i + 1),
            "route_cn": LINE8_INFO["route_cn_inner"],
            "route_en": LINE8_INFO["route_en_inner"],
            "route_id": line8_route_id_inner,
            "city_code": LINE8_INFO["city_code"],
            "city_cn": LINE8_INFO["city_cn"],
            "city_en": LINE8_INFO["city_en"],
            "sequence": i + 1,
            "merged_cnt": 1,
            "geometry": Point(st["lon"], st["lat"]),
        })

    inner_segs = generate_segment_geometries(inner_stations, is_loop=True)
    for seg in inner_segs:
        new_segments.append({
            "s_stop_cn": seg["s_stop_cn"],
            "s_stop_en": seg["s_stop_en"],
            "s_stopid": generate_stop_id(seg["s_stop_cn"], line8_route_id_inner, 0),
            "e_stop_cn": seg["e_stop_cn"],
            "e_stop_en": seg["e_stop_en"],
            "e_stopid": generate_stop_id(seg["e_stop_cn"], line8_route_id_inner, 0),
            "distance": None,
            "city_cn": LINE8_INFO["city_cn"],
            "city_en": LINE8_INFO["city_en"],
            "num": 1,
            "geometry": seg["geometry"],
        })

    # === Line 8 Outer Loop (外环: 顺时针, 站点顺序反转) ===
    outer_stations = list(reversed(LINE8_STATIONS))
    outer_geom = generate_route_geometry(outer_stations, is_loop=True)

    new_routes.append({
        "route_cn": LINE8_INFO["route_cn_outer"],
        "route_en": LINE8_INFO["route_en_outer"],
        "city_code": LINE8_INFO["city_code"],
        "route_type": LINE8_INFO["route_type"],
        "company_cn": LINE8_INFO["company_cn"],
        "company_en": LINE8_INFO["company_en"],
        "s_stop_cn": LINE8_INFO["s_stop_cn"],
        "s_stop_en": LINE8_INFO["s_stop_en"],
        "e_stop_cn": LINE8_INFO["e_stop_cn"],
        "e_stop_en": LINE8_INFO["e_stop_en"],
        "distance": LINE8_INFO["distance"],
        "total_stop": LINE8_INFO["total_stop"],
        "start_time": LINE8_INFO["start_time"],
        "end_time": LINE8_INFO["end_time"],
        "loop": LINE8_INFO["loop"],
        "status": LINE8_INFO["status"],
        "basic_prc": LINE8_INFO["basic_prc"],
        "total_prc": LINE8_INFO["total_prc"],
        "city_cn": LINE8_INFO["city_cn"],
        "city_en": LINE8_INFO["city_en"],
        "merged_cnt": 1,
        "type_en": LINE8_INFO["type_en"],
        "length": LINE8_INFO["distance"],
        "geometry": outer_geom,
    })

    for i, st in enumerate(outer_stations):
        new_stops.append({
            "name_cn": st["name_cn"],
            "name_en": st["name_en"],
            "stop_id": generate_stop_id(st["name_cn"], line8_route_id_outer, i + 1),
            "route_cn": LINE8_INFO["route_cn_outer"],
            "route_en": LINE8_INFO["route_en_outer"],
            "route_id": line8_route_id_outer,
            "city_code": LINE8_INFO["city_code"],
            "city_cn": LINE8_INFO["city_cn"],
            "city_en": LINE8_INFO["city_en"],
            "sequence": i + 1,
            "merged_cnt": 1,
            "geometry": Point(st["lon"], st["lat"]),
        })

    outer_segs = generate_segment_geometries(outer_stations, is_loop=True)
    for seg in outer_segs:
        new_segments.append({
            "s_stop_cn": seg["s_stop_cn"],
            "s_stop_en": seg["s_stop_en"],
            "s_stopid": generate_stop_id(seg["s_stop_cn"], line8_route_id_outer, 0),
            "e_stop_cn": seg["e_stop_cn"],
            "e_stop_en": seg["e_stop_en"],
            "e_stopid": generate_stop_id(seg["e_stop_cn"], line8_route_id_outer, 0),
            "distance": None,
            "city_cn": LINE8_INFO["city_cn"],
            "city_en": LINE8_INFO["city_en"],
            "num": 1,
            "geometry": seg["geometry"],
        })

    # === Line 15 Forward (细柳 -> 东兆余) ===
    forward_stations = LINE15_STATIONS[:]
    forward_geom = generate_route_geometry(forward_stations)

    new_routes.append({
        "route_cn": LINE15_INFO["route_cn_forward"],
        "route_en": LINE15_INFO["route_en_forward"],
        "city_code": LINE15_INFO["city_code"],
        "route_type": LINE15_INFO["route_type"],
        "company_cn": LINE15_INFO["company_cn"],
        "company_en": LINE15_INFO["company_en"],
        "s_stop_cn": LINE15_INFO["s_stop_cn_forward"],
        "s_stop_en": LINE15_INFO["s_stop_en_forward"],
        "e_stop_cn": LINE15_INFO["e_stop_cn_forward"],
        "e_stop_en": LINE15_INFO["e_stop_en_forward"],
        "distance": LINE15_INFO["distance"],
        "total_stop": LINE15_INFO["total_stop"],
        "start_time": LINE15_INFO["start_time"],
        "end_time": LINE15_INFO["end_time"],
        "loop": LINE15_INFO["loop"],
        "status": LINE15_INFO["status"],
        "basic_prc": LINE15_INFO["basic_prc"],
        "total_prc": LINE15_INFO["total_prc"],
        "city_cn": LINE15_INFO["city_cn"],
        "city_en": LINE15_INFO["city_en"],
        "merged_cnt": 1,
        "type_en": LINE15_INFO["type_en"],
        "length": LINE15_INFO["distance"],
        "geometry": forward_geom,
    })

    for i, st in enumerate(forward_stations):
        new_stops.append({
            "name_cn": st["name_cn"],
            "name_en": st["name_en"],
            "stop_id": generate_stop_id(st["name_cn"], line15_route_id_forward, i + 1),
            "route_cn": LINE15_INFO["route_cn_forward"],
            "route_en": LINE15_INFO["route_en_forward"],
            "route_id": line15_route_id_forward,
            "city_code": LINE15_INFO["city_code"],
            "city_cn": LINE15_INFO["city_cn"],
            "city_en": LINE15_INFO["city_en"],
            "sequence": i + 1,
            "merged_cnt": 1,
            "geometry": Point(st["lon"], st["lat"]),
        })

    forward_segs = generate_segment_geometries(forward_stations)
    for seg in forward_segs:
        new_segments.append({
            "s_stop_cn": seg["s_stop_cn"],
            "s_stop_en": seg["s_stop_en"],
            "s_stopid": generate_stop_id(seg["s_stop_cn"], line15_route_id_forward, 0),
            "e_stop_cn": seg["e_stop_cn"],
            "e_stop_en": seg["e_stop_en"],
            "e_stopid": generate_stop_id(seg["e_stop_cn"], line15_route_id_forward, 0),
            "distance": None,
            "city_cn": LINE15_INFO["city_cn"],
            "city_en": LINE15_INFO["city_en"],
            "num": 1,
            "geometry": seg["geometry"],
        })

    # === Line 15 Backward (东兆余 -> 细柳) ===
    backward_stations = list(reversed(LINE15_STATIONS))
    backward_geom = generate_route_geometry(backward_stations)

    new_routes.append({
        "route_cn": LINE15_INFO["route_cn_backward"],
        "route_en": LINE15_INFO["route_en_backward"],
        "city_code": LINE15_INFO["city_code"],
        "route_type": LINE15_INFO["route_type"],
        "company_cn": LINE15_INFO["company_cn"],
        "company_en": LINE15_INFO["company_en"],
        "s_stop_cn": LINE15_INFO["s_stop_cn_backward"],
        "s_stop_en": LINE15_INFO["s_stop_en_backward"],
        "e_stop_cn": LINE15_INFO["e_stop_cn_backward"],
        "e_stop_en": LINE15_INFO["e_stop_en_backward"],
        "distance": LINE15_INFO["distance"],
        "total_stop": LINE15_INFO["total_stop"],
        "start_time": "0615",
        "end_time": "2300",
        "loop": LINE15_INFO["loop"],
        "status": LINE15_INFO["status"],
        "basic_prc": LINE15_INFO["basic_prc"],
        "total_prc": LINE15_INFO["total_prc"],
        "city_cn": LINE15_INFO["city_cn"],
        "city_en": LINE15_INFO["city_en"],
        "merged_cnt": 1,
        "type_en": LINE15_INFO["type_en"],
        "length": LINE15_INFO["distance"],
        "geometry": backward_geom,
    })

    for i, st in enumerate(backward_stations):
        new_stops.append({
            "name_cn": st["name_cn"],
            "name_en": st["name_en"],
            "stop_id": generate_stop_id(st["name_cn"], line15_route_id_backward, i + 1),
            "route_cn": LINE15_INFO["route_cn_backward"],
            "route_en": LINE15_INFO["route_en_backward"],
            "route_id": line15_route_id_backward,
            "city_code": LINE15_INFO["city_code"],
            "city_cn": LINE15_INFO["city_cn"],
            "city_en": LINE15_INFO["city_en"],
            "sequence": i + 1,
            "merged_cnt": 1,
            "geometry": Point(st["lon"], st["lat"]),
        })

    backward_segs = generate_segment_geometries(backward_stations)
    for seg in backward_segs:
        new_segments.append({
            "s_stop_cn": seg["s_stop_cn"],
            "s_stop_en": seg["s_stop_en"],
            "s_stopid": generate_stop_id(seg["s_stop_cn"], line15_route_id_backward, 0),
            "e_stop_cn": seg["e_stop_cn"],
            "e_stop_en": seg["e_stop_en"],
            "e_stopid": generate_stop_id(seg["e_stop_cn"], line15_route_id_backward, 0),
            "distance": None,
            "city_cn": LINE15_INFO["city_cn"],
            "city_en": LINE15_INFO["city_en"],
            "num": 1,
            "geometry": seg["geometry"],
        })

    # === Create GeoDataFrames and merge ===
    crs = "EPSG:4326"

    new_routes_gdf = gpd.GeoDataFrame(new_routes, crs=crs)
    new_stops_gdf = gpd.GeoDataFrame(new_stops, crs=crs)
    new_segments_gdf = gpd.GeoDataFrame(new_segments, crs=crs)

    # Ensure column types match existing data
    for col in existing_routes.columns:
        if col not in new_routes_gdf.columns:
            new_routes_gdf[col] = None
    for col in new_routes_gdf.columns:
        if col not in existing_routes.columns:
            existing_routes[col] = None

    for col in existing_stops.columns:
        if col not in new_stops_gdf.columns:
            new_stops_gdf[col] = None
    for col in new_stops_gdf.columns:
        if col not in existing_stops.columns:
            existing_stops[col] = None

    for col in existing_segments.columns:
        if col not in new_segments_gdf.columns:
            new_segments_gdf[col] = None
    for col in new_segments_gdf.columns:
        if col not in existing_segments.columns:
            existing_segments[col] = None

    merged_routes = pd.concat([existing_routes, new_routes_gdf], ignore_index=True)
    merged_stops = pd.concat([existing_stops, new_stops_gdf], ignore_index=True)
    merged_segments = pd.concat([existing_segments, new_segments_gdf], ignore_index=True)

    # === Update stops_unique ===
    all_stop_names = {}
    for _, row in merged_stops.iterrows():
        name = row["name_cn"]
        if name not in all_stop_names:
            all_stop_names[name] = {
                "stop_cn": name,
                "stop_en": row["name_en"],
                "stop_id": row["stop_id"],
                "geometry": row.geometry,
                "city_cn": row["city_cn"],
                "city_en": row["city_en"],
                "routes": set(),
            }
        all_stop_names[name]["routes"].add(row["route_cn"])

    unique_stops_list = []
    for name, info in all_stop_names.items():
        unique_stops_list.append({
            "stop_cn": info["stop_cn"],
            "stop_en": info["stop_en"],
            "stop_id": info["stop_id"],
            "num": len(info["routes"]),
            "city_cn": info["city_cn"],
            "city_en": info["city_en"],
            "geometry": info["geometry"],
        })

    merged_stops_unique = gpd.GeoDataFrame(unique_stops_list, crs=crs)

    # === Reorder columns to match existing ===
    merged_routes = merged_routes[existing_routes.columns]
    merged_stops = merged_stops[existing_stops.columns]
    merged_segments = merged_segments[existing_segments.columns]
    merged_stops_unique = merged_stops_unique[existing_stops_unique.columns]

    # === Save ===
    print(f"\n合并后数据统计:")
    print(f"  线路: {len(existing_routes)} -> {len(merged_routes)}")
    print(f"  站点记录: {len(existing_stops)} -> {len(merged_stops)}")
    print(f"  路段: {len(existing_segments)} -> {len(merged_segments)}")
    print(f"  唯一站点: {len(existing_stops_unique)} -> {len(merged_stops_unique)}")

    print("\n保存到文件...")
    merged_routes.to_file(os.path.join(OUTPUT_DIR, "sian_metro_routes.shp"), encoding="utf-8")
    merged_stops.to_file(os.path.join(OUTPUT_DIR, "sian_metro_stops.shp"), encoding="utf-8")
    merged_segments.to_file(os.path.join(OUTPUT_DIR, "sian_metro_segments.shp"), encoding="utf-8")
    merged_stops_unique.to_file(os.path.join(OUTPUT_DIR, "sian_metro_stops_unique.shp"), encoding="utf-8")

    print("\n完成！8号线和15号线数据已成功添加到CPTOND-2025西安地铁数据集中。")

    print("\n=== 新增线路摘要 ===")
    print(f"8号线(环线): 37站, 全程{LINE8_INFO['distance']}km, 票价{LINE8_INFO['basic_prc']}-{LINE8_INFO['total_prc']}元")
    print(f"  换乘站: 电视塔(2号线), 曲江池西(4号线), 马腾空(5号线), 万寿南路(6号线),")
    print(f"          万寿路(1号线), 广泰门(3号线), 余家寨(4号线), 市图书馆(2号线),")
    print(f"          开远门(1号线), 金光门(5号线), 延平门(3号线), 省体育馆(6号线)")
    print(f"15号线(一期): 13站, 全程{LINE15_INFO['distance']}km, 票价{LINE15_INFO['basic_prc']}-{LINE15_INFO['total_prc']}元")
    print(f"  换乘站: 郭杜西(6号线), 航天城(2号线), 东长安街(4号线)")


if __name__ == "__main__":
    main()

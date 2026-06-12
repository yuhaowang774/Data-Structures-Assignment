import json
import os
import sys
import time

from compare import config
from compare.amap_client import AmapClient
from compare.comparator import compare
from compare.local_router import LocalRouter
from compare.reporter import Reporter
from compare.test_case_generator import generate


def main():
    stations_path = os.path.join(config.DATA_DIR, "stations.json")
    with open(stations_path, "r", encoding="utf-8") as f:
        stations = json.load(f)["stations"]

    print("=== Xi'an Metro Compare Tool ===")
    print("[1/5] Generating test cases...")
    test_cases = generate(stations, config)
    print(f"  Generated {len(test_cases)} cases")

    print("[2/5] Initializing local router...")
    router = LocalRouter()
    print(f"  Nodes: {len(router.graph_data['nodes'])}, edges: {len(router.graph_data['edges'])}")

    print("[3/5] Initializing Amap client...")
    amap_client = AmapClient(config)

    print(f"[4/5] Running comparisons ({len(test_cases)} cases)...")
    local_results = []
    amap_results = []
    compare_results = []

    for index, case in enumerate(test_cases, start=1):
        local_result = router.query(case["origin"], case["dest"], 0)
        amap_result = amap_client.query_transit(case["origin_coord"], case["dest_coord"], 0)
        compare_result = compare(local_result, amap_result, config)
        local_results.append(local_result)
        amap_results.append(amap_result)
        compare_results.append(compare_result)

        status = "OK" if compare_result.get("local_ok") and compare_result.get("amap_ok") else "WARN"
        if compare_result.get("local_ok") and compare_result.get("amap_ok"):
            extra = (
                f" local={compare_result['local_time_min']:.1f}min "
                f"amap={compare_result['amap_time_min']:.1f}min "
                f"J={compare_result['jaccard']:.3f}"
            )
        else:
            extra = f" local={compare_result.get('local_ok')} amap={compare_result.get('amap_ok')}"
        print(f"  [{index:03d}/{len(test_cases):03d}] {case['id']} {status} {case['origin']} -> {case['dest']}{extra}")
        time.sleep(0.05)

    print("[5/5] Writing reports...")
    reporter = Reporter(config.OUTPUT_DIR)
    paths = reporter.write(test_cases, local_results, amap_results, compare_results)

    print("")
    print("=== Done ===")
    print(f"  Raw results: {paths['raw_path']}")
    print(f"  Summary CSV: {paths['csv_path']}")
    print(f"  Stats JSON:  {paths['stats_path']}")
    if paths["stats"].get("valid_count"):
        stats = paths["stats"]
        print(f"  Avg time diff: {stats['time_diff']['avg_min']} min ({stats['time_diff']['avg_pct']}%)")
        print(f"  Avg jaccard:   {stats['jaccard']['avg']}")


if __name__ == "__main__":
    main()

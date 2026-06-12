import csv
import json
import os
from datetime import datetime


def timestamp():
    return datetime.now().strftime("%Y%m%d_%H%M")


def build_raw_results(test_cases, local_results, amap_results, compare_results):
    results = []
    for case, local_result, amap_result, compare_result in zip(test_cases, local_results, amap_results, compare_results):
        results.append(
            {
                "id": case["id"],
                "type": case["type"],
                "origin": case["origin"],
                "dest": case["dest"],
                "origin_coord": case["origin_coord"],
                "dest_coord": case["dest_coord"],
                "local": local_result,
                "amap": amap_result,
                "comparison": compare_result,
            }
        )
    return results


def build_stats(compare_results):
    valid = [item for item in compare_results if item.get("local_ok") and item.get("amap_ok")]
    if not valid:
        return {"valid_count": 0, "message": "No valid comparison results"}

    time_diff = [item["time_diff_min"] for item in valid]
    time_diff_pct = [item["time_diff_pct"] for item in valid]
    jaccards = [item["jaccard"] for item in valid]
    lines_match = sum(1 for item in valid if item.get("line_comparison", {}).get("lines_match"))
    same_transfer = sum(1 for item in valid if item["transfer_diff"] == 0)

    return {
        "total_cases": len(compare_results),
        "valid_count": len(valid),
        "local_no_path_count": sum(1 for item in compare_results if not item.get("local_ok")),
        "amap_no_path_count": sum(1 for item in compare_results if not item.get("amap_ok")),
        "time_diff": {
            "avg_min": round(sum(time_diff) / len(time_diff), 2),
            "avg_pct": round(sum(time_diff_pct) / len(time_diff_pct), 1),
            "local_faster_count": sum(1 for item in time_diff if item < 0),
            "amap_faster_count": sum(1 for item in time_diff if item > 0),
            "equal_count": sum(1 for item in time_diff if abs(item) < 0.01),
        },
        "jaccard": {
            "avg": round(sum(jaccards) / len(jaccards), 4),
            "median": round(sorted(jaccards)[len(jaccards) // 2], 4),
            "min": round(min(jaccards), 4),
            "max": round(max(jaccards), 4),
        },
        "transfer": {
            "same_count": same_transfer,
            "same_pct": round(same_transfer / len(valid) * 100, 1),
        },
        "lines": {
            "match_count": lines_match,
            "match_pct": round(lines_match / len(valid) * 100, 1),
        },
    }


class Reporter:
    def __init__(self, output_dir):
        self.output_dir = output_dir
        os.makedirs(output_dir, exist_ok=True)

    def write(self, test_cases, local_results, amap_results, compare_results):
        stamp = timestamp()
        raw_results = build_raw_results(test_cases, local_results, amap_results, compare_results)
        raw_path = os.path.join(self.output_dir, f"results_{stamp}.json")
        csv_path = os.path.join(self.output_dir, f"summary_{stamp}.csv")
        stats_path = os.path.join(self.output_dir, f"stats_{stamp}.json")

        with open(raw_path, "w", encoding="utf-8") as f:
            json.dump(raw_results, f, ensure_ascii=False, indent=2)

        with open(csv_path, "w", encoding="utf-8-sig", newline="") as f:
            writer = csv.writer(f)
            writer.writerow([
                "id", "type", "origin", "dest", "local_time_min", "amap_time_min", "time_diff_min",
                "time_diff_pct", "local_transfers", "amap_transfers", "transfer_diff", "local_stations",
                "amap_stations", "station_diff", "walking_m", "jaccard", "lines_match",
            ])
            for case, compare_result in zip(test_cases, compare_results):
                writer.writerow([
                    case["id"],
                    case["type"],
                    case["origin"],
                    case["dest"],
                    f"{compare_result['local_time_min']:.2f}" if compare_result.get("local_ok") else "N/A",
                    f"{compare_result['amap_time_min']:.2f}" if compare_result.get("amap_ok") else "N/A",
                    f"{compare_result['time_diff_min']:.2f}" if "time_diff_min" in compare_result else "N/A",
                    f"{compare_result['time_diff_pct']:.1f}" if "time_diff_pct" in compare_result else "N/A",
                    compare_result.get("local_transfers", "N/A"),
                    compare_result.get("amap_transfers", "N/A"),
                    compare_result.get("transfer_diff", "N/A"),
                    compare_result.get("local_station_count", "N/A"),
                    compare_result.get("amap_station_count", "N/A"),
                    compare_result.get("station_diff", "N/A"),
                    compare_result.get("amap_walking_m", "N/A"),
                    f"{compare_result['jaccard']:.4f}" if "jaccard" in compare_result else "N/A",
                    compare_result.get("line_comparison", {}).get("lines_match", "N/A"),
                ])

        stats = build_stats(compare_results)
        stats["timestamp"] = stamp
        with open(stats_path, "w", encoding="utf-8") as f:
            json.dump(stats, f, ensure_ascii=False, indent=2)

        return {"raw_path": raw_path, "csv_path": csv_path, "stats_path": stats_path, "stats": stats}

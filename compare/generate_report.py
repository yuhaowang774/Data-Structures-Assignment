import json
import os
import sys


def build_lines(results):
    lines = ["# Xi'an Metro Compare Report", ""]
    valid_count = sum(1 for item in results if item.get("comparison", {}).get("local_ok") and item.get("comparison", {}).get("amap_ok"))
    lines.append(f"> Valid comparisons: {valid_count} / {len(results)}")
    lines.append("")
    lines.append("---")
    lines.append("")

    for item in results:
        compare = item.get("comparison") or {}
        local = item.get("local") or {}
        amap = item.get("amap") or {}

        lines.append(f"## {item['id']} {item['origin']} -> {item['dest']} ({item['type']})")
        lines.append("")

        if not compare:
            lines.append("> Missing comparison data")
            lines.append("")
            continue

        if compare.get("local_error") and compare.get("amap_error"):
            lines.append(f"> Local error: {compare['local_error']}")
            lines.append(f"> Amap error: {compare['amap_error']}")
            lines.append("")
            continue

        lines.append("| Metric | Local | Amap | Diff |")
        lines.append("|---|---:|---:|---:|")
        if compare.get("local_ok") and compare.get("amap_ok"):
            lines.append(f"| Time (min) | {compare['local_time_min']:.2f} | {compare['amap_time_min']:.2f} | {compare['time_diff_min']:.2f} ({compare['time_diff_pct']:.1f}%) |")
            lines.append(f"| Transfers | {compare['local_transfers']} | {compare['amap_transfers']} | {compare['transfer_diff']} |")
            lines.append(f"| Stations | {compare['local_station_count']} | {compare['amap_station_count']} | {compare['station_diff']} |")
            lines.append(f"| Walking (m) | 0 | {compare['amap_walking_m']} | -{compare['amap_walking_m']} |")
            lines.append(f"| Jaccard | - | - | {compare['jaccard']:.4f} |")
            lines.append(f"| Line match | - | - | {compare.get('line_comparison', {}).get('lines_match')} |")
        elif compare.get("local_ok"):
            lines.append(f"| Time (min) | {compare['local_time_min']:.2f} | N/A | - |")
            lines.append(f"| Local only | OK | {compare.get('amap_error', 'N/A')} | - |")
        else:
            lines.append(f"| Time (min) | N/A | {compare['amap_time_min']:.2f} | - |")
            lines.append(f"| Amap only | {compare.get('local_error', 'N/A')} | OK | - |")
        lines.append("")

        if local and not local.get("error") and local.get("segments"):
            lines.append("**Local route**")
            for segment in local["segments"]:
                lines.append(f"- **{segment['line']}**: {segment['from']} -> {segment['to']} ({len(segment['stations'])} stations)")
            if local.get("transfer_stations"):
                lines.append(f"- Transfers: {', '.join(local['transfer_stations'])}")
            lines.append("")

        if amap and not amap.get("error") and amap.get("schemes"):
            scheme = amap["schemes"][0]
            lines.append("**Amap route**")
            for segment in scheme.get("metro_segments", []):
                lines.append(f"- **{segment['line_short']}**: {segment['departure_stop']} -> {segment['arrival_stop']} ({len(segment.get('all_stops', []))} stations)")
            if scheme.get("transfer_stations"):
                lines.append(f"- Transfers: {', '.join(scheme['transfer_stations'])}")
            if scheme.get("has_non_metro"):
                lines.append("- Includes non-metro sections")
            lines.append("")

        transfer_cmp = compare.get("transfer_comparison")
        if transfer_cmp and (transfer_cmp["local_only"] or transfer_cmp["amap_only"]):
            lines.append("**Transfer station differences**")
            if transfer_cmp["common"]:
                lines.append(f"- Common: {', '.join(transfer_cmp['common'])}")
            if transfer_cmp["local_only"]:
                lines.append(f"- Local only: {', '.join(transfer_cmp['local_only'])}")
            if transfer_cmp["amap_only"]:
                lines.append(f"- Amap only: {', '.join(transfer_cmp['amap_only'])}")
            lines.append("")

        lines.append("---")
        lines.append("")
    return lines


def main():
    if len(sys.argv) != 2:
        raise SystemExit("Usage: python -m compare.generate_report <results.json>")

    results_path = sys.argv[1]
    with open(results_path, "r", encoding="utf-8") as f:
        results = json.load(f)

    out_path = os.path.join(os.path.dirname(results_path), "full-report.md")
    with open(out_path, "w", encoding="utf-8") as f:
        f.write("\n".join(build_lines(results)))
    print(f"Report written to: {out_path}")


if __name__ == "__main__":
    main()

import requests
import json

OVERPASS_URL = "https://overpass.kumi.systems/api/interpreter"

query = """
[out:json];
(
  node["railway"="station"]["station"="subway"](34.1,108.6,34.55,109.15);
  node["railway"="station"]["subway"="yes"](34.1,108.6,34.55,109.15);
  node["public_transport"="station"]["subway"="yes"](34.1,108.6,34.55,109.15);
);
out body;
"""

print("Querying Overpass API for Xi'an subway stations...")
r = requests.get(OVERPASS_URL, params={"data": query}, timeout=60)
print(f"Status: {r.status_code}")

data = r.json()
stations = [e for e in data.get("elements", []) if e.get("type") == "node"]
print(f"Found {len(stations)} subway stations")

for s in sorted(stations, key=lambda x: x.get("tags", {}).get("name", "")):
    name = s.get("tags", {}).get("name", "?")
    name_en = s.get("tags", {}).get("name:en", "")
    lines = s.get("tags", {}).get("subway_lines", s.get("tags", {}).get("operator", ""))
    print(f"  {name} ({name_en}): lat={s['lat']:.6f}, lon={s['lon']:.6f}, lines={lines}")

import os

ROOT_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA_DIR = os.path.join(ROOT_DIR, "metro_router", "data")
OUTPUT_DIR = os.path.join(ROOT_DIR, "compare", "output")

AMAP_KEY = os.environ.get("AMAP_KEY", "fc83711fd95930b3049d947e11f7096e")
CITY = "西安"
CITY_CODE = "029"
AMAP_BASE = "https://restapi.amap.com/v3/direction/transit/integrated"
QPS = 3
RETRY_MAX = 5
RETRY_BASE_DELAY = 2.0
TIMEOUT = 10.0
RANDOM_CASE_COUNT = 80
STRATEGIES = [0]
WAIT_TIME_MIN = 3
MIN_DISTANCE_M = 1000

from flask import Flask, render_template, jsonify, request
import subprocess
import json
import os
import platform

app = Flask(__name__)

DATA_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'data')
CORE_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'core')

GRAPH_FILE = os.path.join(DATA_DIR, 'graph.txt')
STATIONS_FILE = os.path.join(DATA_DIR, 'stations.json')
ROUTES_FILE = os.path.join(DATA_DIR, 'routes.json')

if platform.system() == 'Windows':
    EXE_PATH = os.path.join(CORE_DIR, 'metro_router.exe')
else:
    EXE_PATH = os.path.join(CORE_DIR, 'metro_router')

with open(STATIONS_FILE, 'r', encoding='utf-8') as f:
    stations_data = json.load(f)
with open(ROUTES_FILE, 'r', encoding='utf-8') as f:
    routes_data = json.load(f)

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/api/stations')
def api_stations():
    return jsonify(stations_data)

@app.route('/api/routes')
def api_routes():
    return jsonify(routes_data)

@app.route('/api/path')
def api_path():
    start = request.args.get('start', '')
    end = request.args.get('end', '')
    mode = request.args.get('mode', '0')

    if not start or not end:
        return jsonify({'error': 'Missing start or end parameter'}), 400

    try:
        result = subprocess.run(
            [EXE_PATH, GRAPH_FILE, mode],
            input=f"{start}\n{end}\n",
            capture_output=True, text=True, encoding='utf-8', timeout=10
        )
        if result.returncode != 0:
            return jsonify({'error': result.stderr.strip()}), 500
        return jsonify(json.loads(result.stdout))
    except subprocess.TimeoutExpired:
        return jsonify({'error': 'Query timeout'}), 500
    except json.JSONDecodeError:
        return jsonify({'error': 'Invalid response from core'}), 500
    except (FileNotFoundError, OSError):
        return jsonify({'error': 'C核心程序未编译，请运行 mingw32-make'}), 500

if __name__ == '__main__':
    app.run(debug=True, port=5000)

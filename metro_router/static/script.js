var map, routesData, stationsData, pathLayer, transferMarkers = [];
var ROUTE_COLORS = {};

function initMap() {
    map = L.map('map').setView([34.26, 108.95], 12);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; OpenStreetMap contributors', maxZoom: 18
    }).addTo(map);
    loadData();
}

function loadData() {
    Promise.all([
        fetch('/api/routes').then(r => r.json()),
        fetch('/api/stations').then(r => r.json())
    ]).then(([routes, stations]) => {
        routesData = routes.routes;
        stationsData = stations.stations;
        initSearchInputs();
        drawRoutes();
        drawStations();
    }).catch(() => {
        alert('加载数据失败，请确认已运行 python data_loader.py');
    });
}

function initSearchInputs() {
    setupSearchInput('start-input', 'start-dropdown');
    setupSearchInput('end-input', 'end-dropdown');
}

function setupSearchInput(inputId, dropdownId) {
    var input = document.getElementById(inputId);
    var dropdown = document.getElementById(dropdownId);
    input.addEventListener('input', function() {
        var keyword = this.value.trim().toLowerCase();
        dropdown.innerHTML = '';
        if (!keyword) { dropdown.classList.remove('show'); return; }
        var matches = stationsData.filter(function(s) {
            return s.name.toLowerCase().indexOf(keyword) !== -1;
        }).slice(0, 20);
        if (matches.length === 0) { dropdown.classList.remove('show'); return; }
        matches.forEach(function(s) {
            var div = document.createElement('div');
            div.className = 'dropdown-item';
            div.textContent = s.name + (s.is_transfer ? ' (换乘)' : '');
            div.onclick = function() { input.value = s.name; dropdown.classList.remove('show'); };
            dropdown.appendChild(div);
        });
        dropdown.classList.add('show');
    });
    input.addEventListener('blur', function() {
        setTimeout(function() { dropdown.classList.remove('show'); }, 200);
    });
}

function drawRoutes() {
    routesData.forEach(function(route) {
        ROUTE_COLORS[route.name] = route.color;
        var coords = route.stations.map(function(s) { return [s.lat, s.lon]; });
        L.polyline(coords, { color: route.color, weight: 3, opacity: 0.7 })
            .bindTooltip(route.name, { sticky: true }).addTo(map);
    });
}

function drawStations() {
    stationsData.forEach(function(s) {
        var radius = s.is_transfer ? 6 : 4;
        var color = s.is_transfer ? '#E67E22' : '#4A90D9';
        L.circleMarker([s.lat, s.lon], {
            radius: radius, color: color, fillColor: color,
            fillOpacity: 0.8, weight: 1.5
        }).bindTooltip(s.name).addTo(map);
    });
}

function queryPath(mode) {
    var startInput = document.getElementById('start-input');
    var endInput = document.getElementById('end-input');
    var start = startInput.value.trim();
    var end = endInput.value.trim();
    if (!start || !end) { alert('请输入起点和终点站名'); return; }

    document.getElementById('result').className = 'hidden';
    disableButtons(true);

    fetch('/api/path?start=' + encodeURIComponent(start) + '&end=' +
          encodeURIComponent(end) + '&mode=' + mode)
        .then(function(r) { return r.json(); })
        .then(function(data) {
            disableButtons(false);
            if (data.error) { showError(data.error); return; }
            showResult(data, start, end);
            highlightPath(data);
        })
        .catch(function() { disableButtons(false); showError('查询失败，请重试'); });
}

function disableButtons(disabled) {
    document.getElementById('btn-time').disabled = disabled;
    document.getElementById('btn-transfer').disabled = disabled;
}

function showError(msg) {
    var result = document.getElementById('result');
    result.className = '';
    document.getElementById('result-error').style.display = 'block';
    document.getElementById('result-error').textContent = msg;
    document.getElementById('result-content').style.display = 'none';
}

function showResult(data, start, end) {
    var result = document.getElementById('result');
    result.className = '';
    document.getElementById('result-error').style.display = 'none';
    document.getElementById('result-content').style.display = '';
    document.getElementById('result-time').textContent = '总时间: ' + data.total_time + ' 分钟';
    document.getElementById('result-transfers').textContent = '换乘: ' + data.transfers + ' 次';

    var html = '<strong>路径详情:</strong><br>';
    var lastStation = '';
    for (var i = 0; i < data.path.length; i++) {
        var p = data.path[i];
        if (p.station !== lastStation) {
            var isTransfer = false;
            for (var j = 0; j < data.transfer_stations.length; j++) {
                if (data.transfer_stations[j] === p.station) { isTransfer = true; break; }
            }
            var color = ROUTE_COLORS[p.line] || '#999';
            html += '<span class="line-tag" style="background:' + color + '">' + p.line + '</span>';
            if (isTransfer) {
                html += '<strong class="transfer-marker">' + p.station + ' ← 换乘</strong>';
            } else {
                html += p.station;
            }
            html += '<br>';
            lastStation = p.station;
        }
    }
    document.getElementById('result-stations').innerHTML = html;
}

function highlightPath(data) {
    if (pathLayer) { map.removeLayer(pathLayer); }
    transferMarkers.forEach(function(m) { map.removeLayer(m); });
    transferMarkers = [];

    var coords = data.path.map(function(p) { return [p.lat, p.lon]; });
    pathLayer = L.polyline(coords, { color: '#e74c3c', weight: 6, opacity: 0.85,
        dashArray: '8 8' }).addTo(map);
    map.fitBounds(pathLayer.getBounds(), { padding: [40, 40] });

    data.transfer_stations.forEach(function(name) {
        var station = stationsData.find(function(s) { return s.name === name; });
        if (station) {
            var m = L.marker([station.lat, station.lon], {
                icon: L.divIcon({ className: 'transfer-marker-icon',
                    html: '<div style="background:#E67E22;color:#fff;border-radius:50%;'
                        + 'width:24px;height:24px;line-height:24px;text-align:center;'
                        + 'font-size:12px;border:2px solid #fff;">↔</div>',
                    iconSize: [24, 24], iconAnchor: [12, 12] })
            }).addTo(map);
            transferMarkers.push(m);
        }
    });
}

document.addEventListener('DOMContentLoaded', initMap);

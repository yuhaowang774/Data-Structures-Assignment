var ScheduleConfig = (function () {
  var DEFAULT_PERIODS = [
    { id: "morning_peak", name: "早高峰", start: "07:00", end: "09:30", type: "peak" },
    { id: "evening_peak", name: "晚高峰", start: "17:00", end: "19:30", type: "peak" },
    { id: "midday", name: "午间平峰", start: "09:30", end: "17:00", type: "offpeak" },
    { id: "morning_offpeak", name: "早间平峰", start: "06:00", end: "07:00", type: "offpeak" },
    { id: "evening_offpeak", name: "晚间平峰", start: "19:30", end: "23:00", type: "offpeak" }
  ];

  var DEFAULT_MULTIPLIERS = {
    peak: { run: 1.3, transfer: 1.5 },
    offpeak: { run: 1.0, transfer: 1.0 }
  };

  var LINE_OVERRIDES = {};

  var periods = JSON.parse(JSON.stringify(DEFAULT_PERIODS));
  var multipliers = JSON.parse(JSON.stringify(DEFAULT_MULTIPLIERS));
  var lineOverrides = JSON.parse(JSON.stringify(LINE_OVERRIDES));

  var mode = "auto";
  var manualPeriodId = "midday";
  var simulatedTime = null;
  var currentPeriod = null;
  var onPeriodChange = null;
  var checkInterval = null;

  function timeToMinutes(timeStr) {
    var parts = timeStr.split(":");
    return parseInt(parts[0], 10) * 60 + parseInt(parts[1], 10);
  }

  function getCurrentTimeMinutes() {
    if (simulatedTime) {
      return timeToMinutes(simulatedTime);
    }
    var now = new Date();
    return now.getHours() * 60 + now.getMinutes();
  }

  function detectPeriod() {
    var currentMin = getCurrentTimeMinutes();
    for (var i = 0; i < periods.length; i++) {
      var p = periods[i];
      var startMin = timeToMinutes(p.start);
      var endMin = timeToMinutes(p.end);
      if (currentMin >= startMin && currentMin < endMin) {
        return p;
      }
    }
    return { id: "closed", name: "非运营时间", start: "23:00", end: "06:00", type: "offpeak" };
  }

  function getManualPeriod() {
    for (var i = 0; i < periods.length; i++) {
      if (periods[i].id === manualPeriodId) return periods[i];
    }
    return periods[0];
  }

  function getMultiplier(lineName, isTransfer) {
    var periodType = "offpeak";
    if (mode === "auto") {
      var detected = detectPeriod();
      periodType = detected.type;
    } else {
      var mp = getManualPeriod();
      periodType = mp.type;
    }

    var base = multipliers[periodType] || multipliers.offpeak;
    var factor = isTransfer ? base.transfer : base.run;

    if (lineOverrides[lineName] && lineOverrides[lineName][periodType]) {
      var override = lineOverrides[lineName][periodType];
      factor = isTransfer ? (override.transfer !== undefined ? override.transfer : factor) : (override.run !== undefined ? override.run : factor);
    }

    return factor;
  }

  function adjustWeight(baseWeight, lineName, isTransfer) {
    var factor = getMultiplier(lineName, isTransfer);
    return Math.round(baseWeight * factor * 100) / 100;
  }

  function buildAdjustedAdjList(graphData) {
    var adjList = {};
    var nodes = graphData.nodes;
    var edges = graphData.edges;

    for (var i = 0; i < nodes.length; i++) {
      adjList[nodes[i].id] = [];
    }

    for (var j = 0; j < edges.length; j++) {
      var e = edges[j];
      var adjustedWeight = adjustWeight(e.weight, e.line, e.is_transfer === 1);
      adjList[e.from].push({
        to: e.to,
        weight: adjustedWeight,
        baseWeight: e.weight,
        line: e.line,
        is_transfer: e.is_transfer
      });
    }

    return adjList;
  }

  function updateCurrentPeriod() {
    var newPeriod;
    if (mode === "auto") {
      newPeriod = detectPeriod();
    } else {
      var mp = getManualPeriod();
      newPeriod = {
        id: "manual_" + mp.id,
        name: mp.name,
        type: mp.type,
        start: mp.start,
        end: mp.end
      };
    }

    var changed = !currentPeriod || currentPeriod.id !== newPeriod.id || currentPeriod.type !== newPeriod.type;
    currentPeriod = newPeriod;

    if (changed && onPeriodChange) {
      onPeriodChange(currentPeriod);
    }

    return changed;
  }

  function startAutoCheck() {
    if (checkInterval) clearInterval(checkInterval);
    checkInterval = setInterval(function () {
      if (mode === "auto") {
        var changed = updateCurrentPeriod();
        if (changed && typeof ScheduleConfigUI !== "undefined") {
          ScheduleConfigUI.refresh();
        }
      }
    }, 60000);
  }

  function init(options) {
    if (options && options.onPeriodChange) {
      onPeriodChange = options.onPeriodChange;
    }
    updateCurrentPeriod();
    startAutoCheck();
  }

  function setMode(newMode) {
    mode = newMode;
    updateCurrentPeriod();
  }

  function setManualPeriodId(periodId) {
    manualPeriodId = periodId;
    if (mode === "manual") {
      updateCurrentPeriod();
    }
  }

  function setSimulatedTime(timeStr) {
    simulatedTime = timeStr || null;
    if (mode === "auto") {
      updateCurrentPeriod();
    }
  }

  function setMultiplier(periodType, runFactor, transferFactor) {
    if (!multipliers[periodType]) {
      multipliers[periodType] = { run: 1.0, transfer: 1.0 };
    }
    if (runFactor !== undefined && runFactor !== null) multipliers[periodType].run = runFactor;
    if (transferFactor !== undefined && transferFactor !== null) multipliers[periodType].transfer = transferFactor;
  }

  function setLineOverride(lineName, periodType, runFactor, transferFactor) {
    if (!lineOverrides[lineName]) lineOverrides[lineName] = {};
    if (!lineOverrides[lineName][periodType]) lineOverrides[lineName][periodType] = {};
    if (runFactor !== undefined && runFactor !== null) lineOverrides[lineName][periodType].run = runFactor;
    if (transferFactor !== undefined && transferFactor !== null) lineOverrides[lineName][periodType].transfer = transferFactor;
  }

  function removeLineOverride(lineName) {
    delete lineOverrides[lineName];
  }

  function resetToDefaults() {
    periods = JSON.parse(JSON.stringify(DEFAULT_PERIODS));
    multipliers = JSON.parse(JSON.stringify(DEFAULT_MULTIPLIERS));
    lineOverrides = {};
    mode = "auto";
    manualPeriodId = "midday";
    simulatedTime = null;
    updateCurrentPeriod();
  }

  function getPeriods() { return periods; }
  function getMultipliers() { return multipliers; }
  function getLineOverrides() { return lineOverrides; }
  function getCurrentPeriod() { return currentPeriod; }
  function getMode() { return mode; }
  function getManualPeriodId() { return manualPeriodId; }
  function getSimulatedTime() { return simulatedTime; }

  function setPeriods(newPeriods) {
    periods = newPeriods;
    updateCurrentPeriod();
  }

  function addPeriod(period) {
    periods.push(period);
    updateCurrentPeriod();
  }

  function removePeriod(periodId) {
    periods = periods.filter(function (p) { return p.id !== periodId; });
    updateCurrentPeriod();
  }

  return {
    init: init,
    buildAdjustedAdjList: buildAdjustedAdjList,
    adjustWeight: adjustWeight,
    getMultiplier: getMultiplier,
    setMode: setMode,
    setManualPeriodId: setManualPeriodId,
    setSimulatedTime: setSimulatedTime,
    setMultiplier: setMultiplier,
    setLineOverride: setLineOverride,
    removeLineOverride: removeLineOverride,
    resetToDefaults: resetToDefaults,
    getPeriods: getPeriods,
    setPeriods: setPeriods,
    addPeriod: addPeriod,
    removePeriod: removePeriod,
    getMultipliers: getMultipliers,
    getLineOverrides: getLineOverrides,
    getCurrentPeriod: getCurrentPeriod,
    getMode: getMode,
    getManualPeriodId: getManualPeriodId,
    getSimulatedTime: getSimulatedTime,
    detectPeriod: detectPeriod,
    getCurrentTimeMinutes: getCurrentTimeMinutes,
    exportState: function () {
      return {
        periods: JSON.parse(JSON.stringify(periods)),
        multipliers: JSON.parse(JSON.stringify(multipliers)),
        lineOverrides: JSON.parse(JSON.stringify(lineOverrides)),
        mode: mode,
        manualPeriodId: manualPeriodId,
        simulatedTime: simulatedTime
      };
    }
  };
})();

var ScheduleConfigUI = (function () {
  function init() {
    refresh();
    populateLineSelect();
  }

  function refresh() {
    var cp = ScheduleConfig.getCurrentPeriod();
    var display = document.getElementById("current-period-display");
    if (display && cp) {
      var labelEl = display.querySelector(".period-label");
      var timeEl = display.querySelector(".period-time-range");
      if (labelEl) labelEl.textContent = cp.name;
      if (timeEl) timeEl.textContent = cp.start + " - " + cp.end;
      display.className = "period-display " + cp.type;
    }

    var headerDot = document.getElementById("header-period-dot");
    if (headerDot && cp) {
      headerDot.className = "period-dot" + (cp.type === "peak" ? " peak" : "");
    }

    var mul = ScheduleConfig.getMultipliers();
    var peakRunEl = document.getElementById("peak-run-factor");
    var peakTransferEl = document.getElementById("peak-transfer-factor");
    var offpeakRunEl = document.getElementById("offpeak-run-factor");
    var offpeakTransferEl = document.getElementById("offpeak-transfer-factor");

    if (peakRunEl && mul.peak) peakRunEl.value = mul.peak.run;
    if (peakTransferEl && mul.peak) peakTransferEl.value = mul.peak.transfer;
    if (offpeakRunEl && mul.offpeak) offpeakRunEl.value = mul.offpeak.run;
    if (offpeakTransferEl && mul.offpeak) offpeakTransferEl.value = mul.offpeak.transfer;

    var mode = ScheduleConfig.getMode();
    var autoBtn = document.getElementById("mode-auto-btn");
    var manualBtn = document.getElementById("mode-manual-btn");
    var manualCtrl = document.getElementById("manual-controls");
    if (autoBtn) autoBtn.className = "mode-btn" + (mode === "auto" ? " active" : "");
    if (manualBtn) manualBtn.className = "mode-btn" + (mode === "manual" ? " active" : "");
    if (manualCtrl) manualCtrl.style.display = mode === "manual" ? "" : "none";

    var mpid = ScheduleConfig.getManualPeriodId();
    renderManualPeriods(mpid);

    renderPeriodRules();
  }

  function populateLineSelect() {
    var select = document.getElementById("line-override-select");
    if (!select) return;
    var lineNames = [];
    if (typeof graphData !== "undefined" && graphData.edges) {
      for (var i = 0; i < graphData.edges.length; i++) {
        var ln = graphData.edges[i].line;
        if (ln && lineNames.indexOf(ln) === -1) lineNames.push(ln);
      }
    }
    lineNames.sort();
    for (var j = 0; j < lineNames.length; j++) {
      var opt = document.createElement("option");
      opt.value = lineNames[j];
      opt.textContent = lineNames[j];
      select.appendChild(opt);
    }
  }

  function renderManualPeriods(activeId) {
    var container = document.getElementById("manual-period-list");
    if (!container) return;
    var periods = ScheduleConfig.getPeriods();
    var html = "";
    for (var i = 0; i < periods.length; i++) {
      var p = periods[i];
      var isActive = p.id === activeId;
      var itemClass = "manual-period-item " + p.type + "-item" + (isActive ? " active" : "");
      html += '<div class="' + itemClass + '" onclick="setManualPeriod(\'' + p.id + '\')">';
      html += '<span class="manual-period-dot ' + p.type + '"></span>';
      html += '<span class="manual-period-name">' + p.name + '</span>';
      html += '<span class="manual-period-time">' + p.start + ' - ' + p.end + '</span>';
      html += '</div>';
    }
    container.innerHTML = html;
  }

  function renderPeriodRules() {
    var container = document.getElementById("period-rules-list");
    if (!container) return;
    var periods = ScheduleConfig.getPeriods();
    var html = "";
    for (var i = 0; i < periods.length; i++) {
      var p = periods[i];
      html += '<div class="period-rule-item ' + p.type + '">';
      html += '<span class="rule-name">' + p.name + '</span>';
      html += '<span class="rule-time">' + p.start + ' - ' + p.end + '</span>';
      html += '</div>';
    }
    container.innerHTML = html;
  }

  return { init: init, refresh: refresh };
})();

function toggleSchedulePanel() {
  var body = document.getElementById("schedule-body");
  var icon = document.getElementById("schedule-toggle-icon");
  if (!body) return;
  if (body.classList.contains("collapsed")) {
    body.classList.remove("collapsed");
    icon.textContent = "▲";
  } else {
    body.classList.add("collapsed");
    icon.textContent = "▼";
  }
}

function setScheduleMode(m) {
  ScheduleConfig.setMode(m);
  if (typeof buildAdjList === "function") buildAdjList();
  ScheduleConfigUI.refresh();
}

function setManualPeriod(periodId) {
  ScheduleConfig.setManualPeriodId(periodId);
  if (typeof buildAdjList === "function") buildAdjList();
  ScheduleConfigUI.refresh();
}

function setSimulatedTime(val) {
  ScheduleConfig.setSimulatedTime(val);
  if (typeof buildAdjList === "function") buildAdjList();
  ScheduleConfigUI.refresh();
}

function clearSimulatedTime() {
  var simInput = document.getElementById("sim-time-input");
  if (simInput) simInput.value = "";
  ScheduleConfig.setSimulatedTime(null);
  if (typeof buildAdjList === "function") buildAdjList();
  ScheduleConfigUI.refresh();
}

function updatePeakFactor() {
  var run = parseFloat(document.getElementById("peak-run-factor").value) || 1.3;
  var transfer = parseFloat(document.getElementById("peak-transfer-factor").value) || 1.5;
  ScheduleConfig.setMultiplier("peak", run, transfer);
  if (typeof buildAdjList === "function") buildAdjList();
  ScheduleConfigUI.refresh();
}

function updateOffpeakFactor() {
  var run = parseFloat(document.getElementById("offpeak-run-factor").value) || 1.0;
  var transfer = parseFloat(document.getElementById("offpeak-transfer-factor").value) || 1.0;
  ScheduleConfig.setMultiplier("offpeak", run, transfer);
  if (typeof buildAdjList === "function") buildAdjList();
  ScheduleConfigUI.refresh();
}

function onLineOverrideSelect() {
  var select = document.getElementById("line-override-select");
  var config = document.getElementById("line-override-config");
  if (!select || !config) return;
  if (select.value) {
    config.style.display = "";
    var overrides = ScheduleConfig.getLineOverrides();
    var existing = overrides[select.value] && overrides[select.value].peak;
    document.getElementById("line-peak-run").value = existing ? existing.run : ScheduleConfig.getMultipliers().peak.run;
    document.getElementById("line-peak-transfer").value = existing ? existing.transfer : ScheduleConfig.getMultipliers().peak.transfer;
  } else {
    config.style.display = "none";
  }
}

function applyLineOverride() {
  var select = document.getElementById("line-override-select");
  if (!select || !select.value) return;
  var lineName = select.value;
  var run = parseFloat(document.getElementById("line-peak-run").value);
  var transfer = parseFloat(document.getElementById("line-peak-transfer").value);
  ScheduleConfig.setLineOverride(lineName, "peak", run, transfer);
  if (typeof buildAdjList === "function") buildAdjList();
  ScheduleConfigUI.refresh();
}

function removeLineOverride() {
  var select = document.getElementById("line-override-select");
  if (!select || !select.value) return;
  ScheduleConfig.removeLineOverride(select.value);
  if (typeof buildAdjList === "function") buildAdjList();
  ScheduleConfigUI.refresh();
}

function resetScheduleConfig() {
  ScheduleConfig.resetToDefaults();
  ScheduleConfig.setSimulatedTime(null);
  if (typeof buildAdjList === "function") buildAdjList();
  ScheduleConfigUI.refresh();
  var simInput = document.getElementById("sim-time-input");
  if (simInput) simInput.value = "";
}

/**
 * Hunter Radar Beta — App
 *
 * Wires the transport-independent pipeline together:
 *   Bluetooth / Serial / Simulated data
 *        -> processHunterRadarPacket(line)
 *        -> packetParser -> deviceStore -> mapLayer + device list UI
 *
 * The map and UI never see raw transport data directly — everything
 * passes through the parser and device store first.
 */

(function () {
  const el = (id) => document.getElementById(id);

  const logger = HunterRadarLogger.createLogger(el("diagnostic-console"));
  const mapLayer = HunterRadarMap.createMapLayer("map", { onMarkerClick: showDeviceDetail });
  const deviceStore = HunterRadarDeviceStore.createStore({
    onUpdate: (record) => {
      mapLayer.upsertMarker(record);
      renderDeviceList();
    },
    onReject: (data, reason) => {
      logger.log(`Rejected packet for ${data.deviceId} (seq #${data.sequence}): ${reason}`, "warn");
    },
  });

  let packetCount = 0;
  let currentTransport = null; // 'bluetooth' | 'serial' | 'simulated'
  let currentTransportHandle = null;

  // --- The single entry point every transport feeds into -----------------
  function processHunterRadarPacket(packetText) {
    logger.log(`Raw: ${packetText}`, "info");
    let parsed;
    try {
      parsed = HunterRadarParser.parseLocationPacket(packetText);
    } catch (err) {
      logger.log(`Parse error: ${err.message}`, "error");
      return;
    }

    packetCount += 1;
    el("status-packet-count").textContent = String(packetCount);
    el("status-last-packet").textContent = new Date(parsed.receivedAt).toLocaleTimeString();

    const result = deviceStore.ingest(parsed);
    if (result) {
      const tag = parsed.packetType === "SOS" ? "EMERGENCY" : "location";
      logger.log(`Parsed ${tag} for ${parsed.deviceId} (seq #${parsed.sequence}, RSSI ${parsed.rssi ?? "—"} dBm, SNR ${parsed.snr ?? "—"} dB)`, "ok");
    }
  }

  // --- Bluetooth ------------------------------------------------------
  const bluetooth = HunterRadarBluetooth.createBluetoothService({
    onPacketLine: processHunterRadarPacket,
    onLog: (msg, level) => logger.log(msg, level),
    onStateChange: (state) => setConnectionState(state, "bluetooth"),
  });

  el("btn-connect-ble").addEventListener("click", async () => {
    try {
      const device = await bluetooth.connect();
      currentTransport = "bluetooth";
      currentTransportHandle = bluetooth;
      el("status-device").textContent = device.name || device.id || "Hunter Radar device";
    } catch (err) {
      logger.log(`Bluetooth connection failed: ${err.message}`, "error");
      setConnectionState("error", "bluetooth");
    }
  });

  // --- Serial ------------------------------------------------------
  const serial = HunterRadarSerial.createSerialService({
    onPacketLine: processHunterRadarPacket,
    onLog: (msg, level) => logger.log(msg, level),
    onStateChange: (state) => setConnectionState(state, "serial"),
  });

  el("btn-connect-serial").addEventListener("click", async () => {
    try {
      await serial.connect({ baudRate: 115200 });
      currentTransport = "serial";
      currentTransportHandle = serial;
      el("status-device").textContent = "USB serial (115200 baud)";
    } catch (err) {
      logger.log(`Serial connection failed: ${err.message}`, "error");
      setConnectionState("error", "serial");
    }
  });

  el("btn-disconnect").addEventListener("click", async () => {
    if (currentTransportHandle) {
      await currentTransportHandle.disconnect();
    }
    currentTransport = null;
    currentTransportHandle = null;
  });

  // --- Simulated data ------------------------------------------------
  const simulator = HunterRadarSimulate.createSimulator({
    onPacketLine: processHunterRadarPacket,
    onLog: (msg, level) => logger.log(msg, level),
  });

  el("btn-inject-one").addEventListener("click", () => simulator.injectOne());
  el("btn-inject-sos").addEventListener("click", () => simulator.injectSOS());

  el("btn-sim-toggle").addEventListener("click", (e) => {
    if (simulator.isRunning()) {
      simulator.stop();
      e.target.textContent = "Start simulation";
    } else {
      simulator.start({ intervalMs: 4000 });
      e.target.textContent = "Stop simulation";
    }
  });

  el("btn-clear-devices").addEventListener("click", () => {
    deviceStore.clear();
    mapLayer.clearAll();
    renderDeviceList();
    logger.log("Cleared all tracked devices.", "info");
  });

  // --- Connection status UI -------------------------------------------
  function setConnectionState(state, transport) {
    const dot = el("conn-dot");
    const label = el("conn-label");
    dot.setAttribute("data-state", state);

    const labels = {
      connecting: "Connecting…",
      connected: "Connected",
      disconnected: "Disconnected",
      error: "Connection error",
    };
    label.textContent = labels[state] || state;
    el("status-state").textContent = labels[state] || state;
    el("status-transport").textContent = state === "disconnected" ? "—" : transport;

    el("btn-disconnect").style.display = state === "connected" ? "inline-flex" : "none";

    if (state === "disconnected" || state === "error") {
      el("status-device").textContent = "—";
    }
  }

  // --- Device list rendering -------------------------------------------
  function renderDeviceList() {
    const container = el("device-list");
    const devices = deviceStore.getAll().sort((a, b) => b.receivedAt - a.receivedAt);

    if (!devices.length) {
      container.innerHTML = `<p class="hint">No devices yet. Connect hardware or inject a test packet.</p>`;
      return;
    }

    container.innerHTML = "";
    for (const record of devices) {
      const card = document.createElement("div");
      card.className = "device-card";
      card.addEventListener("click", () => showDeviceDetail(record));

      const ageSeconds = Math.round((Date.now() - record.receivedAt) / 1000);

      card.innerHTML = `
        <div class="device-card__top">
          <span class="device-card__id">${escapeHtml(record.deviceId)}</span>
          <span class="device-card__state state-${record.state}">${record.state}</span>
        </div>
        <div class="device-card__meta">
          ${escapeHtml(record.status)} · Batt ${record.battery ?? "—"}% · ${ageSeconds}s ago
        </div>
      `;
      container.appendChild(card);
    }
  }

  // Periodically re-check staleness even when no new packets arrive.
  setInterval(() => {
    deviceStore.refreshStates();
  }, 5000);

  // --- Device detail modal -------------------------------------------
  function showDeviceDetail(record) {
    const fresh = deviceStore.get(record.deviceId) || record;
    el("device-detail-content").innerHTML = `
      <dl>
        <dt>Device</dt><dd>${escapeHtml(fresh.deviceId)}</dd>
        <dt>Status</dt><dd>${escapeHtml(fresh.status)}</dd>
        <dt>State</dt><dd>${escapeHtml(fresh.state)}</dd>
        <dt>Coordinates</dt><dd>${fresh.latitude.toFixed(6)}, ${fresh.longitude.toFixed(6)}</dd>
        <dt>Battery</dt><dd>${fresh.battery ?? "—"}%</dd>
        <dt>Sequence</dt><dd>#${fresh.sequence}</dd>
        <dt>RSSI</dt><dd>${fresh.rssi ?? "—"} dBm</dd>
        <dt>SNR</dt><dd>${fresh.snr ?? "—"} dB</dd>
        <dt>Last update</dt><dd>${new Date(fresh.receivedAt).toLocaleTimeString()}</dd>
      </dl>
      ${fresh.emergency ? `<button class="btn btn--secondary btn--sm" id="ack-emergency" style="margin-top:0.8rem;">Acknowledge emergency</button>` : ""}
    `;
    el("device-detail").hidden = false;

    const ackBtn = el("ack-emergency");
    if (ackBtn) {
      ackBtn.addEventListener("click", () => {
        deviceStore.acknowledgeEmergency(fresh.deviceId);
        el("device-detail").hidden = true;
      });
    }
  }

  el("device-detail-close").addEventListener("click", () => {
    el("device-detail").hidden = true;
  });
  el("device-detail").addEventListener("click", (e) => {
    if (e.target.id === "device-detail") el("device-detail").hidden = true;
  });

  // --- Messages ----------------------------------------------------------
  function logMessage(text, direction = "sent") {
    const log = el("message-log");
    const item = document.createElement("div");
    item.className = "message-item";
    item.innerHTML = `<time>${new Date().toLocaleTimeString()} · ${direction}</time>${escapeHtml(text)}`;
    log.appendChild(item);
    log.scrollTop = log.scrollHeight;
  }

  function sendMessage(text) {
    if (!text.trim()) return;
    logMessage(text, "sent");
    logger.log(`Message queued for transmission: "${text}" (encoded size: ${new TextEncoder().encode(text).length} bytes)`, "info");
    if (currentTransportHandle?.sendCommand) {
      currentTransportHandle.sendCommand(`MSG,${text}`).catch((err) => {
        logger.log(`Failed to send message: ${err.message}`, "error");
      });
    }
  }

  el("message-form").addEventListener("submit", (e) => {
    e.preventDefault();
    const input = el("message-input");
    sendMessage(input.value);
    input.value = "";
  });

  document.querySelectorAll("#quick-messages .chip").forEach((chip) => {
    chip.addEventListener("click", () => sendMessage(chip.dataset.msg));
  });

  // --- Diagnostic console controls -------------------------------------
  el("btn-clear-log").addEventListener("click", () => logger.clear());
  el("btn-export-log").addEventListener("click", () => logger.exportLog());

  // --- Startup -------------------------------------------------------
  logger.log("Hunter Radar beta console initialized.", "ok");
  if (!HunterRadarBluetooth.isSupported()) {
    logger.log("Web Bluetooth not supported in this browser — use Chrome/Edge on desktop or Android.", "warn");
    el("btn-connect-ble").disabled = true;
    el("btn-connect-ble").title = "Web Bluetooth not supported in this browser";
  }
  if (!HunterRadarSerial.isSupported()) {
    logger.log("Web Serial not supported in this browser — use Chrome/Edge on desktop.", "warn");
    el("btn-connect-serial").disabled = true;
    el("btn-connect-serial").title = "Web Serial not supported in this browser";
  }

  function escapeHtml(str) {
    const div = document.createElement("div");
    div.textContent = str ?? "";
    return div.innerHTML;
  }
})();

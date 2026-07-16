/**
 * Hunter Radar — Simulated Data Service
 *
 * Generates packets in the exact wire format real hardware will send,
 * and feeds them into the same processHunterRadarPacket() entry point
 * as Bluetooth and Serial. This is how the map, parser, and device
 * store get built and tested before BLE firmware exists.
 */

const HunterRadarSimulate = (() => {

  // Stillwater, OK area — matches the default map center.
  const BASE_LAT = 36.1156;
  const BASE_LON = -97.0583;
  const STATUSES = ["SITTING", "MOVING", "TRACKING", "AT VEHICLE", "RETURNING"];

  function createSimulator({ onPacketLine, onLog }) {
    const simulatedDevices = ["HR01", "HR02", "HR03"];
    const sequences = new Map(simulatedDevices.map((id) => [id, 0]));
    // Each device gets a small random walk offset so markers visibly drift.
    const offsets = new Map(
      simulatedDevices.map((id) => [id, { lat: (Math.random() - 0.5) * 0.01, lon: (Math.random() - 0.5) * 0.01 }])
    );

    let intervalId = null;

    function buildPacket(deviceId, { forceType = "LOC" } = {}) {
      const seq = (sequences.get(deviceId) || 0) + 1;
      sequences.set(deviceId, seq);

      const offset = offsets.get(deviceId);
      offset.lat += (Math.random() - 0.5) * 0.0015;
      offset.lon += (Math.random() - 0.5) * 0.0015;

      const lat = (BASE_LAT + offset.lat).toFixed(6);
      const lon = (BASE_LON + offset.lon).toFixed(6);
      const status = forceType === "SOS" ? "EMERGENCY" : STATUSES[Math.floor(Math.random() * STATUSES.length)];
      const battery = Math.max(5, Math.floor(90 - seq * 0.4 + Math.random() * 4));
      const rssi = Math.floor(-70 - Math.random() * 40);
      const snr = (Math.random() * 12 - 5).toFixed(2);

      return `${forceType},${deviceId},${lat},${lon},${status},${battery},${seq},${rssi},${snr}\n`;
    }

    function injectOne(deviceId = simulatedDevices[0]) {
      const packet = buildPacket(deviceId);
      onLog?.(`[SIM] Injecting test packet for ${deviceId}`, "info");
      onPacketLine(packet.trim());
    }

    function injectSOS(deviceId = simulatedDevices[0]) {
      const packet = buildPacket(deviceId, { forceType: "SOS" });
      onLog?.(`[SIM] Injecting TEST SOS for ${deviceId}`, "warn");
      onPacketLine(packet.trim());
    }

    function start({ intervalMs = 4000 } = {}) {
      if (intervalId) return;
      onLog?.("[SIM] Simulation mode started.", "ok");
      intervalId = setInterval(() => {
        const deviceId = simulatedDevices[Math.floor(Math.random() * simulatedDevices.length)];
        injectOne(deviceId);
      }, intervalMs);
    }

    function stop() {
      if (intervalId) {
        clearInterval(intervalId);
        intervalId = null;
        onLog?.("[SIM] Simulation mode stopped.", "info");
      }
    }

    function isRunning() {
      return intervalId !== null;
    }

    return { injectOne, injectSOS, start, stop, isRunning, deviceIds: simulatedDevices };
  }

  return { createSimulator };
})();

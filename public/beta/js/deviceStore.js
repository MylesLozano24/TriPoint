/**
 * Hunter Radar — Device Store
 *
 * Tracks the latest known state of every device that has reported in.
 * Responsible for:
 *  - one marker per device ID (never one marker per packet)
 *  - rejecting duplicate / out-of-order packets via sequence number
 *  - computing staleness (current / delayed / stale / disconnected)
 *
 * Thresholds match the integration doc and are intentionally
 * configurable — the real transmission interval isn't finalized yet.
 */

const HunterRadarDeviceStore = (() => {

  const STALE_THRESHOLDS = {
    currentMs: 30 * 1000,
    delayedMs: 90 * 1000,
    disconnectedMs: 5 * 60 * 1000,
    // between delayedMs and disconnectedMs => "stale"
  };

  function createStore({ onUpdate, onReject } = {}) {
    /** @type {Map<string, object>} deviceId -> latest known record */
    const devices = new Map();
    /** @type {Set<string>} recently seen "deviceId:sequence" pairs, for extra duplicate safety */
    const seenPackets = new Set();

    function computeState(record) {
      if (record.emergency) return "emergency";
      const age = Date.now() - record.receivedAt;
      if (age < STALE_THRESHOLDS.currentMs) return "current";
      if (age < STALE_THRESHOLDS.delayedMs) return "delayed";
      if (age < STALE_THRESHOLDS.disconnectedMs) return "stale";
      return "disconnected";
    }

    function ingest(locationData) {
      const dedupeKey = `${locationData.deviceId}:${locationData.sequence}`;
      if (seenPackets.has(dedupeKey)) {
        onReject?.(locationData, "duplicate packet (already seen this sequence)");
        return null;
      }

      const existing = devices.get(locationData.deviceId);

      // Sequence gating: ignore anything not newer than what we already have,
      // UNLESS it's an SOS packet, which always takes priority.
      if (
        existing &&
        locationData.packetType !== "SOS" &&
        locationData.sequence <= existing.sequence
      ) {
        onReject?.(locationData, `stale sequence (have #${existing.sequence}, got #${locationData.sequence})`);
        return null;
      }

      seenPackets.add(dedupeKey);
      // Keep the seen-set from growing unbounded during long sessions.
      if (seenPackets.size > 5000) {
        const first = seenPackets.values().next().value;
        seenPackets.delete(first);
      }

      const record = {
        ...locationData,
        emergency: locationData.packetType === "SOS" || existing?.emergency === true,
        firstSeenAt: existing?.firstSeenAt ?? locationData.receivedAt,
      };

      devices.set(locationData.deviceId, record);
      onUpdate?.(withComputedState(record));
      return record;
    }

    function withComputedState(record) {
      return { ...record, state: computeState(record) };
    }

    function get(deviceId) {
      const record = devices.get(deviceId);
      return record ? withComputedState(record) : null;
    }

    function getAll() {
      return Array.from(devices.values()).map(withComputedState);
    }

    /** Called on a timer so stale/disconnected states update even with no new packets. */
    function refreshStates() {
      for (const record of devices.values()) {
        onUpdate?.(withComputedState(record));
      }
    }

    function acknowledgeEmergency(deviceId) {
      const record = devices.get(deviceId);
      if (!record) return;
      record.emergency = false;
      onUpdate?.(withComputedState(record));
    }

    function clear() {
      devices.clear();
      seenPackets.clear();
    }

    return { ingest, get, getAll, refreshStates, acknowledgeEmergency, clear, STALE_THRESHOLDS };
  }

  return { createStore, STALE_THRESHOLDS };
})();

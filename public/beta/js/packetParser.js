/**
 * Hunter Radar — Packet Parser
 *
 * Prototype packet format (comma-separated text, easy to inspect/debug):
 *   PACKET_TYPE,DEVICE_ID,LATITUDE,LONGITUDE,STATUS,BATTERY,SEQUENCE,RSSI,SNR
 *
 * Example:
 *   LOC,HR01,36.115600,-97.058300,SITTING,82,104,-82,7.25
 *
 * This module only validates and structures data. It does not touch the
 * map, the device store, or Bluetooth/Serial directly — see
 * recommended architecture in the integration doc.
 */

const HunterRadarParser = (() => {

  class PacketParseError extends Error {
    constructor(message, rawText) {
      super(message);
      this.name = "PacketParseError";
      this.rawText = rawText;
    }
  }

  /**
   * Parses one complete, newline-stripped packet line.
   * Throws PacketParseError on any invalid packet — callers should catch
   * this, log it to the diagnostic console, and NOT create a map marker.
   */
  function parseLocationPacket(packetText) {
    const trimmed = (packetText || "").trim();
    if (!trimmed) {
      throw new PacketParseError("Empty packet", packetText);
    }

    const fields = trimmed.split(",");

    if (fields.length < 9) {
      throw new PacketParseError(`Location packet has missing fields (got ${fields.length}, need 9)`, packetText);
    }

    const [
      packetType,
      deviceId,
      latitudeText,
      longitudeText,
      status,
      batteryText,
      sequenceText,
      rssiText,
      snrText,
    ] = fields;

    if (packetType !== "LOC" && packetType !== "SOS") {
      throw new PacketParseError(`Unknown packet type "${packetType}"`, packetText);
    }

    if (!deviceId) {
      throw new PacketParseError("Missing device ID", packetText);
    }

    const latitude = Number(latitudeText);
    const longitude = Number(longitudeText);
    const battery = Number(batteryText);
    const sequence = Number(sequenceText);
    const rssi = Number(rssiText);
    const snr = Number(snrText);

    if (!Number.isFinite(latitude) || latitude < -90 || latitude > 90) {
      throw new PacketParseError(`Invalid latitude "${latitudeText}"`, packetText);
    }
    if (!Number.isFinite(longitude) || longitude < -180 || longitude > 180) {
      throw new PacketParseError(`Invalid longitude "${longitudeText}"`, packetText);
    }
    if (!Number.isFinite(sequence)) {
      throw new PacketParseError(`Invalid sequence number "${sequenceText}"`, packetText);
    }

    return {
      packetType,
      deviceId,
      latitude,
      longitude,
      status: status || "UNKNOWN",
      battery: Number.isFinite(battery) ? battery : null,
      sequence,
      rssi: Number.isFinite(rssi) ? rssi : null,
      snr: Number.isFinite(snr) ? snr : null,
      receivedAt: Date.now(),
      raw: trimmed,
    };
  }

  /**
   * Reconstructs complete lines from arbitrary Bluetooth/Serial chunks.
   * Firmware terminates every forwarded packet with \n. Incomplete data
   * stays buffered until the rest arrives.
   */
  function createLineBuffer(onLine) {
    let buffer = "";
    return {
      push(chunk) {
        buffer += chunk;
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";
        for (const line of lines) {
          const cleaned = line.trim();
          if (cleaned) onLine(cleaned);
        }
      },
      reset() {
        buffer = "";
      },
    };
  }

  return { parseLocationPacket, createLineBuffer, PacketParseError };
})();

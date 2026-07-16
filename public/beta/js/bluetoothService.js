/**
 * Hunter Radar — Bluetooth Service (Web Bluetooth)
 *
 * IMPORTANT: The UUIDs below are PLACEHOLDERS. The BLE service structure
 * doesn't exist in firmware yet — per the integration doc, do not treat
 * these as real production identifiers. Replace them once the RP0240/ESP32
 * bridge firmware defines its actual GATT service.
 *
 * Browser support: Chrome/Edge on Windows, macOS, Linux, ChromeOS, Android.
 * NOT supported in Safari or any browser on iOS (Apple platform restriction).
 */

const HunterRadarBluetooth = (() => {

  // Placeholder UUIDs — swap for real firmware-defined UUIDs once BLE is implemented.
  const HUNTER_RADAR_SERVICE_UUID = "0000fff0-0000-1000-8000-00805f9b34fb";
  const LOCATION_CHARACTERISTIC_UUID = "0000fff1-0000-1000-8000-00805f9b34fb";
  const COMMAND_CHARACTERISTIC_UUID = "0000fff2-0000-1000-8000-00805f9b34fb";

  function isSupported() {
    return typeof navigator !== "undefined" && !!navigator.bluetooth;
  }

  function createBluetoothService({ onPacketLine, onLog, onStateChange }) {
    let device = null;
    let server = null;
    let locationCharacteristic = null;
    let commandCharacteristic = null;
    const lineBuffer = HunterRadarParser.createLineBuffer((line) => onPacketLine(line));

    async function connect() {
      if (!isSupported()) {
        onLog?.("Web Bluetooth is not supported in this browser.", "error");
        throw new Error("Web Bluetooth not supported");
      }

      onStateChange?.("connecting");
      onLog?.("Requesting Bluetooth device (filter: name prefix 'HunterRadar')...", "info");

      device = await navigator.bluetooth.requestDevice({
        filters: [{ namePrefix: "HunterRadar" }],
        optionalServices: [HUNTER_RADAR_SERVICE_UUID],
      });

      device.addEventListener("gattserverdisconnected", handleDisconnect);

      onLog?.(`Connecting to GATT server on ${device.name || "unknown device"}...`, "info");
      server = await device.gatt.connect();

      const service = await server.getPrimaryService(HUNTER_RADAR_SERVICE_UUID);
      locationCharacteristic = await service.getCharacteristic(LOCATION_CHARACTERISTIC_UUID);

      try {
        commandCharacteristic = await service.getCharacteristic(COMMAND_CHARACTERISTIC_UUID);
      } catch {
        onLog?.("Command characteristic not available (read-only connection).", "warn");
      }

      await locationCharacteristic.startNotifications();
      locationCharacteristic.addEventListener("characteristicvaluechanged", handleNotification);

      onStateChange?.("connected");
      onLog?.(`BLE connected: ${device.name || device.id}`, "ok");
      return device;
    }

    function handleNotification(event) {
      const value = event.target.value; // DataView
      const text = new TextDecoder().decode(value);
      lineBuffer.push(text);
    }

    function handleDisconnect() {
      onStateChange?.("disconnected");
      onLog?.("BLE disconnected.", "warn");
    }

    async function disconnect() {
      if (device?.gatt?.connected) {
        device.gatt.disconnect();
      }
    }

    async function sendCommand(text) {
      if (!commandCharacteristic) {
        onLog?.("No command characteristic available — cannot send.", "warn");
        return;
      }
      const bytes = new TextEncoder().encode(text.endsWith("\n") ? text : text + "\n");
      await commandCharacteristic.writeValue(bytes);
      onLog?.(`Sent command: ${text}`, "info");
    }

    return { connect, disconnect, sendCommand, isSupported };
  }

  return { createBluetoothService, isSupported, HUNTER_RADAR_SERVICE_UUID, LOCATION_CHARACTERISTIC_UUID };
})();

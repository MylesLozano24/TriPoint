/**
 * Hunter Radar — Serial Service (Web Serial)
 *
 * Lets the beta site talk to the current Feather RP2040 RFM95 prototype
 * directly over USB, before Bluetooth bridge firmware exists. Feeds the
 * exact same processHunterRadarPacket() pipeline as Bluetooth and
 * simulated data — see app.js.
 *
 * Browser support: Chrome/Edge on desktop only.
 */

const HunterRadarSerial = (() => {

  function isSupported() {
    return typeof navigator !== "undefined" && !!navigator.serial;
  }

  function createSerialService({ onPacketLine, onLog, onStateChange }) {
    let port = null;
    let reader = null;
    let keepReading = false;
    const lineBuffer = HunterRadarParser.createLineBuffer((line) => onPacketLine(line));

    async function connect({ baudRate = 115200 } = {}) {
      if (!isSupported()) {
        onLog?.("Web Serial is not supported in this browser.", "error");
        throw new Error("Web Serial not supported");
      }

      onStateChange?.("connecting");
      port = await navigator.serial.requestPort();
      await port.open({ baudRate });

      onStateChange?.("connected");
      onLog?.(`Serial connected at ${baudRate} baud.`, "ok");

      keepReading = true;
      readLoop();
      return port;
    }

    async function readLoop() {
      const textDecoder = new TextDecoderStream();
      const readableClosed = port.readable.pipeTo(textDecoder.writable);
      reader = textDecoder.readable.getReader();

      try {
        while (keepReading) {
          const { value, done } = await reader.read();
          if (done) break;
          if (value) lineBuffer.push(value);
        }
      } catch (err) {
        onLog?.(`Serial read error: ${err.message}`, "error");
      } finally {
        reader.releaseLock();
        await readableClosed.catch(() => {});
      }
    }

    async function disconnect() {
      keepReading = false;
      try {
        await reader?.cancel();
      } catch {
        // ignore
      }
      try {
        await port?.close();
      } catch {
        // ignore
      }
      onStateChange?.("disconnected");
      onLog?.("Serial disconnected.", "warn");
    }

    return { connect, disconnect, isSupported };
  }

  return { createSerialService, isSupported };
})();

# Hunter Radar Firmware

## Current status

Hardware: **Adafruit Feather RP2040 RFM95 LoRa** (915 MHz).

The current sketch (not yet committed here — pull it in from wherever it
lives today) does the following:

1. Starts serial at 115200 baud.
2. Resets and initializes the RFM95 radio at 915.0 MHz, 20 dBm.
3. Listens continuously for LoRa packets.
4. Prints each received packet's raw text, RSSI, and SNR to USB serial.

It does **not** yet do any of the following — these are next steps, not
current behavior:

- Bluetooth (the RP2040 on this board has no native BLE)
- GPS
- Packet parsing / structured fields
- Forwarding to the beta website
- Emergency alerts, acknowledgments, mesh relay, encryption

## Next step: Bluetooth bridge

The RP2040 RFM95 Feather has no built-in Bluetooth, so BLE needs to be
added one of these ways:

- A separate BLE module wired to the RP2040
- A companion ESP32 board bridging RP2040 ⇄ phone/website
- A future hardware revision using a single board with both LoRa and BLE

Once BLE exists, firmware should:

1. Receive a LoRa packet as today.
2. Format it as: `LOC,DEVICE_ID,LAT,LON,STATUS,BATTERY,SEQ,RSSI,SNR\n`
   (note the trailing `\n` — the website's line buffer depends on it)
3. Write that string to a BLE characteristic that the website subscribes to.

See `/public/beta/js/bluetoothService.js` for the exact GATT service/
characteristic UUIDs the website currently expects (**placeholders** —
update both sides together once real UUIDs are assigned in firmware).

## Testing without BLE

Until BLE firmware exists, the beta website can talk to this board
directly over USB using the Web Serial API — plug in, hit "Connect via
USB Serial" in the beta app, same 115200 baud rate, same packet format
(with the `\n` terminator added). This exercises the full pipeline
(parse → device store → map) before Bluetooth is ready.

## Suggested libraries once ESP32 is in the loop

- **RadioLib** or Adafruit's `RH_RF95` (already in use) for the LoRa radio
- **NimBLE-Arduino** (lighter/more stable than the stock ESP32 BLE stack)
  for the GATT server
- Arduino `TinyGPSPlus` if/when onboard GPS is added

/**
 * Hunter Radar — Map Layer
 *
 * Uses MapLibre GL JS (open source, no API key) with CARTO's free
 * "dark matter" basemap tiles, which don't require signup and suit the
 * dark diagnostic console aesthetic. For production traffic at scale,
 * swap the `style` URL below for a provider with a paid/committed free
 * tier (e.g. MapTiler, Stadia Maps) — see the note at the bottom of
 * this file.
 *
 * This module never touches raw packet strings — it only receives
 * already-validated device records from the Device Store.
 */

const HunterRadarMap = (() => {

  const STATE_COLOR_CLASS = {
    current: "hr-marker--current",
    delayed: "hr-marker--delayed",
    stale: "hr-marker--stale",
    disconnected: "hr-marker--disconnected",
    emergency: "hr-marker--emergency",
  };

  function createMapLayer(containerId, { onMarkerClick } = {}) {
    const map = new maplibregl.Map({
      container: containerId,
      style: {
        version: 8,
        sources: {
          "carto-dark": {
            type: "raster",
            tiles: [
              "https://a.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}@2x.png",
              "https://b.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}@2x.png",
              "https://c.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}@2x.png",
            ],
            tileSize: 256,
            attribution: "© OpenStreetMap contributors © CARTO",
          },
        },
        layers: [{ id: "carto-dark-layer", type: "raster", source: "carto-dark" }],
      },
      center: [-97.0584, 36.1156], // Stillwater, OK — reasonable default for field testing
      zoom: 13,
    });

    map.addControl(new maplibregl.NavigationControl({ showCompass: false }), "top-right");
    map.addControl(new maplibregl.ScaleControl({ unit: "imperial" }), "bottom-right");

    /** @type {Map<string, maplibregl.Marker>} */
    const markers = new Map();
    let hasFramedInitialDevice = false;

    function upsertMarker(record) {
      const stateClass = STATE_COLOR_CLASS[record.state] || STATE_COLOR_CLASS.stale;
      let marker = markers.get(record.deviceId);

      if (!marker) {
        const el = document.createElement("div");
        el.className = `hr-marker ${stateClass}`;
        el.addEventListener("click", () => onMarkerClick?.(record));

        marker = new maplibregl.Marker({ element: el })
          .setLngLat([record.longitude, record.latitude])
          .addTo(map);

        markers.set(record.deviceId, marker);
      } else {
        marker.setLngLat([record.longitude, record.latitude]);
        const el = marker.getElement();
        el.className = `hr-marker ${stateClass}`;
      }

      if (!hasFramedInitialDevice) {
        map.flyTo({ center: [record.longitude, record.latitude], zoom: 15, duration: 900 });
        hasFramedInitialDevice = true;
      }
    }

    function removeMarker(deviceId) {
      const marker = markers.get(deviceId);
      if (marker) {
        marker.remove();
        markers.delete(deviceId);
      }
    }

    function clearAll() {
      for (const marker of markers.values()) marker.remove();
      markers.clear();
      hasFramedInitialDevice = false;
    }

    return { map, upsertMarker, removeMarker, clearAll };
  }

  return { createMapLayer };
})();

/**
 * NOTE on map providers:
 *
 * - MapLibre GL JS is fully open source — no key, no billing account.
 * - CARTO's basemaps (used above) are free for light/dev use with no
 *   signup, but are not intended for sustained high-traffic production
 *   load. Fine for a beta test with a small number of testers.
 * - For the production TriPoint site, get a free-tier key from
 *   MapTiler (maptiler.com — 100k tile loads/month free) or Stadia
 *   Maps (stadiamaps.com) and swap the `sources` block for their
 *   vector/raster tile URL. Same MapLibre code otherwise.
 * - For OFFLINE beta operation (per the product spec), MapLibre
 *   supports caching tiles into IndexedDB via a service worker — that
 *   is a follow-up step once the online map is working end-to-end.
 */

/**
 * Hunter Radar — Map Layer
 *
 * Uses MapLibre GL JS (open source, no API key needed for the library
 * itself) with MapTiler as the tile provider — free tier: 100,000 map
 * loads/month, no credit card required.
 *
 * MAPTILER_API_KEY below is a CLIENT-SIDE key, not a secret. Unlike a
 * backend credential (e.g. the Resend key), MapTiler's key is designed
 * to sit in public JavaScript — its security model is domain
 * restriction, not secrecy. Get a free key at cloud.maptiler.com, paste
 * it below, then lock it to your domain in MapTiler's dashboard under
 * Account > Keys > (your key) > Allowed URLs — add
 * "https://tripoint-innovations.com/*" so the key is useless if anyone
 * ever copies it off the page.
 *
 * If no key is set (or the styled tiles ever fail to load — wrong key,
 * over quota, etc.), this automatically falls back to CARTO's free
 * no-key basemap so the map never just goes blank.
 *
 * This module never touches raw packet strings — it only receives
 * already-validated device records from the Device Store.
 */

const HunterRadarMap = (() => {

  // ---- Paste your free MapTiler key here ----
  const MAPTILER_API_KEY = ""; // e.g. "abcXYZ123..."
  // --------------------------------------------

  const MAPTILER_STYLE_ID = "streets-v4-dark";

  const STATE_COLOR_CLASS = {
    current: "hr-marker--current",
    delayed: "hr-marker--delayed",
    stale: "hr-marker--stale",
    disconnected: "hr-marker--disconnected",
    emergency: "hr-marker--emergency",
  };

  const CARTO_FALLBACK_STYLE = {
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
  };

  function initialStyle() {
    if (!MAPTILER_API_KEY) return CARTO_FALLBACK_STYLE;
    return `https://api.maptiler.com/maps/${MAPTILER_STYLE_ID}/style.json?key=${MAPTILER_API_KEY}`;
  }

  function createMapLayer(containerId, { onMarkerClick } = {}) {
    const map = new maplibregl.Map({
      container: containerId,
      style: initialStyle(),
      center: [-97.0584, 36.1156], // Stillwater, OK — reasonable default for field testing
      zoom: 13,
    });

    // If MapTiler's style fails to load (bad/missing key, wrong style id,
    // over quota), fall back to the no-key CARTO basemap rather than
    // leaving testers with a blank map. Only triggers once.
    let hasFallenBack = false;
    map.on("error", (e) => {
      if (hasFallenBack || !MAPTILER_API_KEY) return;
      console.warn("MapTiler style failed to load, falling back to CARTO basemap:", e?.error?.message || e);
      hasFallenBack = true;
      map.setStyle(CARTO_FALLBACK_STYLE);
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
 * - MapLibre GL JS is fully open source — no key, no billing account,
 *   regardless of which tile provider you point it at.
 * - MapTiler (used above once a key is set) — 100,000 map loads/month
 *   free, no credit card. This is the production-appropriate choice.
 * - The style id "streets-v4-dark" above is MapTiler's current dark
 *   variant naming as of mid-2026 — if it 404s, log into
 *   cloud.maptiler.com, browse the Maps gallery, and copy the exact
 *   style id shown there into MAPTILER_STYLE_ID (the automatic CARTO
 *   fallback means the map keeps working either way while you fix it).
 * - CARTO's basemap (the fallback) needs no signup but isn't intended
 *   for sustained high-traffic production load — fine as a safety net,
 *   not as the primary long-term provider.
 * - For OFFLINE beta operation (per the product spec), MapLibre
 *   supports caching tiles into IndexedDB via a service worker — that
 *   is a follow-up step once the online map is confirmed working.
 */

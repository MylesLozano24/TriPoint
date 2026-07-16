# TriPoint Innovations — Website & Hunter Radar Beta

Marketing site for TriPoint Innovations LLC, plus the Hunter Radar beta
test application, deployed as a single Cloudflare Worker serving static
assets at **tripoint-innovations.com**.

## Structure

```
/public/            Everything served to the browser
  index.html         Homepage
  about.html          About / mission / vision
  hunter-radar.html   Product page
  progress.html        Timeline / accomplishments
  team.html             Founders
  contact.html         Contact form (posts to /api/contact)
  privacy.html, terms.html   Placeholder legal pages — replace before public launch
  css/                Shared design tokens, base styles, components
  js/main.js          Shared site behavior (nav, reveals, count-ups, contact form)
  beta/               Hunter Radar beta test app
    index.html         App shell (map + panels)
    css/beta.css        App-specific styling
    js/
      packetParser.js       Validates/parses LOC,DEVICE_ID,LAT,LON,... packets
      deviceStore.js        One marker per device, sequence-gated, staleness states
      diagnosticLogger.js   Timestamped console + export
      mapLayer.js            MapLibre GL wrapper (no API key required)
      bluetoothService.js   Web Bluetooth transport (placeholder UUIDs)
      serialService.js      Web Serial transport (works with today's hardware)
      simulateService.js    Fake packet generator for development without hardware
      app.js                 Wires it all together

/worker/index.js    Cloudflare Worker — serves static assets + /api/contact
/wrangler.toml       Worker config (static assets binding)
/firmware/README.md  Notes on current hardware state + next BLE step
```

## Local development

No build step — it's plain HTML/CSS/JS. Easiest local preview:

```bash
npx wrangler dev
```

This runs the Worker locally (including the static asset serving and the
`/api/contact` endpoint) at `http://localhost:8787`.

## Deployment (Cloudflare)

**Recommended: Git integration.**

1. Push this repo to GitHub.
2. In the Cloudflare dashboard: Workers & Pages → Create → Connect to Git → select this repo.
3. Cloudflare auto-deploys on every push to `main`.
4. Under the Worker's Triggers tab, add the custom domain `tripoint-innovations.com` (and `www`).

**Manual alternative:**

```bash
npx wrangler deploy
```

### Contact form storage

`/api/contact` currently writes submissions to a Cloudflare KV namespace
if one is bound as `CONTACT_SUBMISSIONS` (see comments in
`worker/index.js`). To enable it:

```bash
npx wrangler kv namespace create CONTACT_SUBMISSIONS
```

Then add the returned binding to `wrangler.toml`:

```toml
[[kv_namespaces]]
binding = "CONTACT_SUBMISSIONS"
id = "your-namespace-id-here"
```

Without a bound KV namespace, submissions are still validated but not
persisted — wire up an email provider (e.g. Resend) or KV before relying
on the form for real inquiries.

## Maps

The beta app uses **MapLibre GL JS** (open source, no API key) with
CARTO's free basemap tiles — fine for beta testing, not meant for heavy
production traffic. See the note at the bottom of `mapLayer.js` for
swapping to a committed free tier (MapTiler, Stadia Maps) later.

## Beta app loads independently from the main site

The beta app (`/beta/`) and the marketing site are separate HTML
documents with separate script/style bundles — this is a plain
multi-page site, not a single-page app, so visiting the beta app is a
full page navigation, not something injected into the homepage.

- The homepage never loads MapLibre, Bluetooth/Serial services, or any
  `/beta/js/*` file.
- The beta app never loads `/js/main.js` (the homepage's nav/scroll/
  contact-form behavior).
- Only `tokens.css` and `base.css` (color variables + shared nav/button
  styling) are shared, for visual consistency — no shared functional code.
- The beta app is marked `noindex, nofollow` since it's a testing tool,
  not public marketing content.

If you later want even stronger isolation (e.g. independent deploys,
a separate Cloudflare Worker, or a `beta.tripoint-innovations.com`
subdomain instead of a `/beta/` path), that's a separate step from
what's set up here — say the word and it's a small config change.

## Beta app browser support

- **Web Bluetooth**: Chrome/Edge on Windows/macOS/Linux/ChromeOS/Android only. Not supported in Safari or any iOS browser (Apple platform restriction) — iPhone testing will eventually need a native or React Native/Expo app.
- **Web Serial**: Chrome/Edge on desktop only.
- Both are optional for using the beta app — the "Test Controls" panel lets you exercise the full map/parser/device-store pipeline with simulated data on any browser.

## Still needed before this looks "done"

- Real founder photos / prototype photography (currently placeholder blocks)
- Counsel-reviewed privacy policy and terms of use
- Real social links (LinkedIn/Instagram currently point to placeholder URLs)
- Firmware: actual BLE GATT UUIDs once bridge hardware is built (update `bluetoothService.js` to match)
- Email delivery for the contact form (or confirm KV-only storage is acceptable for now)

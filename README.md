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

### Contact form email (Resend)

`/api/contact` sends a notification email to `tripointinnovationsllc@gmail.com`
via [Resend](https://resend.com) whenever a `RESEND_API_KEY` secret is set on
the Worker. Without that secret, submissions are validated but no email goes out.

**Setup:**

1. Create a free Resend account at resend.com (free tier: 3,000 emails/month, 100/day — plenty for a contact form).
2. In the Resend dashboard, go to **API Keys** → **Create API Key**. Copy it — Resend only shows it once.
3. Add it to the Worker as a **secret** (never commit this to the repo or paste it into a code file):
   ```bash
   npx wrangler secret put RESEND_API_KEY
   ```
   This prompts you to paste the key directly into your terminal — it gets encrypted and stored by Cloudflare, not written to any file in this repo.

   Alternatively, via the dashboard: Worker → **Settings** → **Variables and Secrets** → **Add** → set type to **Secret** (encrypted), name `RESEND_API_KEY`.
4. That's it — new submissions will start emailing `tripointinnovationsllc@gmail.com`, with the sender's email set as the reply-to so you can just hit "Reply" in Gmail.

**Sender address:** By default this sends from Resend's shared `onboarding@resend.dev` address, which works immediately with no setup — fine to launch with. Once you want mail to come from `@tripoint-innovations.com` instead:

1. In Resend, go to **Domains** → **Add Domain** → enter `tripoint-innovations.com`
2. Add the DNS records Resend gives you (in Cloudflare's **Records** page, since the domain is already there)
3. Once verified, set an optional `CONTACT_FROM_EMAIL` variable on the Worker (e.g. `TriPoint Innovations <contact@tripoint-innovations.com>`) — no code changes needed, `worker/index.js` already checks for this variable.

**Optional backup copy:** submissions can also be written to a Cloudflare KV
namespace as a backup (in case an email send ever fails):

```bash
npx wrangler kv namespace create CONTACT_SUBMISSIONS
```

Then add the returned binding to `wrangler.toml`:

```toml
[[kv_namespaces]]
binding = "CONTACT_SUBMISSIONS"
id = "your-namespace-id-here"
```

## Maps

The beta app uses **MapLibre GL JS** (open source, no key needed for the
library itself) paired with **MapTiler** as the tile provider — free
tier: 100,000 map loads/month, no credit card required.

**Setup:**

1. Create a free account at [cloud.maptiler.com](https://cloud.maptiler.com)
2. Go to **Account → Keys** — a default key is created automatically, or click **Create Key**
3. Copy the key
4. Open `public/beta/js/mapLayer.js` and paste it into the `MAPTILER_API_KEY` constant near the top of the file:
   ```js
   const MAPTILER_API_KEY = "your-key-here";
   ```
5. **Restrict the key to your domain** (Account → Keys → your key → **Allowed URLs**) — add `https://tripoint-innovations.com/*`. This is the important step: unlike the Resend key, this one lives in public JavaScript, so domain restriction (not secrecy) is what keeps it from being used elsewhere.

**Important — this key is different from `RESEND_API_KEY`:** it does *not* go into Cloudflare's Variables and Secrets. It's meant to be visible in the browser, so it's committed directly in `mapLayer.js` like any other config value. Once restricted to your domain in step 5, that's the correct and complete security model for this kind of key.

If the key is missing or the styled map ever fails to load (wrong key, over quota), the map automatically falls back to a free basemap that needs no key at all — so it never just goes blank, even mid-troubleshooting.

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

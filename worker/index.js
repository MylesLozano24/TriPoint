/**
 * TriPoint Innovations — Cloudflare Worker
 *
 * Almost everything here is static (marketing site + Hunter Radar beta app),
 * so this Worker mostly just hands requests to the ASSETS binding.
 * The one piece of real logic is the contact form submission endpoint.
 */

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    // --- Contact form submission -------------------------------------
    if (url.pathname === "/api/contact" && request.method === "POST") {
      return handleContactForm(request, env);
    }

    // --- Everything else: serve the static site -----------------------
    return env.ASSETS.fetch(request);
  },
};

async function handleContactForm(request, env) {
  try {
    const data = await request.json();

    const name = (data.name || "").toString().trim();
    const email = (data.email || "").toString().trim();
    const organization = (data.organization || "").toString().trim();
    const interest = (data.interest || "").toString().trim();
    const message = (data.message || "").toString().trim();

    if (!name || !email || !message) {
      return jsonResponse({ ok: false, error: "Name, email, and message are required." }, 400);
    }

    // Very basic email shape check — real validation happens server-side
    // wherever this gets forwarded to (see note below).
    const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailPattern.test(email)) {
      return jsonResponse({ ok: false, error: "Please enter a valid email address." }, 400);
    }

    // NOTE: This Worker does not currently send email itself. Wire this up to
    // whichever service you prefer:
    //   - Resend (resend.com) has a generous free tier and a simple fetch-based API
    //   - Cloudflare Email Workers (send via a verified address)
    //   - Or forward to a Google Sheet / Airtable via their REST API
    // For now, submissions are stored in KV so nothing is lost while you wire up
    // notifications. Create a KV namespace named CONTACT_SUBMISSIONS and bind it
    // in wrangler.toml, or swap this out for your email provider of choice.

    const submission = {
      name,
      email,
      organization,
      interest,
      message,
      receivedAt: new Date().toISOString(),
    };

    if (env.CONTACT_SUBMISSIONS) {
      const key = `contact:${Date.now()}:${crypto.randomUUID()}`;
      await env.CONTACT_SUBMISSIONS.put(key, JSON.stringify(submission));
    }

    return jsonResponse({ ok: true });
  } catch (err) {
    return jsonResponse({ ok: false, error: "Something went wrong. Please try again." }, 500);
  }
}

function jsonResponse(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

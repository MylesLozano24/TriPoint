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

    const submission = {
      name,
      email,
      organization,
      interest,
      message,
      receivedAt: new Date().toISOString(),
    };

    // Best-effort backup copy in KV, if a namespace is bound — so a submission
    // is never fully lost even if the email send below fails for some reason.
    if (env.CONTACT_SUBMISSIONS) {
      const key = `contact:${Date.now()}:${crypto.randomUUID()}`;
      await env.CONTACT_SUBMISSIONS.put(key, JSON.stringify(submission));
    }

    // Send the actual notification email via Resend (resend.com).
    // Requires a RESEND_API_KEY secret to be set on this Worker — see
    // README.md for how to set that up. Until it's set, submissions are
    // still validated and (if KV is bound) stored, but no email goes out.
    if (env.RESEND_API_KEY) {
      const emailSent = await sendContactEmail(submission, env);
      if (!emailSent) {
        // Don't fail the whole request just because the email send failed —
        // the submission may still be in KV. Log for debugging via
        // `wrangler tail` and let the user know it worked from their side.
        console.error("Resend send failed for submission:", submission.email);
      }
    }

    return jsonResponse({ ok: true });
  } catch (err) {
    return jsonResponse({ ok: false, error: "Something went wrong. Please try again." }, 500);
  }
}

async function sendContactEmail(submission, env) {
  const toAddress = env.CONTACT_NOTIFY_EMAIL || "tripointinnovationsllc@gmail.com";

  // Uses Resend's default onboarding@resend.dev sender, which works without
  // verifying a domain first — fine to launch with. Once tripoint-innovations.com
  // is verified in Resend, switch the "from" below to something like
  // "TriPoint Innovations <contact@tripoint-innovations.com>" for a more
  // professional sender address (see README.md).
  const fromAddress = env.CONTACT_FROM_EMAIL || "TriPoint Website <onboarding@resend.dev>";

  const html = `
    <h2>New contact form submission</h2>
    <p><strong>Name:</strong> ${escapeHtml(submission.name)}</p>
    <p><strong>Email:</strong> ${escapeHtml(submission.email)}</p>
    <p><strong>Organization:</strong> ${escapeHtml(submission.organization || "—")}</p>
    <p><strong>Area of interest:</strong> ${escapeHtml(submission.interest || "—")}</p>
    <p><strong>Message:</strong></p>
    <p>${escapeHtml(submission.message).replace(/\n/g, "<br>")}</p>
    <hr>
    <p style="color:#888; font-size:12px;">Received ${submission.receivedAt}</p>
  `;

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${env.RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: fromAddress,
        to: [toAddress],
        reply_to: submission.email,
        subject: `TriPoint contact form: ${submission.name}${submission.interest ? ` — ${submission.interest}` : ""}`,
        html,
      }),
    });
    return res.ok;
  } catch (err) {
    console.error("Resend request threw:", err);
    return false;
  }
}

function escapeHtml(str) {
  return (str || "")
    .toString()
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function jsonResponse(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

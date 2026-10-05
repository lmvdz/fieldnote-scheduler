# Fieldnote: private provider setup

Run node scripts/setup-private.mjs once. It prepares an ignored .dev.vars file and generates an owner access key if absent. Existing keys are preserved. Edit this file locally; never paste secrets into a chat, a public repository, a URL, or Devpost.

## AI

Set AI_MODE=openrouter and OPENROUTER_API_KEY to your existing server-held key. Keep AI_PRIMARY_MODEL=liquid/lfm-2.5-2.6b:free and AI_ALLOW_PAID_FALLBACK=false. The adapter enforces a zero-price route. Use only the built-in synthetic examples; the input boundary is documented in README. Restart locally or redeploy after editing. A configured badge is not proof of a successful call. Record the UI's actual provider/model result and sanitized time/HTTP outcome; never record request headers or keys.

## PayPal sandbox

Set PAYPAL_CLIENT_ID and PAYPAL_CLIENT_SECRET from an existing sandbox business REST application. Only sandbox endpoints are implemented. Set PAYPAL_MODE=sandbox. Register a sandbox webhook for PAYMENT.CAPTURE.COMPLETED at https://fieldnote.inkwell.finance/api/paypal/webhook and set PAYPAL_WEBHOOK_ID. The listener verifies PayPal's signature before accepting the event and reconciles the authoritative order. A return redirect is not payment confirmation. A lost create result may retry the identical request for at most five hours from the first attempt; older unknowns require manual reconciliation. Complete buyer approval in the PayPal sandbox, return to /app, then verify and capture.

Use a separate sandbox buyer to approve orders; enter buyer credentials only on PayPal's sandbox pages. No production payment or real fulfillment is part of this prototype. Record sanitized order/capture/refund references, exact USD amount, final provider status and time as verification evidence. Mock tests do not count as this evidence.

## Hosting and judge access

SITE_OWNER_KEY protects the single-owner state and mutation APIs. Supply the access key privately in Devpost's judge testing instructions or by the organizer's approved private channel. Leave the public overview accessible. Keep hosting and judge access available through the official judging period, currently December 15, 2026. Payment and AI keys remain server bindings and are never shared with judges. Signing out clears the two-hour cookie; changing the access key revokes existing sessions.

## Current evidence limit

Provider secrets were not supplied to this work session. Actual AI inference, sandbox transactions and webhook delivery remain unverified. Fill the fields, then run and record the real provider flows before describing this as submit-ready.

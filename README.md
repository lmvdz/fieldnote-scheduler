# Fieldnote — quote to paid scheduling

An open-source hackathon prototype for an independent service business. A public project overview leads into a protected request editor, itemized quote, and server-side availability workspace.

## Run locally

Requires Node.js 24 or newer. The build runs without an npm install. The original public 3D scene includes a locally served, MIT-licensed Three.js runtime; see [scene design](docs/SCENE-DESIGN.md).

```sh
node scripts/setup-private.mjs
node scripts/build.mjs
node --test --test-isolation=none tests/*.test.mjs
node scripts/validate-artifact.mjs
node scripts/dev.mjs
```

Open http://127.0.0.1:4303/ for the public project overview, then choose the workspace link or visit /app. Read SITE_OWNER_KEY from the ignored .dev.vars file and enter it at the access gate. Keep this key out of source control, screenshots, recordings, and public submission text. PORT overrides the local port. State persists in ignored .local/ SQLite files; the deployed Worker uses its D1 DB binding.

The initial configuration uses synthetic examples and the no-money simulator. [Private provider setup](docs/PROVIDER-SETUP.md) explains the optional AI and PayPal sandbox configuration. [Cloudflare deployment](docs/DEPLOYMENT.md) describes hosting at https://fieldnote.inkwell.finance. Deployment status is reported separately from implementation.

## What works

1. Describe a carpet, window, furniture-assembly, or home-cleaning job. The default demo parser extracts service and quantity using deterministic rules, clearly labeled in the interface.
2. Resolve missing quantity, uncertain scope, or unsupported/oversized requests in explicit scope fields.
3. Edit descriptions, integer quantities, and dollar rates; server calculations use integer cents.
4. Select a UTC slot from the next five working days. Three busy slots are declared fixtures. Every offered slot is a three-hour service window, so a single slot key enforces nonoverlap.
5. Save the exact quote and time, then explicitly approve the scope, price, and slot. Any edits revoke approval. Availability is rechecked while acquiring a durable, unique slot lock.
6. Exercise no-money demo success, pending, declined, cancellation, and duplicate-event outcomes. A successful demo result is always labeled DEMO_COMPLETED and has a DEMO capture reference.
7. Verified completed payment transitions into a durable booking and downloadable text receipt. Pending, declined, mismatched, stale, or unknown results never confirm a booking.
8. Refresh or return later in the same browser: an HttpOnly same-site session cookie restores server state. New request preserves prior booked slots. Cancelling a later draft cannot delete them.

Voice entry is progressive enhancement through browser SpeechRecognition/webkitSpeechRecognition. It appears only when supported, starts on user action, explains possible remote audio processing, and handles errors. All functions work with text. No microphone was requested during testing.

## Sandbox PayPal adapter

Default mode is demo. The server-only adapter is in `src/paypal.mjs`; `.env.example` lists configuration names. It uses only https://api-m.sandbox.paypal.com. Live-mode payment processing is intentionally unsupported.

When the owner configures PAYPAL_MODE=sandbox, PAYPAL_CLIENT_ID, and PAYPAL_CLIENT_SECRET as server environment secrets:

- POST /api/order creates a CAPTURE order with the server-approved USD amount and session correlation ID
- The buyer opens the provider-returned sandbox approval link
- POST /api/capture captures the persisted server order with a stable PayPal-Request-Id, then checks the exact amount, currency, order ID, correlation ID, and completed capture
- POST /api/paypal/webhook verifies the provider signature through PayPal's verification endpoint, fetches the order server-side, and idempotently applies completed capture events
- PAYPAL_WEBHOOK_ID is required for signature verification
- Webhook and foreground completion use an atomic, guarded D1 batch. If the session revision changes during verification, it reloads safely without leaving a partial booked slot or prematurely recorded event
- A lost create response is retried using its persisted identical idempotency key and immutable payload; inserted order rows can be replayed without duplicates
- Capture timeouts retain the lock in a reconciliation state. Reconciliation reads PayPal and retries the same capture key only if PayPal still reports APPROVED
- Changing adapter mode during an in-flight operation fails closed

Webhook testing requires a reachable, signature-verified listener and an authenticated application hosting design. Foreground capture can still reconcile payment when the app is open.

The hosted application completed an actual $155 sandbox test-card capture, verified against PayPal, and recorded one durable booking. Duplicate capture reused the same booking. Wallet buyer approval/return UX and actual webhook delivery remain unverified. Mock transport/recovery tests are separate evidence. Refunds and post-capture cancellation of sandbox bookings are intentionally blocked until a real refund workflow exists.

Official API references:
- https://developer.paypal.com/api/orders/v2
- https://developer.paypal.com/api/webhooks/v1
- https://developer.paypal.com/studio/checkout/standard/integrate

## Optional OpenRouter AI (synthetic demo only)

The default remains deterministic and requires no keys. The server-only adapter uses OpenRouter's [Chat Completions API](https://openrouter.ai/docs/api_reference/overview), not an OpenAI key substituted into a different endpoint. Enable it only for synthetic demo data with an existing server-held key:

```dotenv
AI_MODE=openrouter
OPENROUTER_API_KEY=<existing server-only key>
AI_BASE_URL=https://openrouter.ai/api/v1
AI_PRIMARY_MODEL=liquid/lfm-2.5-2.6b:free
AI_FALLBACK_MODEL=deepseek/deepseek-v4.1-flash
AI_ALLOW_PAID_FALLBACK=false
AI_FALLBACK_MAX_PROMPT_PRICE=0.02
AI_FALLBACK_MAX_COMPLETION_PRICE=0.50
```

No credentials are included in source control. Optional credentials are held in ignored local configuration and server-only deployment bindings. The old `OPENAI_API_KEY` and `AI_MODE=openai` no longer activate an adapter. A key alone does not enable AI: `AI_MODE=openrouter` is also required. `.env` files remain ignored. Configure the base URL only on the server using a trusted HTTPS OpenRouter-compatible endpoint; credentials in URLs, query strings and redirects are rejected. Never put keys in browser code or a public environment variable.

**Synthetic data only.** This entry sends allowlisted fictional inputs to the optional model provider. Keep real customer, account, capture, payment and other sensitive information out of the demonstration. The input boundaries below apply to every configured model and fallback.

The prepared configuration explicitly selects `liquid/lfm-2.5-2.6b:free`, checked against the OpenRouter model catalog on October 5, 2026. The adapter still requires a zero-price provider; catalog availability is not live inference evidence. The legacy Space Bunny default has a retirement guard and is not used by the prepared configuration. If no free route is available, deterministic rules remain available and paid fallback stays disabled.

Paid fallback is **disabled by default**. Setting the server variable `AI_ALLOW_PAID_FALLBACK=true` deliberately opts into at most one separate [DeepSeek V4.1 Flash](https://openrouter.ai/deepseek/deepseek-v4.1-flash) request when the primary is unavailable, retired or produces invalid output. Authentication, billing and invalid-request errors do not trigger fallback. Its strict schema is requested only on that separate opted-in attempt; a schema requirement cannot route the primary to a paid model. The actual fallback is labeled in the UI.

The primary always has a zero-price provider filter, including when its model is overridden. Fallback filters cap provider prices at $0.02/M input and $0.50/M output by default. These are price ceilings, not a guaranteed available route or account spending budget. [Provider prices and availability vary](https://openrouter.ai/docs/guides/routing/provider-selection); no qualifying provider means deterministic fallback. Deliberately changing these server-side caps can change costs. Requests specify one model, disable provider failover, and never use automatic model routing.

There are at most two free-primary attempts for transient HTTP/transport failures and one opted-in paid attempt, each with a 6-second timeout and 256-token output limit (1024 total tokens for the explicitly configured free Liquid reasoning model). Inputs and response bytes are bounded. Malformed JSON, extra fields, tool calls, refusals, truncated output and invalid values are rejected. Errors shown to users contain no provider bodies, keys or raw transport details. Model output never authorizes a payment or changes server policy.

Live OpenRouter inference was observed on October 5, 2026 for a built-in synthetic example, with validated JSON and zero reported cost. Paid fallback remained disabled. Local mocks cover failure and policy boundaries. The public overview and protected workspace are deployed to this project’s custom domain. The hosted application completed an actual $155 sandbox test-card capture, verified against PayPal, and recorded one durable booking. Duplicate capture reused the same booking. Wallet buyer approval/return UX and actual webhook delivery remain unverified.

### Scheduler input boundary

Only exact built-in synthetic examples in `AI_SYNTHETIC_REQUESTS` can reach the provider: the three UI scenario buttons and the test/demo carpet request. All other free text stays with local deterministic rules and shows a notice. Manual scope fields also stay local. This prevents custom customer information from being sent; it intentionally limits AI drafting to the synthetic demonstration.

The server accepts only service, integer quantity (1-50 or null), a boolean pet flag and `clarified=false`. Extra fields, prices, slot/booking commands and approval instructions are rejected. Catalog rules calculate rates and totals; unresolved ambiguity, availability, exact human approval and payment verification still gate bookings. Paid-fallback use and the actual drafting engine are visible; fallback warnings are cleared after a later successful draft.

For local setup, edit the ignored `.dev.vars` file and restart the server. The scripts load missing process variables from this file. Explicit process variables take precedence.

## Safety and boundaries

- Prototype, not production-ready or connected to a real business calendar
- No real customer identity, contact/address collection, service-area rules, tax policy, refunds, or external calendar synchronization
- Fixed UTC timezone and three-hour windows; requested phrases such as “morning” are informative, not auto-approved
- Expired holds cannot be captured. Unknown payment states keep their slot locked for safe reconciliation
- Demo busy slots are fixtures; new demo bookings and collisions are real durable application state
- Server-side secrets only; no client-exposed payment or AI secret
- Same-origin JSON mutation requests, HttpOnly session cookie, CSP, output escaping, validation and optimistic revision checking
- Production expansion needs authentication/authorization across business accounts, rate limiting, reconciliation jobs, operational alerts, customer consent and privacy/retention policy, taxes, terms, refunds, and timezone/service-duration rules

## Tests and verification

`npm test` retains the original 14 tests and adds mocked OpenRouter transport, extraction, privacy and workflow checks. The original tests cover:
- integer-cent math and input bounds
- ambiguity and required scope
- exact approval and stale revision rejection
- capture state, amount, currency and correlation validation
- demo pending/declined/success and idempotence
- concurrent slot collision
- price-change approval revocation
- expired holds
- payment adapter mode mismatch
- completion CAS race
- lost create response and interrupted persistence
- capture timeout read-before-retry
- CSRF and disabled webhook adapter
- earlier booking preserved after reset, reselect and cancellation

The Worker build validates as Cloudflare-compatible ESM with callable default.fetch. End-to-end API tests use Node's built-in SQLite with a D1-compatible adapter. 

Responsive CSS includes desktop three-column, tablet two-column and mobile single-column layouts, native input labels, keyboard controls, focus rings, reduced motion, status announcements and text-first fallback. Automated browser/mobile visual QA has not been completed. No claim of visually verified mobile rendering is made. Test it on a real browser before a public demo.

The schema is maintained in `db/schema.ts`, with an inspected equivalent schema-only SQLite migration in `drizzle/0000_fieldnote.sql` and migration journal. Regenerate a matching snapshot using Drizzle in an authorized normal development environment before future schema evolution. This limitation does not affect the dependency-free Worker or tested SQLite behavior.

## License

MIT; see [LICENSE](LICENSE). Third-party APIs and services remain subject to their own terms.

PayPal transports reject redirects before parsing provider bodies. Checkout capture requests ask for a full representation; a minimal successful capture is recovered by reading the same order once before exact verification. This recovery never creates a second capture request.

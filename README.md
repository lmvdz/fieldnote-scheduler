# Fieldnote — quote to paid scheduling

An open-source hackathon prototype for an independent service business. It opens into a request editor, itemized quote, and live server-side availability workspace. It is not a marketing landing page.

## Run locally

Requires Node.js 24 or newer; no npm packages are required.

```
npm run build
npm test
npm run dev
```

Open the local address printed by the server (default http://localhost:4303). Local state is persisted in `.local/fieldnote.sqlite`, excluded from source control. The deployed Worker uses its D1 `DB` binding. Apply the bundled schema migration when configuring a D1 database. Hosting configuration is intentionally omitted.

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

No PayPal credentials were supplied. No PayPal sandbox account or real payment was accessed. Provider transport tests use deterministic in-process mocks, not live provider calls. Refunds and post-capture cancellation of sandbox bookings are intentionally blocked until a real refund workflow exists.

Official API references:
- https://developer.paypal.com/api/orders/v2
- https://developer.paypal.com/api/webhooks/v1
- https://developer.paypal.com/studio/checkout/standard/integrate

## Optional AI extraction

With explicit owner configuration of AI_MODE=openai and an existing OPENAI_API_KEY on the server, `src/ai.mjs` sends the job description to OpenAI Chat Completions for a structured service/quantity extraction. It never delegates rates, totals, approvals, scheduling writes, or payment decisions to the model. Fixed catalog pricing and manual review remain authoritative. No AI provider was connected or called during this build. Request text would be transmitted to the configured provider when enabled.

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

`npm test` currently runs 14 passing tests:
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

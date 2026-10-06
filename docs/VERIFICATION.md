# Verification evidence

Capture snapshot: 2026-10-05T22:57:06.969Z. Webhook follow-up: 2026-10-06T00:06:38.160Z (October 5, 2026, 7:06 PM Chicago). The amounts below use PayPal sandbox test funds and fictional task data. They do not represent production payments or fulfillment.

## Hosted principal outcome

The protected workspace created an exact approved quote order and performed the capture. Read-only PayPal lookup verified the completed order and exact USD capture.

| Provider resource | ID | Status | USD |
| --- | --- | --- | --- |
| Order | 71X86878CD862193N | COMPLETED | 155.00 |
| Capture | 6XR35522VT557171K | COMPLETED | 155.00 |

One durable order and one booked slot were observed. A repeated capture reused the original booking. Payment-source confirmation used PayPal's published sandbox test card; wallet buyer approval/return UI was not exercised.

## Genuine webhook follow-up

At October 5, 2026, 7:06 PM Chicago (2026-10-06T00:06:38.160Z), a genuine existing PayPal sandbox capture event was recorded by the hosted listener after an official event resend. The operator reports the resend was accepted with HTTP 202. Inspected evidence/hosted-webhook.json records the verified WH event, matching $155 order/capture and one durable order/booked slot. No financial side effect occurred during resend or observation. Wallet buyer approval/return UX remains unverified.

The ledger contains the foreground capture event and genuine webhook event `WH-6U7194308R784170M-7FC79103EP4064424` for the same order `71X86878CD862193N` and capture `6XR35522VT557171K`. The original `hosted-card-checkout.json` correctly records that no actual webhook had been observed at its earlier timestamp; it has not been rewritten. This follow-up supplies later observed delivery evidence. It does not claim a repeated financial transaction, wallet-return coverage or an unlimited webhook reliability guarantee.

## AI and browser evidence

The hosted API returned schema-validated responses from liquid/lfm-2.5-2.6b:free with zero reported cost and paid fallback disabled. These calls use built-in synthetic input only. Model explanations and extraction remain subordinate to local pricing, policy and explicit approval. Schema validity alone does not establish factual faithfulness.

GitHub Actions runs build the source and exercise local fixture browser workflows, desktop/390px/320px rendering, keyboard access, reduced motion, graphics/no-JavaScript fallbacks, the scroll seam and axe checks. The workflow artifacts identify the source revision and tested states. These local fixture results are separate from the hosted PayPal results above, and do not certify accessibility or production reliability.

## Remaining submission gates

Final independent design and submission review, a public English YouTube demonstration below three minutes, verified free judge access and entrant registration/eligibility remain open. A genuine signature-verified sandbox webhook is now evidenced; wallet buyer approval/return UX remains unverified. No measured customer ROI, real inventory/fulfillment integration or production readiness is claimed.

## Bounded prompt refinement

The extraction prompt now defines the catalog service taxonomy and asks for null when multiple services or no explicit quantity are present. In one fixed run, all three canonical cases matched source facts: carpet with pet treatment, an unresolved carpet-or-window request, and six windows. All three model outputs were retained and reported zero cost. Catalog prices, clarification and human approval remain server-controlled. This small synthetic check does not establish general request accuracy.


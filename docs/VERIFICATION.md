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

Earlier hosted API calls returned schema-validated responses from liquid/lfm-2.5-2.6b:free with zero reported cost and paid fallback disabled. These calls use built-in synthetic input only. Model explanations and extraction remain subordinate to local pricing, policy and explicit approval. Schema validity alone does not establish factual faithfulness.

GitHub Actions runs build the source and exercise local fixture browser workflows, desktop/390px/320px rendering, keyboard access, reduced motion, graphics/no-JavaScript fallbacks, the scroll seam and axe checks. The workflow artifacts identify the source revision and tested states. These local fixture results are separate from the hosted PayPal results above, and do not certify accessibility or production reliability.

## Independent quality review and current demonstration

The independent core review scores **81/100**: Technology 19 / Design 18 / Potential Impact 14 / Innovation 12 / Presentation 18. The historical first-preview baseline was 77/100. The separate accepted landing score is **82/100** and is not added to the core total. These are internal evidence-based reviewer estimates, not official judge results.

The revised English captioned MP4 is **166.84 seconds**, below three minutes, H.264 at 1280×940/25fps. Independent inspection covered ffprobe metadata, captions/manifest/provenance, storyboard pixels and decoded MP4 frame samples; it did not claim continuous playback of every frame.

No new AI inference was attempted during this revised film. The hosted segment identifies a stored validated OpenRouter drafting engine. Earlier verified live inference is separate evidence; local drafting is rules-based.

0–76.76 seconds: fresh isolated no-money journey, ten guarded local POSTs, no provider keys and blocked provider fetch. Ambiguous scope, editable $155 quote/time, exact approval, $200 edit revoking consent, fresh $155 approval, pending unconfirmed and DEMO booking are shown.

76.76–166.84 seconds: GET-only view of the previously verified $155 sandbox booking and stored drafting label. Retained genuine webhook proof is explained; no event resend or new payment occurs during filming.

The reviewed exact-source browser report passed 38 checks. Actual sandbox booking and genuine webhook observations remain separate.
No observed axe violation/page error in tested states is a universal accessibility certification. Free-model availability, future cost and broad factual accuracy are not guaranteed.

## Remaining submission gates

Core and separate landing quality thresholds are met. Complete free local setup instructions are **published** in [judge access](JUDGE-ACCESS.md) on the current `feat/hackathon-sites` branch. Measured clean-public-file setup/build/validation and separate clean-checkout fixture-browser workflows support that rules-permitted local route. Judges generate their own local key; the entrant's hosted owner bearer is not required. Default review is deterministic/no-money simulation, not anonymous hosted AI/PayPal access.

**Public YouTube publication, hackathon registration, eligibility/representative authority and final submission form/link checks remain open.** The working source and instructions must remain freely accessible through the judging period. An accepted local MP4 and internal score do not establish public YouTube publication or an actual submission. Wallet buyer approval/return UX remains unverified. No customer ROI, live supplier/fulfillment/calendar operation or production readiness is claimed.

## Bounded prompt refinement

The extraction prompt now defines the catalog service taxonomy and asks for null when multiple services or no explicit quantity are present. In one fixed run, all three canonical cases matched source facts: carpet with pet treatment, an unresolved carpet-or-window request, and six windows. All three model outputs were retained and reported zero cost. Catalog prices, clarification and human approval remain server-controlled. This small synthetic check does not establish general request accuracy.



# Verification evidence

Evidence snapshot: 2026-10-05T22:57:06.969Z. The amounts below use PayPal sandbox test funds and fictional task data. They do not represent production payments or fulfillment.

## Hosted principal outcome

The protected workspace created an exact approved quote order and performed the capture. Read-only PayPal lookup verified the completed order and exact USD capture.

| Provider resource | ID | Status | USD |
| --- | --- | --- | --- |
| Order | 71X86878CD862193N | COMPLETED | 155.00 |
| Capture | 6XR35522VT557171K | COMPLETED | 155.00 |

One durable order and one booked slot were observed. A repeated capture reused the original booking. Payment-source confirmation used PayPal's published sandbox test card; wallet buyer approval/return UI was not exercised.

## AI and browser evidence

The hosted API returned schema-validated responses from liquid/lfm-2.5-2.6b:free with zero reported cost and paid fallback disabled. These calls use built-in synthetic input only. Model explanations and extraction remain subordinate to local pricing, policy and explicit approval. Schema validity alone does not establish factual faithfulness.

GitHub Actions runs build the source and exercise local fixture browser workflows, desktop/390px/320px rendering, keyboard access, reduced motion, graphics/no-JavaScript fallbacks, the scroll seam and axe checks. The workflow artifacts identify the source revision and tested states. These local fixture results are separate from the hosted PayPal results above, and do not certify accessibility or production reliability.

## Remaining submission gates

Final independent design and submission review, a public English YouTube demonstration below three minutes, verified free judge access and entrant registration/eligibility remain open. The sandbox webhook is registered; genuine signature-verified delivery has not yet been recorded. No measured customer ROI, real inventory/fulfillment integration or production readiness is claimed.

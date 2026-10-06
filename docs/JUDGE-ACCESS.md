# Fieldnote: free local judge access

Use the current [feat/hackathon-sites source](https://github.com/lmvdz/fieldnote-scheduler/tree/feat/hackathon-sites) and retained [PR #1](https://github.com/lmvdz/fieldnote-scheduler/pull/1). The repository default branch is an older application. Requires Node.js 24 or newer and a browser. The application build needs no npm installation; the MIT Three.js runtime and assets are served locally.

## Download and run

With Git:

```sh
git clone --branch feat/hackathon-sites --single-branch https://github.com/lmvdz/fieldnote-scheduler.git
cd fieldnote-scheduler
node --version
node scripts/setup-private.mjs
node scripts/build.mjs
node --test --test-isolation=none tests/*.test.mjs
node scripts/validate-artifact.mjs
node scripts/dev.mjs
```

Without Git, open the linked tree, choose **Code → Download ZIP**, extract it, open a terminal in the extracted repository and run the commands beginning with `node --version`. No Cloudflare account or deployment is needed.

Setup generates **your own local** `SITE_OWNER_KEY` in ignored `.dev.vars`. Open that newly generated file privately in a text editor and enter only your local key at **http://127.0.0.1:4303/app**. The overview is **http://127.0.0.1:4303/**. This key does not grant the entrant's hosted workspace access; keep it out of recordings and source control.

Fresh controls are `AI_MODE=rules`, `PAYPAL_MODE=demo`; provider keys are blank. Keep those settings for credential-free review. Existing shell variables take precedence, so start without inherited AI/PayPal credentials. Check visible simulator/rules labels before approving an action. State is local SQLite under ignored `.local/`. Keep the server running during review; Ctrl+C stops it.

## Suggested working journey

Start with an ambiguous carpet-or-window request and resolve scope. Review three carpet rooms plus pet treatment: $135 + $20 = $155. Select a UTC window, save and approve. Edit to revoke approval, restore intended scope and approve again. In no-money mode, inspect pending/declined outcomes that do not confirm, then a clearly labeled DEMO booking.

These interactions use fictional data, deterministic rules and a **no-money simulator**. They need no PayPal/AI account, key or funds. They are not actual provider processing, general AI accuracy, real inventory/fulfillment or an external business calendar.

## Evidence and rules interpretation

The rules expressly permit complete repository setup/run instructions as an alternative to hosted project access. This local working-build route is therefore viable; a ZIP or screenshot alone is insufficient. This is an interpretation of the access clause, not an organizer eligibility ruling. [Official rules, Submission Requirements and Testing](https://paypalaihackathon.devpost.com/rules).

A measured clean-setup check copied exact public source files into fresh directories, verified their Git blob identities, ran setup/build/Worker validation successfully, generated a local owner key and confirmed blank provider credentials. The clean-copy check did not itself run the interactive journey. Separate clean-checkout CI/browser evidence covers fixture workflows. [Verification evidence](VERIFICATION.md) identifies the tested revisions and bounded scope.

Fresh local setup does not reproduce live OpenRouter inference or a genuine PayPal sandbox transaction. Previously verified hosted outcomes have separate sanitized evidence and recordings. Local fixture operation, retained provider evidence and private hosted access are distinct facts. No anonymous hosted AI access or future hosted availability is promised.

## Optional provider evaluation and remaining gates

Follow [private provider setup](PROVIDER-SETUP.md) for optional actual AI/sandbox integration. Authorized server-held credentials and sandbox resources are required. This download does not supply those credentials. Keep real customer/payment data and production credentials out of the prototype.

If judges need interactive access to the entrant's hosted provider configuration, an approved access arrangement must be included in testing instructions. The entrant's hosted owner bearer is not needed for this local route. Zero-price routing, disabled paid fallback and bounded synthetic inputs are safeguards; free-model availability and factual accuracy are not guaranteed.

Source, complete instructions and necessary testing artifacts must remain freely accessible through the judging period. Publication of this newly prepared document and confirmation of ongoing availability remain entrant responsibilities. Public YouTube publication, registration and eligibility/representation are separate gates. Browser checks are bounded observations, not universal accessibility or production certification.


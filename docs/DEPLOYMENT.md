# Fieldnote: Cloudflare deployment

Target: https://fieldnote.inkwell.finance, Worker inkwell-fieldnote, isolated D1 database inkwell-fieldnote-demo. The apex domain is outside this deployment.

1. Prepare .dev.vars and build with node scripts/build.mjs.
2. Authenticate Cloudflare in your terminal using npx wrangler login.
3. Run node scripts/deploy-cloudflare.mjs --check. This reads account, zone, domain and database metadata without changing Cloudflare.
4. Run node scripts/deploy-cloudflare.mjs --deploy. It creates or reuses this project's D1 database, applies the bundled additive migrations, uploads the self-contained Worker with server-only secrets, and attaches only this custom hostname. Existing conflicting domain services or DNS records cause a stop. It does not alter the apex or unrelated resources.
5. Confirm the HTTPS overview, privacy page, owner gate, signed-in simulator, anonymous API rejection and PayPal return path. Independently verify providers after adding their secrets.

The script reads CLOUDFLARE_API_TOKEN from the process environment when supplied; otherwise it reads Wrangler's local OAuth configuration. It never prints secret values. Use an API token with account Workers and D1 access and the target zone permissions if OAuth is unavailable. Deployment does not upgrade an account plan or enable paid AI fallback.

Public defaults stay in wrangler.jsonc. .dev.vars and local SQLite state are excluded from Git. Runtime configuration is never embedded in the JavaScript upload. Deployment metadata and checks are saved in ignored evidence/deployment.json.

References: [Worker uploads](https://developers.cloudflare.com/workers/configuration/multipart-upload-metadata/), [custom domains](https://developers.cloudflare.com/api/resources/workers/subresources/domains/methods/update/), [D1 queries](https://developers.cloudflare.com/api/resources/d1/subresources/database/methods/query/).

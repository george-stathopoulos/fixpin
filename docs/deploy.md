# Deploy your own Fixpass server

You need a free Cloudflare account.

```bash
npm install
npx wrangler login
npx wrangler kv namespace create REPORTS   # paste the id into wrangler.toml
npm test
npm run deploy
```

Then set `DEFAULT_SERVER` in the extension (`src/config.js`) to your Worker's address.

Limits: reports up to 2 MB, links 1/7/30 days. For heavy public use, add a Cloudflare rate-limiting rule on `POST /api/reports`.
